// Code below is the REG10 contract stub set of REG6 (retention): each operation answers
// 501 until that task replaces it with its handler and deletes it here. Only
// REG6 edits this file (docs/features/registry section 12).

package api

import (
	"context"
	"net/http"

	"github.com/luis-mc/ci-runners-shared-pool/internal/api/gen"
)

// DeleteRegistryImage is not built yet.
func (s *server) DeleteRegistryImage(_ context.Context, _ gen.DeleteRegistryImageRequestObject) (gen.DeleteRegistryImageResponseObject, error) {
	return gen.DeleteRegistryImagedefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetRegistryBudgets is not built yet.
func (s *server) GetRegistryBudgets(_ context.Context, _ gen.GetRegistryBudgetsRequestObject) (gen.GetRegistryBudgetsResponseObject, error) {
	return gen.GetRegistryBudgetsdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// PutRegistryBudgets is not built yet.
func (s *server) PutRegistryBudgets(_ context.Context, _ gen.PutRegistryBudgetsRequestObject) (gen.PutRegistryBudgetsResponseObject, error) {
	return gen.PutRegistryBudgetsdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetRegistryStoreSettings is not built yet.
func (s *server) GetRegistryStoreSettings(_ context.Context, _ gen.GetRegistryStoreSettingsRequestObject) (gen.GetRegistryStoreSettingsResponseObject, error) {
	return gen.GetRegistryStoreSettingsdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// PutRegistryStoreSettings is not built yet.
func (s *server) PutRegistryStoreSettings(_ context.Context, _ gen.PutRegistryStoreSettingsRequestObject) (gen.PutRegistryStoreSettingsResponseObject, error) {
	return gen.PutRegistryStoreSettingsdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// StartRegistryCleanup is not built yet.
func (s *server) StartRegistryCleanup(_ context.Context, _ gen.StartRegistryCleanupRequestObject) (gen.StartRegistryCleanupResponseObject, error) {
	return gen.StartRegistryCleanupdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}
