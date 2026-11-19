// Code below is the REG10 contract stub set of IMG1 (build truth): each operation answers
// 501 until that task replaces it with its handler and deletes it here. Only
// IMG1 edits this file (docs/features/registry section 12).

package api

import (
	"context"
	"net/http"

	"github.com/luis-mc/ci-runners-shared-pool/internal/api/gen"
)

// ListImageBuilds is not built yet.
func (s *server) ListImageBuilds(_ context.Context, _ gen.ListImageBuildsRequestObject) (gen.ListImageBuildsResponseObject, error) {
	return gen.ListImageBuildsdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetImageBuild is not built yet.
func (s *server) GetImageBuild(_ context.Context, _ gen.GetImageBuildRequestObject) (gen.GetImageBuildResponseObject, error) {
	return gen.GetImageBuilddefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}
