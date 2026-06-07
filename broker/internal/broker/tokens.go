package broker

import (
	"errors"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// csPrefix is the literal prefix on client-session tokens. The remainder is an
// HS256 JWT.
const csPrefix = "cs_"

// sessionClaims are the JWT claims embedded in a cs_ token.
type sessionClaims struct {
	EmbedID   string `json:"embed_id"`
	VisitorID string `json:"visitor_id"`
	Origin    string `json:"origin"`
	Agent     string `json:"agent"`
	MsgBudget int    `json:"msg_budget"`
	TokBudget int    `json:"tok_budget"`
	jwt.RegisteredClaims
}

// TokenMinter mints and verifies cs_ client-session tokens.
type TokenMinter struct {
	secret []byte
	ttl    time.Duration
}

// NewTokenMinter builds a minter with the given HS256 secret and token TTL.
func NewTokenMinter(secret []byte, ttl time.Duration) *TokenMinter {
	return &TokenMinter{secret: secret, ttl: ttl}
}

// Mint creates a signed cs_ token for a visitor session.
func (m *TokenMinter) Mint(embedID, visitorID, origin, agent string, msgBudget, tokBudget int) (string, time.Time, error) {
	now := time.Now()
	exp := now.Add(m.ttl)
	claims := sessionClaims{
		EmbedID:   embedID,
		VisitorID: visitorID,
		Origin:    origin,
		Agent:     agent,
		MsgBudget: msgBudget,
		TokBudget: tokBudget,
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(exp),
			ID:        randBase62(16), // jti, used to key per-session counters
		},
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := tok.SignedString(m.secret)
	if err != nil {
		return "", time.Time{}, err
	}
	return csPrefix + signed, exp, nil
}

// ErrBadToken is returned when a cs_ token is malformed, mis-signed, or expired.
var ErrBadToken = errors.New("invalid client session token")

// Verify validates a cs_ token and returns its claims. It enforces the HS256
// signing method and expiry.
func (m *TokenMinter) Verify(token string) (*sessionClaims, error) {
	if !strings.HasPrefix(token, csPrefix) {
		return nil, ErrBadToken
	}
	raw := strings.TrimPrefix(token, csPrefix)
	claims := &sessionClaims{}
	parsed, err := jwt.ParseWithClaims(raw, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrBadToken
		}
		return m.secret, nil
	}, jwt.WithValidMethods([]string{"HS256"}))
	if err != nil || !parsed.Valid {
		return nil, ErrBadToken
	}
	return claims, nil
}
