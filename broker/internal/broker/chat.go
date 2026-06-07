package broker

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
)

// maxHistoryMessages caps per-visitor in-memory conversation history (user +
// assistant turns combined).
const maxHistoryMessages = 20

// chatRequest is the body of POST /v1/embed/chat. Either Message (single) or
// Messages (passthrough) may be set.
type chatRequest struct {
	Message  string        `json:"message,omitempty"`
	Messages []chatMessage `json:"messages,omitempty"`
}

// history holds per-(embed,visitor) conversation context in memory.
type history struct {
	mu   sync.Mutex
	msgs map[string][]chatMessage // key: embedID|visitorID
}

func newHistory() *history { return &history{msgs: make(map[string][]chatMessage)} }

func histKey(embedID, visitorID string) string { return embedID + "|" + visitorID }

// get returns a copy of the stored history for a key.
func (h *history) get(embedID, visitorID string) []chatMessage {
	h.mu.Lock()
	defer h.mu.Unlock()
	src := h.msgs[histKey(embedID, visitorID)]
	out := make([]chatMessage, len(src))
	copy(out, src)
	return out
}

// append adds messages to a key's history and trims to the cap.
func (h *history) append(embedID, visitorID string, msgs ...chatMessage) {
	h.mu.Lock()
	defer h.mu.Unlock()
	k := histKey(embedID, visitorID)
	cur := append(h.msgs[k], msgs...)
	if len(cur) > maxHistoryMessages {
		cur = cur[len(cur)-maxHistoryMessages:]
	}
	h.msgs[k] = cur
}

// estimateTokens approximates token count for a string. We use len/4 (a common
// rough heuristic for English text), documented in the README.
func estimateTokens(s string) int {
	n := len(s) / 4
	if n < 1 && len(s) > 0 {
		return 1
	}
	return n
}

