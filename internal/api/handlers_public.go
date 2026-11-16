package api

import (
	"context"
	"net/http"

	"github.com/luis-mc/ci-runners-shared-pool/internal/api/gen"
)

// GetPublicRepositories implements GET /api/v1/settings/public-repositories.
func (s *server) GetPublicRepositories(_ context.Context, _ gen.GetPublicRepositoriesRequestObject) (gen.GetPublicRepositoriesResponseObject, error) {
	f := envelope(http.StatusNotImplemented, CodeBadRequest, "not built yet")
	return gen.GetPublicRepositoriesdefaultJSONResponse{StatusCode: f.status, Body: f.body}, nil
}

// SetPublicRepositories implements PUT /api/v1/settings/public-repositories.
func (s *server) SetPublicRepositories(_ context.Context, _ gen.SetPublicRepositoriesRequestObject) (gen.SetPublicRepositoriesResponseObject, error) {
	f := envelope(http.StatusNotImplemented, CodeBadRequest, "not built yet")
	return gen.SetPublicRepositoriesdefaultJSONResponse{StatusCode: f.status, Body: f.body}, nil
}
