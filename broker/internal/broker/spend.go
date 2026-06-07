package broker

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SpendBackend persists per-embed *daily* token spend — the abuse-critical
// counter that MUST survive broker restarts, because a public embed spends real
// money and an attacker who can bounce the process would otherwise reset the cap.
// Session-scoped counters (15-min TTL) deliberately stay in-memory.
type SpendBackend interface {
	// Add adds tokens to the embed's spend for the current UTC day and returns
	// the new running day total.
	Add(embedID string, tokens int) (todayTotal int, err error)
	// Today returns tokens already spent today for the embed.
	Today(embedID string) (todayTotal int, err error)
}

// memSpend is the in-memory backend: single-process, resets on restart. Used
// when no DATABASE_URL is configured (dev / demo).
type memSpend struct {
	mu    sync.Mutex
	day   string
	spend map[string]int
	nowFn func() time.Time
}

func newMemSpend(nowFn func() time.Time) *memSpend {
	return &memSpend{spend: make(map[string]int), nowFn: nowFn}
}

func (m *memSpend) rollLocked() {
	d := m.nowFn().UTC().Format("2006-01-02")
	if d != m.day {
		m.day = d
		m.spend = make(map[string]int)
	}
}

func (m *memSpend) Add(embedID string, tokens int) (int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.rollLocked()
	m.spend[embedID] += tokens
	return m.spend[embedID], nil
}

func (m *memSpend) Today(embedID string) (int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.rollLocked()
	return m.spend[embedID], nil
}

// pgSpend persists daily spend in Postgres (durable across restarts; also works
// across replicas via the atomic upsert). The day boundary is UTC to match the
// in-memory backend.
type pgSpend struct {
	pool *pgxpool.Pool
}

func newPgSpend(ctx context.Context, dsn string) (*pgSpend, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("connect: %w", err)
	}
	ictx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if err := pool.Ping(ictx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping: %w", err)
	}
	if _, err := pool.Exec(ictx, `CREATE TABLE IF NOT EXISTS embed_spend (
		embed_id text NOT NULL,
		day      date NOT NULL,
		tokens   bigint NOT NULL DEFAULT 0,
		PRIMARY KEY (embed_id, day)
	)`); err != nil {
		pool.Close()
		return nil, fmt.Errorf("migrate: %w", err)
	}
	return &pgSpend{pool: pool}, nil
}

func (p *pgSpend) Add(embedID string, tokens int) (int, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var total int64
	err := p.pool.QueryRow(ctx, `
		INSERT INTO embed_spend (embed_id, day, tokens)
		VALUES ($1, (now() AT TIME ZONE 'utc')::date, $2)
		ON CONFLICT (embed_id, day)
		DO UPDATE SET tokens = embed_spend.tokens + EXCLUDED.tokens
		RETURNING tokens`, embedID, tokens).Scan(&total)
	return int(total), err
}

func (p *pgSpend) Today(embedID string) (int, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var total int64
	err := p.pool.QueryRow(ctx, `
		SELECT tokens FROM embed_spend
		WHERE embed_id = $1 AND day = (now() AT TIME ZONE 'utc')::date`, embedID).Scan(&total)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, nil
	}
	return int(total), err
}
