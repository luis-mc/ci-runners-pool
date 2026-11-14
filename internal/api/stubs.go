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

// AddUser is not built yet.
func (s *server) AddUser(_ context.Context, _ gen.AddUserRequestObject) (gen.AddUserResponseObject, error) {
	return gen.AddUserdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// ApplyRepositoryChanges is not built yet.
func (s *server) ApplyRepositoryChanges(_ context.Context, _ gen.ApplyRepositoryChangesRequestObject) (gen.ApplyRepositoryChangesResponseObject, error) {
	return gen.ApplyRepositoryChangesdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// CompleteAppManifest is not built yet.
func (s *server) CompleteAppManifest(_ context.Context, _ gen.CompleteAppManifestRequestObject) (gen.CompleteAppManifestResponseObject, error) {
	return gen.CompleteAppManifestdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// CompleteSignIn is not built yet.
func (s *server) CompleteSignIn(_ context.Context, _ gen.CompleteSignInRequestObject) (gen.CompleteSignInResponseObject, error) {
	return gen.CompleteSignIndefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// CreateJoinCode is not built yet.
func (s *server) CreateJoinCode(_ context.Context, _ gen.CreateJoinCodeRequestObject) (gen.CreateJoinCodeResponseObject, error) {
	return gen.CreateJoinCodedefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// CreateRunners is not built yet.
func (s *server) CreateRunners(_ context.Context, _ gen.CreateRunnersRequestObject) (gen.CreateRunnersResponseObject, error) {
	return gen.CreateRunnersdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// DecideMachineChange is not built yet.
func (s *server) DecideMachineChange(_ context.Context, _ gen.DecideMachineChangeRequestObject) (gen.DecideMachineChangeResponseObject, error) {
	return gen.DecideMachineChangedefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// DeleteRunner is not built yet.
func (s *server) DeleteRunner(_ context.Context, _ gen.DeleteRunnerRequestObject) (gen.DeleteRunnerResponseObject, error) {
	return gen.DeleteRunnerdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// DrainMachine is not built yet.
func (s *server) DrainMachine(_ context.Context, _ gen.DrainMachineRequestObject) (gen.DrainMachineResponseObject, error) {
	return gen.DrainMachinedefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// ExchangeCliToken is not built yet.
func (s *server) ExchangeCliToken(_ context.Context, _ gen.ExchangeCliTokenRequestObject) (gen.ExchangeCliTokenResponseObject, error) {
	return gen.ExchangeCliTokendefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// FreeStaleSlots is not built yet.
func (s *server) FreeStaleSlots(_ context.Context, _ gen.FreeStaleSlotsRequestObject) (gen.FreeStaleSlotsResponseObject, error) {
	return gen.FreeStaleSlotsdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetAppInstallUrl is not built yet.
func (s *server) GetAppInstallUrl(_ context.Context, _ gen.GetAppInstallUrlRequestObject) (gen.GetAppInstallUrlResponseObject, error) {
	return gen.GetAppInstallUrldefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetCaCertificate is not built yet.
func (s *server) GetCaCertificate(_ context.Context, _ gen.GetCaCertificateRequestObject) (gen.GetCaCertificateResponseObject, error) {
	return gen.GetCaCertificatedefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetCliLoginConfig is not built yet.
func (s *server) GetCliLoginConfig(_ context.Context, _ gen.GetCliLoginConfigRequestObject) (gen.GetCliLoginConfigResponseObject, error) {
	return gen.GetCliLoginConfigdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetDoctorRun is not built yet.
func (s *server) GetDoctorRun(_ context.Context, _ gen.GetDoctorRunRequestObject) (gen.GetDoctorRunResponseObject, error) {
	return gen.GetDoctorRundefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetInstallCommand is not built yet.
func (s *server) GetInstallCommand(_ context.Context, _ gen.GetInstallCommandRequestObject) (gen.GetInstallCommandResponseObject, error) {
	return gen.GetInstallCommanddefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetJob is not built yet.
func (s *server) GetJob(_ context.Context, _ gen.GetJobRequestObject) (gen.GetJobResponseObject, error) {
	return gen.GetJobdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetJoinCode is not built yet.
func (s *server) GetJoinCode(_ context.Context, _ gen.GetJoinCodeRequestObject) (gen.GetJoinCodeResponseObject, error) {
	return gen.GetJoinCodedefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetMachine is not built yet.
func (s *server) GetMachine(_ context.Context, _ gen.GetMachineRequestObject) (gen.GetMachineResponseObject, error) {
	return gen.GetMachinedefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetMachineChange is not built yet.
func (s *server) GetMachineChange(_ context.Context, _ gen.GetMachineChangeRequestObject) (gen.GetMachineChangeResponseObject, error) {
	return gen.GetMachineChangedefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetMachineLoad is not built yet.
func (s *server) GetMachineLoad(_ context.Context, _ gen.GetMachineLoadRequestObject) (gen.GetMachineLoadResponseObject, error) {
	return gen.GetMachineLoaddefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetOverview is not built yet.
func (s *server) GetOverview(_ context.Context, _ gen.GetOverviewRequestObject) (gen.GetOverviewResponseObject, error) {
	return gen.GetOverviewdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetPoolSettings is not built yet.
func (s *server) GetPoolSettings(_ context.Context, _ gen.GetPoolSettingsRequestObject) (gen.GetPoolSettingsResponseObject, error) {
	return gen.GetPoolSettingsdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetPreferences is not built yet.
func (s *server) GetPreferences(_ context.Context, _ gen.GetPreferencesRequestObject) (gen.GetPreferencesResponseObject, error) {
	return gen.GetPreferencesdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetQueueSettings is not built yet.
func (s *server) GetQueueSettings(_ context.Context, _ gen.GetQueueSettingsRequestObject) (gen.GetQueueSettingsResponseObject, error) {
	return gen.GetQueueSettingsdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetRepository is not built yet.
func (s *server) GetRepository(_ context.Context, _ gen.GetRepositoryRequestObject) (gen.GetRepositoryResponseObject, error) {
	return gen.GetRepositorydefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetRepositoryPlan is not built yet.
func (s *server) GetRepositoryPlan(_ context.Context, _ gen.GetRepositoryPlanRequestObject) (gen.GetRepositoryPlanResponseObject, error) {
	return gen.GetRepositoryPlandefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetRepositoryRunsOn is not built yet.
func (s *server) GetRepositoryRunsOn(_ context.Context, _ gen.GetRepositoryRunsOnRequestObject) (gen.GetRepositoryRunsOnResponseObject, error) {
	return gen.GetRepositoryRunsOndefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetRunner is not built yet.
func (s *server) GetRunner(_ context.Context, _ gen.GetRunnerRequestObject) (gen.GetRunnerResponseObject, error) {
	return gen.GetRunnerdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetRunnerPlan is not built yet.
func (s *server) GetRunnerPlan(_ context.Context, _ gen.GetRunnerPlanRequestObject) (gen.GetRunnerPlanResponseObject, error) {
	return gen.GetRunnerPlandefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetSession is not built yet.
func (s *server) GetSession(_ context.Context, _ gen.GetSessionRequestObject) (gen.GetSessionResponseObject, error) {
	return gen.GetSessiondefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetSettings is not built yet.
func (s *server) GetSettings(_ context.Context, _ gen.GetSettingsRequestObject) (gen.GetSettingsResponseObject, error) {
	return gen.GetSettingsdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// GetSetupState is not built yet.
func (s *server) GetSetupState(_ context.Context, _ gen.GetSetupStateRequestObject) (gen.GetSetupStateResponseObject, error) {
	return gen.GetSetupStatedefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// ListAuditEvents is not built yet.
func (s *server) ListAuditEvents(_ context.Context, _ gen.ListAuditEventsRequestObject) (gen.ListAuditEventsResponseObject, error) {
	return gen.ListAuditEventsdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// ListBackups is not built yet.
func (s *server) ListBackups(_ context.Context, _ gen.ListBackupsRequestObject) (gen.ListBackupsResponseObject, error) {
	return gen.ListBackupsdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// ListCliTokens is not built yet.
func (s *server) ListCliTokens(_ context.Context, _ gen.ListCliTokensRequestObject) (gen.ListCliTokensResponseObject, error) {
	return gen.ListCliTokensdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// ListDoctorFindings is not built yet.
func (s *server) ListDoctorFindings(_ context.Context, _ gen.ListDoctorFindingsRequestObject) (gen.ListDoctorFindingsResponseObject, error) {
	return gen.ListDoctorFindingsdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// ListInstallations is not built yet.
func (s *server) ListInstallations(_ context.Context, _ gen.ListInstallationsRequestObject) (gen.ListInstallationsResponseObject, error) {
	return gen.ListInstallationsdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// ListJobs is not built yet.
func (s *server) ListJobs(_ context.Context, _ gen.ListJobsRequestObject) (gen.ListJobsResponseObject, error) {
	return gen.ListJobsdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// ListMachines is not built yet.
func (s *server) ListMachines(_ context.Context, _ gen.ListMachinesRequestObject) (gen.ListMachinesResponseObject, error) {
	return gen.ListMachinesdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// ListRepositories is not built yet.
func (s *server) ListRepositories(_ context.Context, _ gen.ListRepositoriesRequestObject) (gen.ListRepositoriesResponseObject, error) {
	return gen.ListRepositoriesdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// ListRunners is not built yet.
func (s *server) ListRunners(_ context.Context, _ gen.ListRunnersRequestObject) (gen.ListRunnersResponseObject, error) {
	return gen.ListRunnersdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// ListSlots is not built yet.
func (s *server) ListSlots(_ context.Context, _ gen.ListSlotsRequestObject) (gen.ListSlotsResponseObject, error) {
	return gen.ListSlotsdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// ListUsers is not built yet.
func (s *server) ListUsers(_ context.Context, _ gen.ListUsersRequestObject) (gen.ListUsersResponseObject, error) {
	return gen.ListUsersdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// PlanRepositoryChanges is not built yet.
func (s *server) PlanRepositoryChanges(_ context.Context, _ gen.PlanRepositoryChangesRequestObject) (gen.PlanRepositoryChangesResponseObject, error) {
	return gen.PlanRepositoryChangesdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// PlanRunnerReplacement is not built yet.
func (s *server) PlanRunnerReplacement(_ context.Context, _ gen.PlanRunnerReplacementRequestObject) (gen.PlanRunnerReplacementResponseObject, error) {
	return gen.PlanRunnerReplacementdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// PlanRunners is not built yet.
func (s *server) PlanRunners(_ context.Context, _ gen.PlanRunnersRequestObject) (gen.PlanRunnersResponseObject, error) {
	return gen.PlanRunnersdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// ReceiveGithubWebhook is not built yet.
func (s *server) ReceiveGithubWebhook(_ context.Context, _ gen.ReceiveGithubWebhookRequestObject) (gen.ReceiveGithubWebhookResponseObject, error) {
	return gen.ReceiveGithubWebhookdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// RedeemSetupLink is not built yet.
func (s *server) RedeemSetupLink(_ context.Context, _ gen.RedeemSetupLinkRequestObject) (gen.RedeemSetupLinkResponseObject, error) {
	return gen.RedeemSetupLinkdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// RedeemTrayLink is not built yet.
func (s *server) RedeemTrayLink(_ context.Context, _ gen.RedeemTrayLinkRequestObject) (gen.RedeemTrayLinkResponseObject, error) {
	return gen.RedeemTrayLinkdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// RedetectMachine is not built yet.
func (s *server) RedetectMachine(_ context.Context, _ gen.RedetectMachineRequestObject) (gen.RedetectMachineResponseObject, error) {
	return gen.RedetectMachinedefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// RemoveMachine is not built yet.
func (s *server) RemoveMachine(_ context.Context, _ gen.RemoveMachineRequestObject) (gen.RemoveMachineResponseObject, error) {
	return gen.RemoveMachinedefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// RemoveUser is not built yet.
func (s *server) RemoveUser(_ context.Context, _ gen.RemoveUserRequestObject) (gen.RemoveUserResponseObject, error) {
	return gen.RemoveUserdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// RestoreBackup is not built yet.
func (s *server) RestoreBackup(_ context.Context, _ gen.RestoreBackupRequestObject) (gen.RestoreBackupResponseObject, error) {
	return gen.RestoreBackupdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// ResumeMachine is not built yet.
func (s *server) ResumeMachine(_ context.Context, _ gen.ResumeMachineRequestObject) (gen.ResumeMachineResponseObject, error) {
	return gen.ResumeMachinedefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// RevokeCliToken is not built yet.
func (s *server) RevokeCliToken(_ context.Context, _ gen.RevokeCliTokenRequestObject) (gen.RevokeCliTokenResponseObject, error) {
	return gen.RevokeCliTokendefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// RevokeJoinCode is not built yet.
func (s *server) RevokeJoinCode(_ context.Context, _ gen.RevokeJoinCodeRequestObject) (gen.RevokeJoinCodeResponseObject, error) {
	return gen.RevokeJoinCodedefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// RunBackup is not built yet.
func (s *server) RunBackup(_ context.Context, _ gen.RunBackupRequestObject) (gen.RunBackupResponseObject, error) {
	return gen.RunBackupdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// RunBackupDrill is not built yet.
func (s *server) RunBackupDrill(_ context.Context, _ gen.RunBackupDrillRequestObject) (gen.RunBackupDrillResponseObject, error) {
	return gen.RunBackupDrilldefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// RunDoctor is not built yet.
func (s *server) RunDoctor(_ context.Context, _ gen.RunDoctorRequestObject) (gen.RunDoctorResponseObject, error) {
	return gen.RunDoctordefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// SignOut is not built yet.
func (s *server) SignOut(_ context.Context, _ gen.SignOutRequestObject) (gen.SignOutResponseObject, error) {
	return gen.SignOutdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// StartAppManifest is not built yet.
func (s *server) StartAppManifest(_ context.Context, _ gen.StartAppManifestRequestObject) (gen.StartAppManifestResponseObject, error) {
	return gen.StartAppManifestdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// StartSignIn is not built yet.
func (s *server) StartSignIn(_ context.Context, _ gen.StartSignInRequestObject) (gen.StartSignInResponseObject, error) {
	return gen.StartSignIndefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// StreamEvents is not built yet.
func (s *server) StreamEvents(_ context.Context, _ gen.StreamEventsRequestObject) (gen.StreamEventsResponseObject, error) {
	return gen.StreamEventsdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// UpdateMachine is not built yet.
func (s *server) UpdateMachine(_ context.Context, _ gen.UpdateMachineRequestObject) (gen.UpdateMachineResponseObject, error) {
	return gen.UpdateMachinedefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// UpdatePoolSettings is not built yet.
func (s *server) UpdatePoolSettings(_ context.Context, _ gen.UpdatePoolSettingsRequestObject) (gen.UpdatePoolSettingsResponseObject, error) {
	return gen.UpdatePoolSettingsdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// UpdatePreferences is not built yet.
func (s *server) UpdatePreferences(_ context.Context, _ gen.UpdatePreferencesRequestObject) (gen.UpdatePreferencesResponseObject, error) {
	return gen.UpdatePreferencesdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// UpdateQueueSettings is not built yet.
func (s *server) UpdateQueueSettings(_ context.Context, _ gen.UpdateQueueSettingsRequestObject) (gen.UpdateQueueSettingsResponseObject, error) {
	return gen.UpdateQueueSettingsdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// UpdateRepositoryPolicy is not built yet.
func (s *server) UpdateRepositoryPolicy(_ context.Context, _ gen.UpdateRepositoryPolicyRequestObject) (gen.UpdateRepositoryPolicyResponseObject, error) {
	return gen.UpdateRepositoryPolicydefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// UpdateSettings is not built yet.
func (s *server) UpdateSettings(_ context.Context, _ gen.UpdateSettingsRequestObject) (gen.UpdateSettingsResponseObject, error) {
	return gen.UpdateSettingsdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// UpdateUserRole is not built yet.
func (s *server) UpdateUserRole(_ context.Context, _ gen.UpdateUserRoleRequestObject) (gen.UpdateUserRoleResponseObject, error) {
	return gen.UpdateUserRoledefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}

// CreateConsoleLink is not built yet.
func (s *server) CreateConsoleLink(_ context.Context, _ gen.CreateConsoleLinkRequestObject) (gen.CreateConsoleLinkResponseObject, error) {
	return gen.CreateConsoleLinkdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
}
