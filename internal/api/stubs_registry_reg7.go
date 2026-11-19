// Code below is the REG10 contract stub set of REG7 (replace and rollback): each operation answers
// 501 until that task replaces it with its handler and deletes it here. Only
// REG7 edits this file (docs/features/registry section 12).

package api

import (
	"context"
	"net/http"

	"github.com/luis-mc/ci-runners-shared-pool/internal/api/gen"
)

// CompareRegistryImage is not built yet.
func (s *server) CompareRegistryImage(_ context.Context, _ gen.CompareRegistryImageRequestObject) (gen.CompareRegistryImageResponseObject, error) {
	return gen.CompareRegistryImagedefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// CreateRegistryReplacePlan is not built yet.
func (s *server) CreateRegistryReplacePlan(_ context.Context, _ gen.CreateRegistryReplacePlanRequestObject) (gen.CreateRegistryReplacePlanResponseObject, error) {
	return gen.CreateRegistryReplacePlandefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetRegistryReplacePlan is not built yet.
func (s *server) GetRegistryReplacePlan(_ context.Context, _ gen.GetRegistryReplacePlanRequestObject) (gen.GetRegistryReplacePlanResponseObject, error) {
	return gen.GetRegistryReplacePlandefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// StartRegistryReplacePlan is not built yet.
func (s *server) StartRegistryReplacePlan(_ context.Context, _ gen.StartRegistryReplacePlanRequestObject) (gen.StartRegistryReplacePlanResponseObject, error) {
	return gen.StartRegistryReplacePlandefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// StopRegistryReplacePlan is not built yet.
func (s *server) StopRegistryReplacePlan(_ context.Context, _ gen.StopRegistryReplacePlanRequestObject) (gen.StopRegistryReplacePlanResponseObject, error) {
	return gen.StopRegistryReplacePlandefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// RollbackRegistryReplacePlan is not built yet.
func (s *server) RollbackRegistryReplacePlan(_ context.Context, _ gen.RollbackRegistryReplacePlanRequestObject) (gen.RollbackRegistryReplacePlanResponseObject, error) {
	return gen.RollbackRegistryReplacePlandefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}
