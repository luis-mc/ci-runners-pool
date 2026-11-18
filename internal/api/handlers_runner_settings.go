package api

import (
	"context"
	"net/http"

	"github.com/luis-mc/ci-runners-shared-pool/internal/api/gen"
)

// UpdateRunnerSettings implements PATCH /api/v1/runners/{runnerId}/settings (runners R5.89).
func (s *server) UpdateRunnerSettings(_ context.Context, _ gen.UpdateRunnerSettingsRequestObject) (gen.UpdateRunnerSettingsResponseObject, error) {
	return gen.UpdateRunnerSettingsdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// ClearRunnerCache implements POST /api/v1/runners/{runnerId}/clear-cache (runners R5.89).
func (s *server) ClearRunnerCache(_ context.Context, _ gen.ClearRunnerCacheRequestObject) (gen.ClearRunnerCacheResponseObject, error) {
	return gen.ClearRunnerCachedefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}
