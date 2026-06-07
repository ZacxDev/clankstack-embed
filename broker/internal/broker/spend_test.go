package broker

import (
	"errors"
	"io"
	"log/slog"
	"testing"
	"time"
)

func TestMemSpendDayRoll(t *testing.T) {
	day := "2026-06-06T10:00:00Z"
	now := func() time.Time { tt, _ := time.Parse(time.RFC3339, day); return tt }
	m := newMemSpend(now)

	if total, _ := m.Add("emb_x", 100); total != 100 {
		t.Fatalf("Add -> %d; want 100", total)
	}
	if total, _ := m.Add("emb_x", 50); total != 150 {
		t.Fatalf("Add -> %d; want 150", total)
	}
	if got, _ := m.Today("emb_x"); got != 150 {
		t.Fatalf("Today -> %d; want 150", got)
	}
	// Roll to the next UTC day: the counter resets.
	day = "2026-06-07T00:01:00Z"
	if got, _ := m.Today("emb_x"); got != 0 {
		t.Fatalf("after day roll Today -> %d; want 0", got)
	}
}

// errSpend is a SpendBackend that always errors, to exercise fail-closed paths.
type errSpend struct{}

func (errSpend) Add(string, int) (int, error) { return 0, errors.New("db down") }
func (errSpend) Today(string) (int, error)    { return 0, errors.New("db down") }

func TestQuotasFailClosedOnSpendError(t *testing.T) {
	q := NewQuotas(errSpend{}, slog.New(slog.NewTextHandler(io.Discard, nil)))

	// SpendAvailable must fail closed (deny) when the backend errors.
	if q.SpendAvailable("emb_x", 10000) {
		t.Error("SpendAvailable returned true on backend error; want false (fail closed)")
	}
	// AddSpend must report daily-exhausted (-1) on backend error.
	q.InitSession("jti1", 5, 8000)
	if daily, _ := q.AddSpend("emb_x", "jti1", 100, 10000); daily != -1 {
		t.Errorf("AddSpend daily remaining = %d on backend error; want -1", daily)
	}
}

func TestQuotasHappyPath(t *testing.T) {
	now := func() time.Time { return time.Unix(1780000000, 0).UTC() }
	q := NewQuotas(newMemSpend(now), slog.New(slog.NewTextHandler(io.Discard, nil)))

	if !q.SpendAvailable("emb_x", 1000) {
		t.Error("fresh embed should have budget")
	}
	q.InitSession("jti1", 5, 8000)
	daily, sess := q.AddSpend("emb_x", "jti1", 400, 1000)
	if daily != 600 {
		t.Errorf("daily remaining = %d; want 600", daily)
	}
	if sess != 7600 {
		t.Errorf("session remaining = %d; want 7600", sess)
	}
	if used := q.SpendUsedToday("emb_x"); used != 400 {
		t.Errorf("used today = %d; want 400", used)
	}
}
