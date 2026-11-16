package api

import (
	"context"
	"net/http"

	"github.com/luis-mc/ci-runners-shared-pool/internal/api/gen"
)

// GetPublicRepositories implements GET /api/v1/settings/public-repositories.
func (s *server) GetPublicRepositories(_ context.Context, _ gen.GetPublicRepositoriesRequestObject) (gen.GetPublicRepositoriesResponseObject, error) {
	return gen.GetPublicRepositoriesdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// SetPublicRepositories implements PUT /api/v1/settings/public-repositories.
func (s *server) SetPublicRepositories(_ context.Context, _ gen.SetPublicRepositoriesRequestObject) (gen.SetPublicRepositoriesResponseObject, error) {
	return gen.SetPublicRepositoriesdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}
