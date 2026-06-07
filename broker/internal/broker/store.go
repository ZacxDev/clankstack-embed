package broker

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"sort"
	"sync"
	"time"
)

// ErrNotFound is returned by Store methods when a record does not exist.
var ErrNotFound = errors.New("embed not found")

// Store abstracts embed persistence. A Postgres implementation can drop in later
// without touching handlers.
type Store interface {
	Create(e *Embed) error
	Get(id string) (*Embed, error)
	GetByPublishableKey(pk string) (*Embed, error)
	List() ([]*Embed, error)
	Update(id string, mutate func(*Embed) error) (*Embed, error)
	Delete(id string) error
	RotateKey(id string) (*Embed, error)
}

// MemStore is a thread-safe in-memory Store.
type MemStore struct {
	mu    sync.RWMutex
	byID  map[string]*Embed
	byPK  map[string]string // publishable key -> id
	nowFn func() time.Time
}

// NewMemStore creates an empty in-memory store.
func NewMemStore() *MemStore {
	return &MemStore{
		byID:  make(map[string]*Embed),
		byPK:  make(map[string]string),
		nowFn: time.Now,
	}
}

func (s *MemStore) Create(e *Embed) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if e.ID == "" {
		e.ID = newEmbedID()
	}
	if e.PublishableKey == "" {
		e.PublishableKey = newPublishableKey()
	}
	if e.Status == "" {
		e.Status = "enabled"
	}
	now := s.nowFn()
	e.CreatedAt = now
	e.UpdatedAt = now
	cp := *e
	s.byID[e.ID] = &cp
	s.byPK[e.PublishableKey] = e.ID
	return nil
}

func (s *MemStore) Get(id string) (*Embed, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	e, ok := s.byID[id]
	if !ok {
		return nil, ErrNotFound
	}
	cp := *e
	return &cp, nil
}

func (s *MemStore) GetByPublishableKey(pk string) (*Embed, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	id, ok := s.byPK[pk]
	if !ok {
		return nil, ErrNotFound
	}
	e := s.byID[id]
	cp := *e
	return &cp, nil
}

func (s *MemStore) List() ([]*Embed, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]*Embed, 0, len(s.byID))
	for _, e := range s.byID {
		cp := *e
		out = append(out, &cp)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.Before(out[j].CreatedAt) })
	return out, nil
}

// Update applies mutate to a copy of the record under lock, then commits it.
func (s *MemStore) Update(id string, mutate func(*Embed) error) (*Embed, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	e, ok := s.byID[id]
	if !ok {
		return nil, ErrNotFound
	}
	cp := *e
	if err := mutate(&cp); err != nil {
		return nil, err
	}
	cp.ID = id // never let mutate change identity
	cp.UpdatedAt = s.nowFn()
	s.byID[id] = &cp
	ret := cp
	return &ret, nil
}

func (s *MemStore) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	e, ok := s.byID[id]
	if !ok {
		return ErrNotFound
	}
	delete(s.byPK, e.PublishableKey)
	delete(s.byID, id)
	return nil
}

// RotateKey issues a new publishable key for an embed, invalidating the old one.
func (s *MemStore) RotateKey(id string) (*Embed, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	e, ok := s.byID[id]
	if !ok {
		return nil, ErrNotFound
	}
	delete(s.byPK, e.PublishableKey)
	cp := *e
	cp.PublishableKey = newPublishableKey()
	cp.UpdatedAt = s.nowFn()
	s.byID[id] = &cp
	s.byPK[cp.PublishableKey] = id
	ret := cp
	return &ret, nil
}

// SeedFromFile loads a JSON array of Embed records into the store. Missing IDs
// and publishable keys are generated. Intended for local/dev bootstrapping.
func (s *MemStore) SeedFromFile(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	var seeds []*Embed
	if err := json.Unmarshal(data, &seeds); err != nil {
		return err
	}
	for _, e := range seeds {
		// Seeds must keep a STABLE id across restarts, else the persisted daily
		// spend (keyed by embed id) is orphaned every boot and the cap resets.
		// Derive a deterministic id from the publishable key when none is given.
		if e.ID == "" && e.PublishableKey != "" {
			e.ID = seedEmbedID(e.PublishableKey)
		}
		if err := s.Create(e); err != nil {
			return err
		}
	}
	return nil
}

// seedEmbedID derives a stable embed id from a publishable key so file-seeded
// embeds keep the same id (and thus the same persisted spend counter) across
// broker restarts.
func seedEmbedID(pk string) string {
	sum := sha256.Sum256([]byte("seed:" + pk))
	return "emb_" + hex.EncodeToString(sum[:])[:20]
}
