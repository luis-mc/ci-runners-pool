package api

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/api/gen"
	"github.com/luis-mc/ci-runners-shared-pool/internal/scheduler"
	"github.com/luis-mc/ci-runners-shared-pool/internal/scheduler/slots"
)

// The jobs and slot routes: listJobs, getJob, listSlots, freeStaleSlots
// (observability R5.1, R5.7; scheduling R5.37, R5.58).

const defaultJobLimit = 50

func errBody(code, msg string) gen.ErrorEnvelope {
	return gen.ErrorEnvelope{Error: gen.ErrorBody{Code: code, Message: msg}}
}

// notWired is the answer while the scheduler is not set up in Options: the route exists, nothing serves it.
func notWired() gen.ErrorEnvelope { return notImplemented() }

// waitReason maps a scheduler wait reason to the contract's. A lost race means
// no slot was free, so it shows as free_slot.
func waitReason(r string) *gen.WaitReason {
	if r == "" {
		return nil
	}
	var out gen.WaitReason
	switch r {
	case "free_slot", "lost_race":
		out = gen.WaitReasonFreeSlot
	case "load_over_budget":
		out = gen.WaitReasonLoadOverBudget
	case "no_runner_with_labels":
		out = gen.WaitReasonNoRunnerWithLabels
	case "repository_parallel_limit":
		out = gen.WaitReasonRepositoryParallelLimit
	case "machine_drained":
		out = gen.WaitReasonMachineDrained
	case "quiet_hours":
		out = gen.WaitReasonQuietHours
	case "load_not_measured":
		out = gen.WaitReasonLoadNotMeasured
	default:
		out = gen.WaitReasonUnknown
	}
	return &out
}

func ptr[T comparable](v T) *T {
	var zero T
	if v == zero {
		return nil
	}
	return &v
}

func tptr(t time.Time) *time.Time {
	if t.IsZero() {
		return nil
	}
	return &t
}

func secs(a, b time.Time) *int {
	if a.IsZero() || b.IsZero() || b.Before(a) {
		return nil
	}
	n := int(b.Sub(a).Seconds())
	return &n
}

func jobResult(conclusion string) *gen.JobResult {
	var r gen.JobResult
	switch conclusion {
	case "success":
		r = gen.JobResultSuccess
	case "failure":
		r = gen.JobResultFailure
	case "cancelled":
		r = gen.JobResultCancelled
	case "timed_out":
		r = gen.JobResultTimedOut
	case "":
		return nil
	default:
		r = gen.JobResultLost
	}
	return &r
}

func isolation(v string) *gen.Isolation {
	if v == "" {
		return nil
	}
	i := gen.Isolation(v)
	return &i
}

func toJob(j slots.JobRecord) gen.Job {
	out := gen.Job{
		Id: j.ID, Repository: j.Repository, RepositoryId: ptr(j.RepositoryID), RunId: j.RunID, RunAttempt: j.RunAttempt,
		GithubJobId: j.ID, Workflow: ptr(j.Workflow), JobName: j.JobName, HeadSha: ptr(j.HeadSHA), Trigger: ptr(j.Trigger),
		Labels: j.Labels, State: gen.JobState(j.State), MachineId: ptr(j.MachineID), RunnerName: ptr(j.RunnerName), Backend: ptr(j.Backend), Isolation: isolation(j.Isolation),
		CreatedAt: tptr(j.CreatedAt), QueuedAt: tptr(j.QueuedAt), SlotAt: tptr(j.SlotAt), StartedAt: tptr(j.StartedAt),
		CompletedAt: tptr(j.CompletedAt), GithubWaitSeconds: secs(j.CreatedAt, j.StartedAt),
		SlotWaitSeconds: secs(j.QueuedAt, j.SlotAt), RunSeconds: secs(j.StartedAt, j.CompletedAt), Result: jobResult(j.Conclusion),
	}
	if out.Labels == nil {
		out.Labels = []string{}
	}
	if j.State == slots.JobQueued {
		out.WaitReason, out.WaitText = waitReason(j.WaitReason), ptr(j.WaitText)
	}
	if j.Repository != "" {
		out.HtmlUrl = ptr(fmt.Sprintf("https://github.com/%s/actions/runs/%d/job/%d", j.Repository, j.RunID, j.ID))
	}
	return out
}

