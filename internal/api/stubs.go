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

// CreateNotificationChannel is not built yet.
func (s *server) CreateNotificationChannel(_ context.Context, _ gen.CreateNotificationChannelRequestObject) (gen.CreateNotificationChannelResponseObject, error) {
	return gen.CreateNotificationChanneldefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// DeleteNotificationChannel is not built yet.
func (s *server) DeleteNotificationChannel(_ context.Context, _ gen.DeleteNotificationChannelRequestObject) (gen.DeleteNotificationChannelResponseObject, error) {
	return gen.DeleteNotificationChanneldefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// ExportAuditEvents is not built yet.
func (s *server) ExportAuditEvents(_ context.Context, _ gen.ExportAuditEventsRequestObject) (gen.ExportAuditEventsResponseObject, error) {
	return gen.ExportAuditEventsdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// ExportConfig is not built yet.
func (s *server) ExportConfig(_ context.Context, _ gen.ExportConfigRequestObject) (gen.ExportConfigResponseObject, error) {
	return gen.ExportConfigdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
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

// ListNotificationChannels is not built yet.
func (s *server) ListNotificationChannels(_ context.Context, _ gen.ListNotificationChannelsRequestObject) (gen.ListNotificationChannelsResponseObject, error) {
	return gen.ListNotificationChannelsdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// RebuildImage is not built yet.
func (s *server) RebuildImage(_ context.Context, _ gen.RebuildImageRequestObject) (gen.RebuildImageResponseObject, error) {
	return gen.RebuildImagedefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// StopRepositoryPlan is not built yet.
func (s *server) StopRepositoryPlan(_ context.Context, _ gen.StopRepositoryPlanRequestObject) (gen.StopRepositoryPlanResponseObject, error) {
	return gen.StopRepositoryPlandefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// StopRunnerPlan is not built yet.
func (s *server) StopRunnerPlan(_ context.Context, _ gen.StopRunnerPlanRequestObject) (gen.StopRunnerPlanResponseObject, error) {
	return gen.StopRunnerPlandefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// TestNotificationChannel is not built yet.
func (s *server) TestNotificationChannel(_ context.Context, _ gen.TestNotificationChannelRequestObject) (gen.TestNotificationChannelResponseObject, error) {
	return gen.TestNotificationChanneldefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// UpdateImageLayers is not built yet.
func (s *server) UpdateImageLayers(_ context.Context, _ gen.UpdateImageLayersRequestObject) (gen.UpdateImageLayersResponseObject, error) {
	return gen.UpdateImageLayersdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// UpdateNotificationChannel is not built yet.
func (s *server) UpdateNotificationChannel(_ context.Context, _ gen.UpdateNotificationChannelRequestObject) (gen.UpdateNotificationChannelResponseObject, error) {
	return gen.UpdateNotificationChanneldefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// WipeCache is not built yet.
func (s *server) WipeCache(_ context.Context, _ gen.WipeCacheRequestObject) (gen.WipeCacheResponseObject, error) {
	return gen.WipeCachedefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}
