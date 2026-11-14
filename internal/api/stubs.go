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

// ExportJobs is not built yet.
func (s *server) ExportJobs(_ context.Context, _ gen.ExportJobsRequestObject) (gen.ExportJobsResponseObject, error) {
	return gen.ExportJobsdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetImage is not built yet.
func (s *server) GetImage(_ context.Context, _ gen.GetImageRequestObject) (gen.GetImageResponseObject, error) {
	return gen.GetImagedefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// ListCaches is not built yet.
func (s *server) ListCaches(_ context.Context, _ gen.ListCachesRequestObject) (gen.ListCachesResponseObject, error) {
	return gen.ListCachesdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// ListImages is not built yet.
func (s *server) ListImages(_ context.Context, _ gen.ListImagesRequestObject) (gen.ListImagesResponseObject, error) {
	return gen.ListImagesdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// RebuildImage is not built yet.
func (s *server) RebuildImage(_ context.Context, _ gen.RebuildImageRequestObject) (gen.RebuildImageResponseObject, error) {
	return gen.RebuildImagedefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// UpdateImageLayers is not built yet.
func (s *server) UpdateImageLayers(_ context.Context, _ gen.UpdateImageLayersRequestObject) (gen.UpdateImageLayersResponseObject, error) {
	return gen.UpdateImageLayersdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// WipeCache is not built yet.
func (s *server) WipeCache(_ context.Context, _ gen.WipeCacheRequestObject) (gen.WipeCacheResponseObject, error) {
	return gen.WipeCachedefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}
