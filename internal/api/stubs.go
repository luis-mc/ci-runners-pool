// Code below is the CRSP17 contract stub set: one method per operation of
// packages/contract/openapi.yaml that is not built yet. Each answers 501 with
// the error envelope, so the routes exist and the route-coverage tests pass.
// A feature branch replaces a stub with its handler and deletes it here.

package api

import (
	"context"
	"net/http"

	"github.com/luis-mc/ci-runners-shared-pool/internal/api/gen"
)

// notImplemented is the envelope every stub answers with.
func notImplemented() gen.ErrorEnvelope {
	return gen.ErrorEnvelope{Error: gen.ErrorBody{Code: CodeNotImplemented, Message: "this operation is not built yet"}}
}

// CreateConsoleLink is not built yet.
func (s *server) CreateConsoleLink(_ context.Context, _ gen.CreateConsoleLinkRequestObject) (gen.CreateConsoleLinkResponseObject, error) {
	return gen.CreateConsoleLinkdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetPoolSettings is not built yet.
func (s *server) GetPoolSettings(_ context.Context, _ gen.GetPoolSettingsRequestObject) (gen.GetPoolSettingsResponseObject, error) {
	return gen.GetPoolSettingsdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetQueueSettings is not built yet.
func (s *server) GetQueueSettings(_ context.Context, _ gen.GetQueueSettingsRequestObject) (gen.GetQueueSettingsResponseObject, error) {
	return gen.GetQueueSettingsdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// UpdatePoolSettings is not built yet.
func (s *server) UpdatePoolSettings(_ context.Context, _ gen.UpdatePoolSettingsRequestObject) (gen.UpdatePoolSettingsResponseObject, error) {
	return gen.UpdatePoolSettingsdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// UpdateQueueSettings is not built yet.
func (s *server) UpdateQueueSettings(_ context.Context, _ gen.UpdateQueueSettingsRequestObject) (gen.UpdateQueueSettingsResponseObject, error) {
	return gen.UpdateQueueSettingsdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}
