// Code below is the REG10 contract stub set of REG9 (pull-through mirror): each operation answers
// 501 until that task replaces it with its handler and deletes it here. Only
// REG9 edits this file (docs/features/registry section 12).

package api

import (
	"context"
	"net/http"

	"github.com/luis-mc/ci-runners-shared-pool/internal/api/gen"
)

// GetRegistryMirrorSettings is not built yet.
func (s *server) GetRegistryMirrorSettings(_ context.Context, _ gen.GetRegistryMirrorSettingsRequestObject) (gen.GetRegistryMirrorSettingsResponseObject, error) {
	return gen.GetRegistryMirrorSettingsdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// PutRegistryMirrorSettings is not built yet.
func (s *server) PutRegistryMirrorSettings(_ context.Context, _ gen.PutRegistryMirrorSettingsRequestObject) (gen.PutRegistryMirrorSettingsResponseObject, error) {
	return gen.PutRegistryMirrorSettingsdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}