// handleChat implements POST /v1/embed/chat: validates the cs_ session, enforces
// budgets, opens the upstream gateway stream, and re-emits broker SSE events.
func (s *Server) handleChat(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, newAPIError(http.StatusMethodNotAllowed, "method_not_allowed", "use POST"))
		return
	}

	origin := r.Header.Get("Origin")

	// Verify the cs_ session token.
	token := bearerToken(r)
	claims, err := s.minter.Verify(token)
	if err != nil {
		writeError(w, errInvalidSession())
		return
	}
	// Origin must match the origin bound into the token at session time.
	if !strings.EqualFold(strings.TrimRight(origin, "/"), strings.TrimRight(claims.Origin, "/")) {
		writeError(w, errInvalidSession())
		return
	}
	// CORS for the matched origin.
	setCORS(w, origin)

	// Load the embed referenced by the token (it may have been disabled/deleted).
	embed, err := s.store.Get(claims.EmbedID)
	if err != nil || embed.Status != "enabled" {
		writeError(w, errEmbedNotFound())
		return
	}

	var req chatRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 256*1024)).Decode(&req); err != nil {
		writeError(w, errBadRequest("invalid JSON body"))
		return
	}

	// Build the message list. Single-message mode pulls in stored history.
	var messages []chatMessage
	var userText string
	switch {
	case len(req.Messages) > 0:
		messages = req.Messages
		// Use last user message for token accounting / history.
		for i := len(req.Messages) - 1; i >= 0; i-- {
			if req.Messages[i].Role == "user" {
				userText = req.Messages[i].Content
				break
			}
		}
	case strings.TrimSpace(req.Message) != "":
		userText = req.Message
		messages = append(s.hist.get(claims.EmbedID, claims.VisitorID), chatMessage{Role: "user", Content: userText})
	default:
		writeError(w, errBadRequest("message or messages required"))
		return
	}

	jti := claims.ID

	// Seed per-session counters from the budgets bound into the token. Idempotent:
	// subsequent requests with the same jti keep the running remainders.
	s.quotas.InitSession(jti, claims.MsgBudget, claims.TokBudget)

	// Per-session message budget.
	if !s.quotas.ConsumeMessage(jti) {
		s.streamSSEError(w, "session_quota_exceeded", "per-session message budget exhausted")
		return
	}
	// Daily token budget pre-check.
	if !s.quotas.SpendAvailable(embed.ID, embed.DailyTokenBudget) {
		s.streamSSEError(w, "quota_exceeded", "daily token budget exhausted")
		return
	}
	// Per-session token budget pre-check.
	if s.quotas.SessionTokensRemaining(jti) <= 0 {
		s.streamSSEError(w, "session_quota_exceeded", "per-session token budget exhausted")
		return
	}

	// Account the inbound prompt tokens up front.
	promptTokens := estimateTokens(userText)
	s.quotas.AddSpend(embed.ID, jti, promptTokens, embed.DailyTokenBudget)

	// Resolve the upstream gateway.
	rg, err := s.resolver.Resolve(r.Context(), embed)
	if err != nil {
		s.log.Error("resolve gateway", "embed", embed.ID, "err", err)
		s.streamSSEError(w, "upstream_error", "upstream gateway unavailable")
		return
	}

	// Prepare SSE response.
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, errInternal())
		return
	}
	h := w.Header()
	h.Set("Content-Type", "text/event-stream")
	h.Set("Cache-Control", "no-cache")
	h.Set("Connection", "keep-alive")
	h.Set("X-Accel-Buffering", "no") // disable proxy buffering (nginx)
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	ctx, cancel := context.WithTimeout(r.Context(), s.upstreamTimeout)
	defer cancel()

	sessionKey := fmt.Sprintf("embed:%s:%s", embed.ID, claims.VisitorID)

	// Token accounting during streaming. We approximate completion tokens by the
	// running assistant text length (len/4). To avoid double counting we track
	// what we've already charged and add deltas.
	var charged int
	var assembled strings.Builder
	stop := false

	emit := func(delta string) error {
		assembled.WriteString(delta)
		// Stream the delta to the browser.
		if err := s.writeSSE(w, flusher, map[string]any{"type": "delta", "text": delta}); err != nil {
			return err
		}
		// Incrementally account completion tokens.
		total := estimateTokens(assembled.String())
		if total > charged {
			add := total - charged
			charged = total
			dailyRem, sessRem := s.quotas.AddSpend(embed.ID, jti, add, embed.DailyTokenBudget)
			if dailyRem <= 0 || sessRem <= 0 {
				stop = true
				return context.Canceled // stop streaming; budget hit mid-stream
			}
		}
		return nil
	}

	_, streamErr := s.gateway.StreamChat(ctx, rg, sessionKey, messages, emit)

	// Persist history for single-message context (only when not passthrough).
	if userText != "" && assembled.Len() > 0 {
		s.hist.append(claims.EmbedID, claims.VisitorID,
			chatMessage{Role: "user", Content: userText},
			chatMessage{Role: "assistant", Content: assembled.String()},
		)
	}

	switch {
	case stop:
		// Budget exhausted mid-stream: emit the appropriate error then done.
		_ = s.writeSSE(w, flusher, map[string]any{"type": "error", "code": "session_quota_exceeded", "message": "budget exhausted mid-response"})
	case streamErr != nil && streamErr != context.Canceled:
		s.log.Error("upstream stream", "embed", embed.ID, "err", streamErr)
		_ = s.writeSSE(w, flusher, map[string]any{"type": "error", "code": "upstream_error", "message": "upstream stream error"})
	default:
		_ = s.writeSSE(w, flusher, map[string]any{"type": "done"})
	}
}

// streamSSEError writes SSE headers and a single error event, then closes. Used
// for pre-stream budget rejections (the response is still SSE per contract).
func (s *Server) streamSSEError(w http.ResponseWriter, code, message string) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, newAPIError(http.StatusTooManyRequests, code, message))
		return
	}
	h := w.Header()
	h.Set("Content-Type", "text/event-stream")
	h.Set("Cache-Control", "no-cache")
	h.Set("Connection", "keep-alive")
	w.WriteHeader(http.StatusOK)
	_ = s.writeSSE(w, flusher, map[string]any{"type": "error", "code": code, "message": message})
}

// writeSSE serializes a payload as a single SSE data event and flushes.
func (s *Server) writeSSE(w http.ResponseWriter, flusher http.Flusher, payload any) error {
	b, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	if _, err := fmt.Fprintf(w, "data: %s\n\n", b); err != nil {
		return err
	}
	flusher.Flush()
	return nil
}

// bearerToken extracts the token from an Authorization: Bearer header.
func bearerToken(r *http.Request) string {
	h := r.Header.Get("Authorization")
	const p = "Bearer "
	if len(h) > len(p) && strings.EqualFold(h[:len(p)], p) {
		return strings.TrimSpace(h[len(p):])
	}
	return ""
}

// now returns the server's current time (overridable in tests).
func (s *Server) now() time.Time {
	if s.nowFn != nil {
		return s.nowFn()
	}
	return time.Now()
}
