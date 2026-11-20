// Contract stubs of CI run insights (CIX8, docs/features/ci-run-insights R5.42): one method per insights
// operation of packages/contract/openapi.yaml. Each answers 501 with the error envelope until the CIX API task
// replaces it with its handler (internal/api/handlers_insights*.go) and deletes it here.

package api

import (
	"context"
	"net/http"

	"github.com/luis-mc/ci-runners-shared-pool/internal/api/gen"
)

// ListInsightFindings is not built yet.
func (s *server) ListInsightFindings(_ context.Context, _ gen.ListInsightFindingsRequestObject) (gen.ListInsightFindingsResponseObject, error) {
	return gen.ListInsightFindingsdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetInsightFinding is not built yet.
func (s *server) GetInsightFinding(_ context.Context, _ gen.GetInsightFindingRequestObject) (gen.GetInsightFindingResponseObject, error) {
	return gen.GetInsightFindingdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// CreateInsightPlan is not built yet.
func (s *server) CreateInsightPlan(_ context.Context, _ gen.CreateInsightPlanRequestObject) (gen.CreateInsightPlanResponseObject, error) {
	return gen.CreateInsightPlandefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetInsightPlan is not built yet.
func (s *server) GetInsightPlan(_ context.Context, _ gen.GetInsightPlanRequestObject) (gen.GetInsightPlanResponseObject, error) {
	return gen.GetInsightPlandefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// StartInsightPlan is not built yet.
func (s *server) StartInsightPlan(_ context.Context, _ gen.StartInsightPlanRequestObject) (gen.StartInsightPlanResponseObject, error) {
	return gen.StartInsightPlandefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetInsightSummary is not built yet.
func (s *server) GetInsightSummary(_ context.Context, _ gen.GetInsightSummaryRequestObject) (gen.GetInsightSummaryResponseObject, error) {
	return gen.GetInsightSummarydefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetWaitSplit is not built yet.
func (s *server) GetWaitSplit(_ context.Context, _ gen.GetWaitSplitRequestObject) (gen.GetWaitSplitResponseObject, error) {
	return gen.GetWaitSplitdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetPoolTimeline is not built yet.
func (s *server) GetPoolTimeline(_ context.Context, _ gen.GetPoolTimelineRequestObject) (gen.GetPoolTimelineResponseObject, error) {
	return gen.GetPoolTimelinedefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetPoolSizing is not built yet.
func (s *server) GetPoolSizing(_ context.Context, _ gen.GetPoolSizingRequestObject) (gen.GetPoolSizingResponseObject, error) {
	return gen.GetPoolSizingdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// ListTestInsights is not built yet.
func (s *server) ListTestInsights(_ context.Context, _ gen.ListTestInsightsRequestObject) (gen.ListTestInsightsResponseObject, error) {
	return gen.ListTestInsightsdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// ListGuardrailStatus is not built yet.
func (s *server) ListGuardrailStatus(_ context.Context, _ gen.ListGuardrailStatusRequestObject) (gen.ListGuardrailStatusResponseObject, error) {
	return gen.ListGuardrailStatusdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// ListInsightDigests is not built yet.
func (s *server) ListInsightDigests(_ context.Context, _ gen.ListInsightDigestsRequestObject) (gen.ListInsightDigestsResponseObject, error) {
	return gen.ListInsightDigestsdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetRunSavings is not built yet.
func (s *server) GetRunSavings(_ context.Context, _ gen.GetRunSavingsRequestObject) (gen.GetRunSavingsResponseObject, error) {
	return gen.GetRunSavingsdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// ListWorkflowChecks is not built yet.
func (s *server) ListWorkflowChecks(_ context.Context, _ gen.ListWorkflowChecksRequestObject) (gen.ListWorkflowChecksResponseObject, error) {
	return gen.ListWorkflowChecksdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetJobResources is not built yet.
func (s *server) GetJobResources(_ context.Context, _ gen.GetJobResourcesRequestObject) (gen.GetJobResourcesResponseObject, error) {
	return gen.GetJobResourcesdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}
