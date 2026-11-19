// Code below is the REG10 contract stub set of REG4 (records, pull metrics, read API): each operation answers
// 501 until that task replaces it with its handler and deletes it here. Only
// REG4 edits this file (docs/features/registry section 12).

package api

import (
	"context"
	"net/http"

	"github.com/luis-mc/ci-runners-shared-pool/internal/api/gen"
)

// GetRegistryOverview is not built yet.
func (s *server) GetRegistryOverview(_ context.Context, _ gen.GetRegistryOverviewRequestObject) (gen.GetRegistryOverviewResponseObject, error) {
	return gen.GetRegistryOverviewdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// ListRegistryImages is not built yet.
func (s *server) ListRegistryImages(_ context.Context, _ gen.ListRegistryImagesRequestObject) (gen.ListRegistryImagesResponseObject, error) {
	return gen.ListRegistryImagesdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetRegistryImage is not built yet.
func (s *server) GetRegistryImage(_ context.Context, _ gen.GetRegistryImageRequestObject) (gen.GetRegistryImageResponseObject, error) {
	return gen.GetRegistryImagedefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// ListRegistryPulls is not built yet.
func (s *server) ListRegistryPulls(_ context.Context, _ gen.ListRegistryPullsRequestObject) (gen.ListRegistryPullsResponseObject, error) {
	return gen.ListRegistryPullsdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}
