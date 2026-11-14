package api

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

// Stable error codes of the envelope {"error":{"code":"...","message":"..."}}.
const (
	CodeBadRequest  = "bad_request"
	CodeNotFound    = "not_found"
	CodeInternal    = "internal"
	CodeUnavailable = "unavailable"
)

// ErrorEnvelope is the one JSON error shape every API failure uses.
type ErrorEnvelope struct {
	Error ErrorBody `json:"error"`
}

// ErrorBody is the inside of the envelope.
type ErrorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// WriteError writes the error envelope. message must be safe to show a client:
// never a secret, a path or a raw internal error.
func WriteError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(ErrorEnvelope{Error: ErrorBody{Code: code, Message: message}}); err != nil {
		slog.Default().Warn("write error envelope", "err", err)
	}
}

func notFound(w http.ResponseWriter, _ *http.Request) {
	WriteError(w, http.StatusNotFound, CodeNotFound, "no such API route")
}
