package api

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/api/gen"
	"github.com/luis-mc/ci-runners-shared-pool/internal/scheduler/slots"
)

// The jobs export (web-console R5.24, UX-39): every row of the filter, in the order the list shows (newest
// first), never only one page. Text that looks like a formula is neutralised in the CSV. The file is named for
// what it holds, then the date and time.

// exportPage is the page size the export reads with; it walks every page of the filter.
const exportPage = 200

// jobsExportColumns are the CSV columns, in order.
var jobsExportColumns = []string{
	"id", "repository", "run_id", "run_attempt", "workflow", "job_name", "state", "result", "wait_reason", "machine",
	"runner", "backend", "labels", "created_at", "started_at", "completed_at", "github_wait_seconds", "slot_wait_seconds",
	"run_seconds", "url",
}

// jobsExportFile is an export answer: the bytes, their type and the file name.
type jobsExportFile struct {
	contentType string
	filename    string
	body        []byte
}

func (e jobsExportFile) VisitExportJobsResponse(w http.ResponseWriter) error {
	w.Header().Set("Content-Type", e.contentType)
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", e.filename))
	w.Header().Set("Content-Length", strconv.Itoa(len(e.body)))
	w.WriteHeader(http.StatusOK)
	_, err := w.Write(e.body)
	return err
}

// neutralise stops a spreadsheet from running a cell as a formula (UX-39).
func neutralise(v string) string {
	if v != "" && strings.ContainsRune("=+-@\t\r", rune(v[0])) {
		return "'" + v
	}
	return v
}

func timeText(t *time.Time) string {
	if t == nil {
		return ""
	}
	return t.UTC().Format(time.RFC3339)
}

func intText(n *int) string {
	if n == nil {
		return ""
	}
	return strconv.Itoa(*n)
}

func jobRow(j gen.Job) []string {
	str := func(p *string) string {
		if p == nil {
			return ""
		}
		return *p
	}
	var result, reason string
	if j.Result != nil {
		result = string(*j.Result)
	}
	if j.WaitReason != nil {
		reason = string(*j.WaitReason)
	}
	return []string{
		strconv.FormatInt(j.Id, 10), j.Repository, strconv.FormatInt(j.RunId, 10), strconv.Itoa(j.RunAttempt), str(j.Workflow),
		j.JobName, string(j.State), result, reason, str(j.MachineId), str(j.RunnerName), str(j.Backend), strings.Join(j.Labels, " "),
		timeText(j.CreatedAt), timeText(j.StartedAt), timeText(j.CompletedAt), intText(j.GithubWaitSeconds), intText(j.SlotWaitSeconds),
		intText(j.RunSeconds), str(j.HtmlUrl),
	}
}

// exportJobsAll reads every job of the filter, newest first.
func (s *server) exportJobsAll(ctx context.Context, f slots.JobFilter) ([]gen.Job, error) {
	f.Limit = exportPage
	var out []gen.Job
	for {
		rows, err := s.opts.Jobs.ListJobs(ctx, f)
		if err != nil {
			return nil, err
		}
		more := len(rows) > f.Limit
		if more {
			rows = rows[:f.Limit]
		}
		for _, r := range rows {
			out = append(out, toJob(r))
		}
		if !more {
			return out, nil
		}
		f.After = rows[len(rows)-1].ID
	}
}

// ExportJobs implements GET /api/v1/exports/jobs.
func (s *server) ExportJobs(ctx context.Context, req gen.ExportJobsRequestObject) (gen.ExportJobsResponseObject, error) {
	bad := func(msg string) (gen.ExportJobsResponseObject, error) {
		return gen.ExportJobsdefaultJSONResponse{StatusCode: http.StatusBadRequest, Body: errBody(CodeBadRequest, msg)}, nil
	}
	if s.opts.Jobs == nil {
		return gen.ExportJobsdefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notWired()}, nil
	}
	p := req.Params
	var f slots.JobFilter
	if p.State != nil {
		switch slots.JobState(*p.State) {
		case slots.JobQueued, slots.JobRunning, slots.JobDone:
			f.State = slots.JobState(*p.State)
		default:
			return bad("state must be queued, running or done")
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
	format := gen.ExportJobsParamsFormat("csv")
	if p.Format != nil {
		format = *p.Format
	}
	if format != "csv" && format != "json" {
		return bad("format must be csv or json")
	}
	jobs, err := s.exportJobsAll(ctx, f)
	if err != nil {
		s.opts.Logger.Error("export jobs", "err", err)
		return gen.ExportJobsdefaultJSONResponse{StatusCode: http.StatusInternalServerError, Body: errBody(CodeInternal, "internal error")}, nil
	}
	name := "crsp-jobs-" + time.Now().Format("2006-01-02-1504") + "." + string(format)
	if format == "json" {
		if jobs == nil {
			jobs = []gen.Job{}
		}
		b, err := json.Marshal(jobs)
		if err != nil {
			return nil, err
		}
		return jobsExportFile{contentType: "application/json", filename: name, body: b}, nil
	}
	var buf bytes.Buffer
	w := csv.NewWriter(&buf)
	_ = w.Write(jobsExportColumns)
	for _, j := range jobs {
		row := jobRow(j)
		for i := range row {
			row[i] = neutralise(row[i])
		}
		_ = w.Write(row)
	}
	w.Flush()
	if err := w.Error(); err != nil {
		return nil, err
	}
	return jobsExportFile{contentType: "text/csv", filename: name, body: buf.Bytes()}, nil
}
