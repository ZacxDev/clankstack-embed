package broker

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// adminCookieName is the name of the admin session cookie.
const adminCookieName = "kc_admin"

// adminSessionTTL is how long an admin login stays valid.
const adminSessionTTL = 12 * time.Hour

// adminSigner mints and verifies the admin session cookie. The cookie is a
// dedicated HMAC token (NOT a cs_ JWT): value is "<expiryUnix>.<base64url(hmac)>"
// where the HMAC is keyed by the broker's JWT secret over a domain-separated
// message. This keeps admin sessions unforgeable without minting a visitor token.
type adminSigner struct {
	secret []byte
	nowFn  func() time.Time
}

// newAdminSigner builds a signer over the broker's HS256 secret material.
func newAdminSigner(secret []byte) *adminSigner {
	return &adminSigner{secret: secret, nowFn: time.Now}
}

// errBadAdminCookie is returned when an admin cookie is malformed, mis-signed,
// or expired.
var errBadAdminCookie = errors.New("invalid admin session cookie")

// adminCookieMsg is the domain-separated message that is HMAC'd. Domain
// separation ("admin-session|") ensures these tokens can never be confused with
// cs_ JWTs signed by the same secret.
func adminCookieMsg(expiry int64) []byte {
	return []byte("admin-session|" + strconv.FormatInt(expiry, 10))
}

// sign returns a cookie value valid until now+adminSessionTTL.
func (a *adminSigner) sign() string {
	exp := a.nowFn().Add(adminSessionTTL).Unix()
	mac := hmac.New(sha256.New, a.secret)
	mac.Write(adminCookieMsg(exp))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return strconv.FormatInt(exp, 10) + "." + sig
}

// verify validates a cookie value, enforcing the signature and expiry.
func (a *adminSigner) verify(value string) error {
	dot := strings.IndexByte(value, '.')
	if dot <= 0 {
		return errBadAdminCookie
	}
	expStr, sigStr := value[:dot], value[dot+1:]
	exp, err := strconv.ParseInt(expStr, 10, 64)
	if err != nil {
		return errBadAdminCookie
	}
	got, err := base64.RawURLEncoding.DecodeString(sigStr)
	if err != nil {
		return errBadAdminCookie
	}
	mac := hmac.New(sha256.New, a.secret)
	mac.Write(adminCookieMsg(exp))
	want := mac.Sum(nil)
	if subtle.ConstantTimeCompare(got, want) != 1 {
		return errBadAdminCookie
	}
	if a.nowFn().Unix() >= exp {
		return errBadAdminCookie
	}
	return nil
}

// setAdminCookie writes a fresh, signed admin session cookie.
func (a *adminSigner) setAdminCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     adminCookieName,
		Value:    a.sign(),
		Path:     "/admin",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(adminSessionTTL / time.Second),
	})
}

// clearAdminCookie expires the admin session cookie.
func clearAdminCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     adminCookieName,
		Value:    "",
		Path:     "/admin",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
}

// authenticated reports whether the request carries a valid admin cookie.
func (a *adminSigner) authenticated(r *http.Request) bool {
	c, err := r.Cookie(adminCookieName)
	if err != nil {
		return false
	}
	return a.verify(c.Value) == nil
}
