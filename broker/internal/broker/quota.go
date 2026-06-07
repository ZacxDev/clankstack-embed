package broker

import (
	"log/slog"
	"sync"
	"time"
)

// Quotas tracks rate limiting and per-session counters in memory, and delegates
// the abuse-critical *daily* spend to a SpendBackend (in-memory or Postgres).
// All methods are safe for concurrent use.
type Quotas struct {
	mu sync.Mutex

	// sessionWindows keys "embedID|ip" -> sliding counter for session minting.
	sessionWindows map[string]*window

	// sessionMsgs keys jti -> messages remaining in that session.
	sessionMsgs map[string]int
	// sessionToks keys jti -> tokens remaining in that session.
	sessionToks map[string]int

	// spend persists per-embed daily token spend (durable across restarts when
	// Postgres-backed). The daily cap is the one counter that must not reset.
	spend SpendBackend
	log   *slog.Logger

	nowFn func() time.Time
}

// window is a fixed 60-second counter that resets when the minute rolls over.
type window struct {
	count   int
	resetAt time.Time
}

// NewQuotas creates a quota tracker over the given spend backend.
func NewQuotas(spend SpendBackend, log *slog.Logger) *Quotas {
	return &Quotas{
		sessionWindows: make(map[string]*window),
		sessionMsgs:    make(map[string]int),
		sessionToks:    make(map[string]int),
		spend:          spend,
		log:            log,
		nowFn:          time.Now,
	}
}

// AllowSession reports whether a new session may be minted for (embedID, ip)
// under the per-minute limit, consuming one slot if allowed.
func (q *Quotas) AllowSession(embedID, ip string, perMin int) bool {
	if perMin <= 0 {
		perMin = 30 // sane default if unconfigured
	}
	q.mu.Lock()
	defer q.mu.Unlock()
	now := q.nowFn()
	key := embedID + "|" + ip
	w := q.sessionWindows[key]
	if w == nil || now.After(w.resetAt) {
		w = &window{count: 0, resetAt: now.Add(time.Minute)}
		q.sessionWindows[key] = w
	}
	if w.count >= perMin {
		return false
	}
	w.count++
	return true
}

// SpendAvailable reports whether the embed's daily budget has remaining room.
// On a spend-backend error it fails CLOSED (returns false) — for a public,
// money-spending endpoint, refusing service beats spending unaccounted tokens.
func (q *Quotas) SpendAvailable(embedID string, dailyBudget int) bool {
	used, err := q.spend.Today(embedID)
	if err != nil {
		q.log.Error("spend backend Today failed; failing closed", "embed", embedID, "err", err)
		return false
	}
	return used < dailyBudget
}

// SpendUsedToday returns tokens spent today for an embed (0 on error).
func (q *Quotas) SpendUsedToday(embedID string) int {
	used, err := q.spend.Today(embedID)
	if err != nil {
		q.log.Error("spend backend Today failed", "embed", embedID, "err", err)
		return 0
	}
	return used
}

// AddSpend records token spend against the embed's daily total and the session's
// remaining token budget. It returns the remaining daily budget (budget - used)
// and remaining session tokens after the add. Negative values mean exhausted; a
// spend-backend error is reported as daily-exhausted (fail closed).
func (q *Quotas) AddSpend(embedID, jti string, tokens, dailyBudget int) (dailyRemaining, sessionRemaining int) {
	total, err := q.spend.Add(embedID, tokens)

	q.mu.Lock()
	if rem, ok := q.sessionToks[jti]; ok {
		q.sessionToks[jti] = rem - tokens
		sessionRemaining = rem - tokens
	}
	q.mu.Unlock()

	if err != nil {
		q.log.Error("spend backend Add failed; treating as exhausted", "embed", embedID, "err", err)
		return -1, sessionRemaining
	}
	return dailyBudget - total, sessionRemaining
}

// InitSession seeds the per-session message and token counters for a jti if not
// already present. Idempotent.
func (q *Quotas) InitSession(jti string, msgBudget, tokBudget int) {
	q.mu.Lock()
	defer q.mu.Unlock()
	if _, ok := q.sessionMsgs[jti]; !ok {
		q.sessionMsgs[jti] = msgBudget
	}
	if _, ok := q.sessionToks[jti]; !ok {
		q.sessionToks[jti] = tokBudget
	}
}

// ConsumeMessage decrements the per-session message counter for jti. It returns
// false if no messages remain (counter already at zero).
func (q *Quotas) ConsumeMessage(jti string) bool {
	q.mu.Lock()
	defer q.mu.Unlock()
	rem, ok := q.sessionMsgs[jti]
	if !ok {
		// Session never initialized: treat as unlimited-safe failure.
		return false
	}
	if rem <= 0 {
		return false
	}
	q.sessionMsgs[jti] = rem - 1
	return true
}

// SessionTokensRemaining returns the per-session token budget remaining for jti.
func (q *Quotas) SessionTokensRemaining(jti string) int {
	q.mu.Lock()
	defer q.mu.Unlock()
	return q.sessionToks[jti]
}