// ListJobs implements GET /api/v1/jobs: newest first, keyset-paged on the job id.
func (s *server) ListJobs(ctx context.Context, req gen.ListJobsRequestObject) (gen.ListJobsResponseObject, error) {
	if s.opts.Jobs == nil {
		return gen.ListJobsdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notWired()}, nil
	}
	p := req.Params
	f := slots.JobFilter{Limit: defaultJobLimit}
	if p.Limit != nil {
		if *p.Limit < 1 || *p.Limit > 200 {
			return gen.ListJobsdefaultJSONResponse{StatusCode: http.StatusBadRequest, Body: errBody(CodeBadRequest, "limit must be 1 to 200")}, nil
		}
		f.Limit = *p.Limit
	}
	if p.State != nil {
		switch slots.JobState(*p.State) {
		case slots.JobQueued, slots.JobRunning, slots.JobDone:
			f.State = slots.JobState(*p.State)
		default:
			return gen.ListJobsdefaultJSONResponse{StatusCode: http.StatusBadRequest, Body: errBody(CodeBadRequest, "state must be queued, running or done")}, nil
		}
	}
	if p.RepositoryId != nil {
		f.RepositoryID = *p.RepositoryId
	}
	if p.MachineId != nil {
		f.MachineID = *p.MachineId
	}
	if p.Backend != nil {
		f.Backend = *p.Backend
	}
	if p.Result != nil {
		f.Result = string(*p.Result)
	}
	if p.From != nil {
		f.From = *p.From
	}
	if p.To != nil {
		f.To = *p.To
	}
	if p.Cursor != nil && *p.Cursor != "" {
		after, err := strconv.ParseInt(strings.TrimPrefix(*p.Cursor, "j"), 10, 64)
		if err != nil || after < 1 {
			return gen.ListJobsdefaultJSONResponse{StatusCode: http.StatusBadRequest, Body: errBody(CodeBadRequest, "the cursor is not valid")}, nil
		}
		f.After = after
	}
	rows, err := s.opts.Jobs.ListJobs(ctx, f)
	if err != nil {
		s.opts.Logger.Error("list jobs", "err", err)
		return gen.ListJobsdefaultJSONResponse{StatusCode: http.StatusInternalServerError, Body: errBody(CodeInternal, "internal error")}, nil
	}
	page := gen.JobPage{Items: []gen.Job{}, Stale: gen.Staleness{}}
	if len(rows) > f.Limit {
		rows = rows[:f.Limit]
		page.NextCursor = ptr("j" + strconv.FormatInt(rows[len(rows)-1].ID, 10))
	}
	for _, r := range rows {
		page.Items = append(page.Items, toJob(r))
	}
	return gen.ListJobs200JSONResponse(page), nil
}

// GetJob implements GET /api/v1/jobs/{jobId}.
func (s *server) GetJob(ctx context.Context, req gen.GetJobRequestObject) (gen.GetJobResponseObject, error) {
	if s.opts.Jobs == nil {
		return gen.GetJobdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notWired()}, nil
	}
	j, ok, err := s.opts.Jobs.GetJob(ctx, req.JobId)
	if err != nil {
		s.opts.Logger.Error("get job", "err", err)
		return gen.GetJobdefaultJSONResponse{StatusCode: http.StatusInternalServerError, Body: errBody(CodeInternal, "internal error")}, nil
	}
	if !ok {
		return gen.GetJobdefaultJSONResponse{StatusCode: http.StatusNotFound, Body: errBody(CodeNotFound, "no such job")}, nil
	}
	return gen.GetJob200JSONResponse(toJob(j)), nil
}

func (s *server) machineKnown(ctx context.Context, id string) (bool, error) {
	if s.opts.Jobs == nil {
		return true, nil
	}
	return s.opts.Jobs.MachineExists(ctx, id)
}

func toSlot(h scheduler.HeldSlot) gen.Slot {
	return gen.Slot{Kind: gen.SlotKind(h.Kind), Number: h.Number, TakenAt: h.TakenAt, Repository: h.Job.Repository,
		RunId: h.Job.RunID, RunAttempt: h.Job.RunAttempt, Job: h.Job.Job, RunnerId: ptr(h.Job.RunnerName), StaleReason: ptr(h.StaleReason)}
}

