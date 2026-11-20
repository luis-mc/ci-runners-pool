package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/api/gen"
	"github.com/luis-mc/ci-runners-shared-pool/internal/registry"
	"github.com/luis-mc/ci-runners-shared-pool/internal/registry/replace"
)

// RegistryReplaceService is what the replace and rollback routes need
// (registry R5.53 to R5.58). *replace.Service implements it.
type RegistryReplaceService interface {
	registry.Replacer
	Compare(ctx context.Context, newImageID string) (replace.Comparison, error)
	View(ctx context.Context, imageID string) (replace.ImageView, error)
}

func (s *server) replaceSvc() (RegistryReplaceService, *opsFailure) {
	if s.opts.RegistryReplace == nil {
		f := unavailable()
		return nil, &f
	}
	return s.opts.RegistryReplace, nil
}

// replaceFail maps a replace error to the error envelope.
func (s *server) replaceFail(err error) opsFailure {
	switch {
	case errors.Is(err, registry.ErrNotFound):
		return envelope(http.StatusNotFound, CodeNotFound, "there is no such image or plan, or the image replaces nothing")
	case errors.Is(err, replace.ErrInvalid):
		return envelope(http.StatusBadRequest, CodeBadRequest, replace.Message(err))
	case errors.Is(err, replace.ErrConflict):
		return envelope(http.StatusConflict, CodeConflict, replace.Message(err))
	}
	s.opts.Logger.Error("registry replace", "err", err)
	return envelope(http.StatusInternalServerError, CodeInternal, "internal error")
}

func genRegistryScan(s registry.ScanState) gen.RegistryScanState {
	if s == "" {
		return gen.RegistryScanStateNotScanned
	}
	return gen.RegistryScanState(s)
}

func timePtr(t time.Time) *time.Time {
	if t.IsZero() {
		return nil
	}
	t = t.UTC()
	return &t
}

func strPtr(v string) *string {
	if v == "" {
		return nil
	}
	return &v
}

func genReplaceImage(v replace.ImageView) gen.RegistryImageSummary {
	return gen.RegistryImageSummary{
		Id: v.ID, Kind: gen.RegistryImageKind(v.Kind), Name: v.Name, Key: v.Key.String(),
		Profile: v.Profile, Arch: gen.RegistryArch(v.Arch), State: gen.RegistryImageState(v.State),
		ManifestDigest: v.Manifest, SourceRepository: strPtr(v.SourceRepository), Branch: strPtr(v.Branch),
		SizeBytes: v.SizeBytes, UniqueBytes: v.UniqueBytes, Pulls7Days: v.Pulls7,
		LastPullAt: timePtr(v.LastPullAt), KeepUntil: timePtr(v.KeepUntil),
		ScanState: genRegistryScan(v.Scan), PushedAt: v.PushedAt.UTC(),
	}
}

func replaceStepText(p registry.ReplacePlan) string {
	if p.State != registry.PlanRunning || p.StepsDone >= p.StepsTotal {
		return ""
	}
	if p.StepsDone < len(p.Repositories) {
		return fmt.Sprintf("Moving %s to the new image", p.Repositories[p.StepsDone])
	}
	if i := p.StepsDone - len(p.Repositories); i < len(p.Machines) {
		return fmt.Sprintf("Asking %s to pull the new image", p.Machines[i])
	}
	return ""
}

func (s *server) genReplacePlan(ctx context.Context, svc RegistryReplaceService, p registry.ReplacePlan) (gen.RegistryReplacePlan, error) {
	nv, err := svc.View(ctx, p.NewImageID)
	if err != nil {
		return gen.RegistryReplacePlan{}, err
	}
	ov, err := svc.View(ctx, p.OldImageID)
	if err != nil {
		return gen.RegistryReplacePlan{}, err
	}
	out := gen.RegistryReplacePlan{
		Id: p.ID, State: gen.RegistryReplacePlanState(p.State), NewImage: genReplaceImage(nv), OldImage: genReplaceImage(ov),
		KeepDays: p.KeepDays, KeepUntil: timePtr(p.KeepUntil), Repositories: nonNilStrings(p.Repositories), Machines: nonNilStrings(p.Machines),
		StepsDone: p.StepsDone, StepsTotal: p.StepsTotal, StepText: strPtr(replaceStepText(p)), Error: strPtr(p.Error),
		CreatedBy: strPtr(p.CreatedBy), CreatedAt: p.CreatedAt.UTC(), StartedAt: timePtr(p.StartedAt), FinishedAt: timePtr(p.FinishedAt),
	}
	can := p.State == registry.PlanDone && time.Now().Before(p.KeepUntil)
	out.CanRollback = &can
	return out, nil
}

func nonNilStrings(v []string) []string {
	if v == nil {
		return []string{}
	}
	return v
}

func replaceActor(ctx context.Context) string {
	if p, ok := PrincipalFrom(ctx); ok {
		return p.Login
	}
	return ""
}

// CompareRegistryImage implements GET /api/v1/registry/images/{id}/compare (R5.53).
func (s *server) CompareRegistryImage(ctx context.Context, req gen.CompareRegistryImageRequestObject) (gen.CompareRegistryImageResponseObject, error) {
	fail := func(f opsFailure) (gen.CompareRegistryImageResponseObject, error) {
		return gen.CompareRegistryImagedefaultJSONResponse{StatusCode: f.status, Body: f.body}, nil
	}
	svc, f := s.replaceSvc()
	if f != nil {
		return fail(*f)
	}
	c, err := svc.Compare(ctx, req.RegistryImageId)
	if err != nil {
		return fail(s.replaceFail(err))
	}
	out := gen.RegistryCompare{
		New: genReplaceImage(c.New), Old: genReplaceImage(c.Old), StackFiles: make([]gen.RegistryStackFileChange, 0, len(c.StackFiles)),
		BaseChanged: c.BaseChanged, SharedBytes: c.SharedBytes, FreesBytes: c.FreesBytes,
		Repositories: nonNilStrings(c.Repositories), KeepDaysDefault: c.KeepDaysDefault,
	}
	for _, sf := range c.StackFiles {
		out.StackFiles = append(out.StackFiles, gen.RegistryStackFileChange{
			Path: sf.Path, Change: gen.RegistryStackFileChangeChange(sf.Change),
			BeforeSha256: strPtr(sf.Before), AfterSha256: strPtr(sf.After),
		})
	}
	return gen.CompareRegistryImage200JSONResponse(out), nil
}

