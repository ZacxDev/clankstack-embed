package broker

import (
	"encoding/json"
	"net/http"
)

// apiError is the JSON error envelope returned by all non-streaming endpoints.
//
//	{ "error": { "code": "...", "message": "..." } }
type apiError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	// status is the HTTP status to send; not serialized.
	status int
}

func (e *apiError) Error() string { return e.Code + ": " + e.Message }

// newAPIError builds an apiError with an HTTP status, code and message.
func newAPIError(status int, code, message string) *apiError {
	return &apiError{Code: code, Message: message, status: status}
}

// Predefined errors used across handlers. Statuses follow the wire contract.
var (
	errEmbedNotFound  = func() *apiError { return newAPIError(http.StatusNotFound, "embed_not_found", "embed not found or disabled") }
	errOriginDenied   = func() *apiError { return newAPIError(http.StatusForbidden, "origin_denied", "origin not allowed for this embed") }
	errRateLimited    = func() *apiError { return newAPIError(http.StatusTooManyRequests, "rate_limited", "too many session requests, slow down") }
	errQuotaExceeded  = func() *apiError { return newAPIError(http.StatusTooManyRequests, "quota_exceeded", "daily token budget exhausted") }
	errInvalidSession = func() *apiError { return newAPIError(http.StatusUnauthorized, "invalid_session", "session token missing, invalid, or expired") }
	errBadRequest     = func(msg string) *apiError { return newAPIError(http.StatusBadRequest, "bad_request", msg) }
	errUnauthorized   = func() *apiError { return newAPIError(http.StatusUnauthorized, "unauthorized", "valid secret key required") }
	errInternal       = func() *apiError { return newAPIError(http.StatusInternalServerError, "internal_error", "internal server error") }
)

// writeError serializes an error to the response. If err is not an *apiError it
// is wrapped as a 500.
func writeError(w http.ResponseWriter, err error) {
	ae, ok := err.(*apiError)
	if !ok {
		ae = errInternal()
	}
	writeJSON(w, ae.status, map[string]any{
		"error": map[string]string{"code": ae.Code, "message": ae.Message},
	})
}

// writeJSON serializes v as JSON with the given status code.
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