// ListSlots implements GET /api/v1/machines/{machineId}/slots (scheduling R5.58).
func (s *server) ListSlots(ctx context.Context, req gen.ListSlotsRequestObject) (gen.ListSlotsResponseObject, error) {
	if s.opts.Slots == nil {
		return gen.ListSlotsdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notWired()}, nil
	}
	if ok, err := s.machineKnown(ctx, req.MachineId); err != nil {
		s.opts.Logger.Error("list slots", "err", err)
		return gen.ListSlotsdefaultJSONResponse{StatusCode: http.StatusInternalServerError, Body: errBody(CodeInternal, "internal error")}, nil
	} else if !ok {
		return gen.ListSlotsdefaultJSONResponse{StatusCode: http.StatusNotFound, Body: errBody(CodeNotFound, "no such machine")}, nil
	}
	st, err := s.opts.Slots.Status(ctx, req.MachineId)
	if err != nil {
		s.opts.Logger.Error("list slots", "err", err)
		return gen.ListSlotsdefaultJSONResponse{StatusCode: http.StatusInternalServerError, Body: errBody(CodeInternal, "internal error")}, nil
	}
	out := gen.SlotStatus{MachineId: req.MachineId, Slots: []gen.Slot{}, Tickets: []gen.Ticket{}}
	for _, h := range st.Slots {
		out.Slots = append(out.Slots, toSlot(h))
	}
	for _, t := range st.Tickets {
		out.Tickets = append(out.Tickets, gen.Ticket{Id: t.GateID, Repository: t.Job.Repository, RunId: t.Job.RunID,
			RunAttempt: t.Job.RunAttempt, Job: t.Job.Job, Priority: ptr(t.Priority), EventClass: ptr(t.Class), QueuedAt: t.QueuedAt,
			BeatAt: tptr(t.BeatAt), ExpiresAt: tptr(t.ExpiresAt), Place: t.Place, WaitReason: waitReason(string(t.Reason))})
	}
	return gen.ListSlots200JSONResponse(out), nil
}

// FreeStaleSlots implements POST /api/v1/machines/{machineId}/slots/free-stale
// (scheduling R5.37). Stale slots are freed at once. A live slot is freed only
// when named and confirmed; without confirm the answer names the job and asks for a yes.
func (s *server) FreeStaleSlots(ctx context.Context, req gen.FreeStaleSlotsRequestObject) (gen.FreeStaleSlotsResponseObject, error) {
	fail := func(status int, code, msg string) gen.FreeStaleSlotsResponseObject {
		return gen.FreeStaleSlotsdefaultJSONResponse{StatusCode: status, Body: errBody(code, msg)}
	}
	if s.opts.Slots == nil {
		return fail(http.StatusNotImplemented, CodeNotImplemented, "this operation is not built yet"), nil
	}
	if ok, err := s.machineKnown(ctx, req.MachineId); err != nil {
		s.opts.Logger.Error("free stale", "err", err)
		return fail(http.StatusInternalServerError, CodeInternal, "internal error"), nil
	} else if !ok {
		return fail(http.StatusNotFound, CodeNotFound, "no such machine"), nil
	}
	var live []scheduler.Grant
	if req.Body != nil && req.Body.Slots != nil && len(*req.Body.Slots) > 0 {
		st, err := s.opts.Slots.Status(ctx, req.MachineId)
		if err != nil {
			s.opts.Logger.Error("free stale", "err", err)
			return fail(http.StatusInternalServerError, CodeInternal, "internal error"), nil
		}
		confirmed := req.Body.Confirm != nil && *req.Body.Confirm
		for _, want := range *req.Body.Slots {
			var held *scheduler.HeldSlot
			for i := range st.Slots {
				if string(st.Slots[i].Kind) == string(want.Kind) && st.Slots[i].Number == want.Number {
					held = &st.Slots[i]
				}
			}
			if held == nil {
				return fail(http.StatusNotFound, CodeNotFound, fmt.Sprintf("slot %s %d is not held", want.Kind, want.Number)), nil
			}
			if held.StaleReason == "" && !confirmed {
				return fail(http.StatusConflict, CodeNeedsConfirmation, fmt.Sprintf(
					"slot %s %d is held by a live job: %s run %d job %s; send confirm to free it",
					want.Kind, want.Number, held.Job.Repository, held.Job.RunID, held.Job.Job)), nil
			}
			live = append(live, scheduler.Grant{Kind: held.Kind, Number: held.Number})
		}
	}
	freed, err := s.opts.Slots.FreeStale(ctx, req.MachineId, live)
	if err != nil {
		s.opts.Logger.Error("free stale", "err", err)
		return fail(http.StatusInternalServerError, CodeInternal, "internal error"), nil
	}
	out := gen.FreedSlotList{Items: []struct {
		Reason string   `json:"reason"`
		Slot   gen.Slot `json:"slot"`
	}{}}
	for _, f := range freed {
		if f.Number == 0 {
			continue // a dropped ticket is not a slot
		}
		out.Items = append(out.Items, struct {
			Reason string   `json:"reason"`
			Slot   gen.Slot `json:"slot"`
		}{Reason: f.Reason, Slot: gen.Slot{Kind: gen.SlotKind(f.Kind), Number: f.Number, TakenAt: f.TakenAt, Repository: f.Job.Repository,
			RunId: f.Job.RunID, RunAttempt: f.Job.RunAttempt, Job: f.Job.Job, RunnerId: ptr(f.Job.RunnerName)}})
	}
	return gen.FreeStaleSlots200JSONResponse(out), nil
}