// CreateRegistryReplacePlan implements POST /api/v1/registry/replace-plans (R5.54).
func (s *server) CreateRegistryReplacePlan(ctx context.Context, req gen.CreateRegistryReplacePlanRequestObject) (gen.CreateRegistryReplacePlanResponseObject, error) {
	fail := func(f opsFailure) (gen.CreateRegistryReplacePlanResponseObject, error) {
		return gen.CreateRegistryReplacePlandefaultJSONResponse{StatusCode: f.status, Body: f.body}, nil
	}
	svc, f := s.replaceSvc()
	if f != nil {
		return fail(*f)
	}
	if req.Body == nil || strings.TrimSpace(req.Body.NewImageId) == "" {
		return fail(envelope(http.StatusBadRequest, CodeBadRequest, "the request is not valid"))
	}
	p, err := svc.CreatePlan(ctx, req.Body.NewImageId, req.Body.KeepDays, replaceActor(ctx))
	if err != nil {
		return fail(s.replaceFail(err))
	}
	out, err := s.genReplacePlan(ctx, svc, p)
	if err != nil {
		return fail(s.replaceFail(err))
	}
	return gen.CreateRegistryReplacePlan201JSONResponse(out), nil
}

// GetRegistryReplacePlan implements GET /api/v1/registry/replace-plans/{planId} (R5.55, R5.58).
func (s *server) GetRegistryReplacePlan(ctx context.Context, req gen.GetRegistryReplacePlanRequestObject) (gen.GetRegistryReplacePlanResponseObject, error) {
	fail := func(f opsFailure) (gen.GetRegistryReplacePlanResponseObject, error) {
		return gen.GetRegistryReplacePlandefaultJSONResponse{StatusCode: f.status, Body: f.body}, nil
	}
	svc, f := s.replaceSvc()
	if f != nil {
		return fail(*f)
	}
	p, err := svc.Plan(ctx, req.PlanId)
	if err != nil {
		return fail(s.replaceFail(err))
	}
	out, err := s.genReplacePlan(ctx, svc, p)
	if err != nil {
		return fail(s.replaceFail(err))
	}
	return gen.GetRegistryReplacePlan200JSONResponse(out), nil
}

// StartRegistryReplacePlan implements POST .../start (R5.55).
func (s *server) StartRegistryReplacePlan(ctx context.Context, req gen.StartRegistryReplacePlanRequestObject) (gen.StartRegistryReplacePlanResponseObject, error) {
	fail := func(f opsFailure) (gen.StartRegistryReplacePlanResponseObject, error) {
		return gen.StartRegistryReplacePlandefaultJSONResponse{StatusCode: f.status, Body: f.body}, nil
	}
	svc, f := s.replaceSvc()
	if f != nil {
		return fail(*f)
	}
	p, err := svc.Start(ctx, req.PlanId)
	if err != nil {
		return fail(s.replaceFail(err))
	}
	out, err := s.genReplacePlan(ctx, svc, p)
	if err != nil {
		return fail(s.replaceFail(err))
	}
	return gen.StartRegistryReplacePlan202JSONResponse(out), nil
}

// StopRegistryReplacePlan implements POST .../stop (R5.55).
func (s *server) StopRegistryReplacePlan(ctx context.Context, req gen.StopRegistryReplacePlanRequestObject) (gen.StopRegistryReplacePlanResponseObject, error) {
	fail := func(f opsFailure) (gen.StopRegistryReplacePlanResponseObject, error) {
		return gen.StopRegistryReplacePlandefaultJSONResponse{StatusCode: f.status, Body: f.body}, nil
	}
	svc, f := s.replaceSvc()
	if f != nil {
		return fail(*f)
	}
	p, err := svc.Stop(ctx, req.PlanId)
	if err != nil {
		return fail(s.replaceFail(err))
	}
	out, err := s.genReplacePlan(ctx, svc, p)
	if err != nil {
		return fail(s.replaceFail(err))
	}
	return gen.StopRegistryReplacePlan202JSONResponse(out), nil
}

// RollbackRegistryReplacePlan implements POST .../rollback (R5.56): 409 after keep_until.
func (s *server) RollbackRegistryReplacePlan(ctx context.Context, req gen.RollbackRegistryReplacePlanRequestObject) (gen.RollbackRegistryReplacePlanResponseObject, error) {
	fail := func(f opsFailure) (gen.RollbackRegistryReplacePlanResponseObject, error) {
		return gen.RollbackRegistryReplacePlandefaultJSONResponse{StatusCode: f.status, Body: f.body}, nil
	}
	svc, f := s.replaceSvc()
	if f != nil {
		return fail(*f)
	}
	p, err := svc.Rollback(ctx, req.PlanId, replaceActor(ctx))
	if err != nil {
		return fail(s.replaceFail(err))
	}
	out, err := s.genReplacePlan(ctx, svc, p)
	if err != nil {
		return fail(s.replaceFail(err))
	}
	return gen.RollbackRegistryReplacePlan202JSONResponse(out), nil
}
