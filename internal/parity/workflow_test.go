package parity

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

// The parity workflow signs in from the secret and variables the console
// writes (cli R5.60, github-integration R5.84, operations R5.85).

type wfStep struct {
	Name  string            `yaml:"name"`
	ID    string            `yaml:"id"`
	Uses  string            `yaml:"uses"`
	Run   string            `yaml:"run"`
	Env   map[string]string `yaml:"env"`
	Shell string            `yaml:"shell"`
}

type wfFile struct {
	On   map[string]any `yaml:"on"`
	Jobs map[string]struct {
		Env   map[string]string `yaml:"env"`
		Steps []wfStep          `yaml:"steps"`
	} `yaml:"jobs"`
}

func loadParityWorkflow(t *testing.T) (wfFile, string) {
	t.Helper()
	path := filepath.Join("..", "..", ".github", "workflows", "parity.yml")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var wf wfFile
	if err := yaml.Unmarshal(raw, &wf); err != nil {
		t.Fatalf("parity.yml is not valid YAML: %v", err)
	}
	return wf, string(raw)
}

func TestParityWorkflowPassesTheAccessToTheCheck(t *testing.T) { // operations R5.85
	wf, _ := loadParityWorkflow(t)
	job, ok := wf.Jobs["parity"]
	if !ok {
		t.Fatal("no job `parity`")
	}
	want := map[string]string{
		"CRSP_URL":            "${{ vars.CRSP_URL }}",
		"CRSP_CA_FINGERPRINT": "${{ vars.CRSP_CA_FINGERPRINT }}",
		"CRSP_ACCESS":         "${{ secrets.CRSP_ACCESS }}",
	}
	var check, access *wfStep
	for i := range job.Steps {
		switch job.Steps[i].ID {
		case "check":
			check = &job.Steps[i]
		case "access":
			access = &job.Steps[i]
		}
	}
	if check == nil || access == nil {
		t.Fatalf("the steps `access` and `check` must exist: %v %v", access, check)
	}
	for _, st := range []*wfStep{check, access} {
		for k, v := range want {
			if st.Env[k] != v {
				t.Errorf("step %q: env %s = %q, want %q", st.ID, k, st.Env[k], v)
			}
		}
	}
	// The secret is passed only to the steps that need it, not to the whole job.
	if _, ok := job.Env["CRSP_ACCESS"]; ok {
		t.Error("CRSP_ACCESS must be a step env, not a job env")
	}
	if !strings.Contains(check.Run, "parity check") {
		t.Errorf("the check step does not run `crsp parity check`: %q", check.Run)
	}
	// No `crsp login` on the runner any more.
	for _, st := range job.Steps {
		if strings.Contains(st.Run, "crsp login") || strings.Contains(st.Run, `" login`) {
			t.Errorf("step %q still signs in with crsp login", st.Name)
		}
	}
}

func TestParityWorkflowFailsFirstAndNamesTheConsoleAction(t *testing.T) { // operations R5.85
	wf, _ := loadParityWorkflow(t)
	steps := wf.Jobs["parity"].Steps
	if len(steps) == 0 || steps[0].ID != "access" {
		t.Fatalf("the access check must be the first step, before the build")
	}
	run := steps[0].Run
	for _, name := range []string{"CRSP_URL", "CRSP_CA_FINGERPRINT", "CRSP_ACCESS"} {
		if !strings.Contains(run, name) {
			t.Errorf("the access check does not test %s", name)
		}
	}
	if !strings.Contains(run, "Set up parity for this repository") {
		t.Error("the message must name the console action `Set up parity for this repository`")
	}
	if !strings.Contains(run, "Access for CI") {
		t.Error("the message must say where the action is (Settings, Access for CI)")
	}
	if !strings.Contains(run, "exit 1") {
		t.Error("a missing value must fail the step")
	}
	if steps[0].Shell != "bash" {
		t.Error("the check uses ${!name}; it must say shell: bash")
	}
}

func TestParityWorkflowNamesAvoidSecretEndings(t *testing.T) { // owner rule, operations R5.85
	_, raw := loadParityWorkflow(t)
	bad := regexp.MustCompile(`\b(?:vars|secrets)\.([A-Z0-9_]+)`)
	for _, m := range bad.FindAllStringSubmatch(raw, -1) {
		for _, end := range []string{"_KEY", "_TOKEN", "_SECRET", "_PASS"} {
			if strings.HasSuffix(m[1], end) {
				t.Errorf("%s ends in %s", m[1], end)
			}
		}
	}
	envName := regexp.MustCompile(`(?m)^\s+(CRSP_[A-Z_]+):`)
	for _, m := range envName.FindAllStringSubmatch(raw, -1) {
		for _, end := range []string{"_KEY", "_TOKEN", "_SECRET", "_PASS"} {
			if strings.HasSuffix(m[1], end) {
				t.Errorf("%s ends in %s", m[1], end)
			}
		}
	}
}

func TestParityWorkflowActionsArePinnedToACommit(t *testing.T) { // dev standards
	wf, _ := loadParityWorkflow(t)
	pin := regexp.MustCompile(`@[0-9a-f]{40}$`)
	for _, st := range wf.Jobs["parity"].Steps {
		if st.Uses != "" && !pin.MatchString(st.Uses) {
			t.Errorf("%s is not pinned to a full commit", st.Uses)
		}
	}
}

func TestParityWorkflowHasTheTriggersAndNoWritePermission(t *testing.T) { // operations R5.85
	wf, raw := loadParityWorkflow(t)
	for _, k := range []string{"workflow_dispatch", "schedule"} {
		if _, ok := wf.On[k]; !ok {
			t.Errorf("trigger %s is missing", k)
		}
	}
	if !regexp.MustCompile(`(?m)^permissions:\r?\n  contents: read\r?\n`).MatchString(raw) {
		t.Error("the workflow must have only `contents: read`")
	}
}

// finalStep runs the last step of the job with the given outcomes the way a
// runner does: its `run` text under bash, the values in the environment.
func finalStep(t *testing.T, access, check, soak, job string) (string, int) {
	t.Helper()
	bash, err := exec.LookPath("bash")
	if err != nil {
		t.Skip("bash is not installed")
	}
	wf, _ := loadParityWorkflow(t)
	steps := wf.Jobs["parity"].Steps
	st := steps[len(steps)-1]
	if st.Name != "Fail when the report did not pass" {
		t.Fatalf("the last step is %q", st.Name)
	}
	cmd := exec.CommandContext(context.Background(), bash, "-c", st.Run)
	cmd.Env = append(os.Environ(),
		"ACCESS_OUTCOME="+access, "CHECK_OUTCOME="+check, "SOAK_OUTCOME="+soak, "JOB_STATUS="+job)
	out, err := cmd.CombinedOutput()
	code := 0
	if ee, ok := err.(*exec.ExitError); ok {
		code = ee.ExitCode()
	} else if err != nil {
		t.Fatal(err)
	}
	return string(out), code
}

func TestParityFinalStepEnvironmentComesFromTheStepOutcomes(t *testing.T) { // operations R5.85, CRSP141
	wf, _ := loadParityWorkflow(t)
	steps := wf.Jobs["parity"].Steps
	st := steps[len(steps)-1]
	for env, want := range map[string]string{
		"ACCESS_OUTCOME": "steps.access.outcome", "CHECK_OUTCOME": "steps.check.outcome",
		"SOAK_OUTCOME": "steps.soak.outcome", "JOB_STATUS": "job.status",
	} {
		if !strings.Contains(st.Env[env], want) {
			t.Errorf("%s = %q, want it to read %s", env, st.Env[env], want)
		}
	}
	if strings.Contains(st.Run, "${{") {
		t.Error("the step must read its values from the environment, not from inline expressions")
	}
}

func TestParityFinalStepSaysTheRealCause(t *testing.T) { // operations R5.85, CRSP141
	const notSetUp = "The parity access is not set up"
	cases := []struct {
		name                     string
		access, check, soak, job string
		code                     int
		has, hasNot              []string
	}{
		{"every step skipped after a timeout", "skipped", "skipped", "skipped", "cancelled", 1,
			[]string{"did not reach the checks", "access step was skipped", "timed out", "free slot"}, []string{notSetUp, "Set up parity for this repository"}},
		{"access step cancelled", "cancelled", "skipped", "skipped", "cancelled", 1,
			[]string{"did not reach the checks", "access step was cancelled", "cancelled or timed out"}, []string{notSetUp}},
		{"skipped and the cause is unknown", "skipped", "skipped", "skipped", "failure", 1,
			[]string{"did not reach the checks", "access step was skipped", "not known"}, []string{notSetUp, "timed out"}},
		{"no outcome at all", "", "", "", "failure", 1,
			[]string{"did not reach the checks", "not run"}, []string{notSetUp}},
		{"the access step ran and failed", "failure", "skipped", "skipped", "failure", 1,
			[]string{notSetUp, "Set up parity for this repository"}, []string{"did not reach the checks"}},
		{"the check failed", "success", "failure", "skipped", "success", 1,
			[]string{"The parity report did not pass"}, []string{notSetUp, "did not reach the checks"}},
		{"the soak failed", "success", "success", "failure", "success", 1,
			[]string{"The parity report did not pass"}, []string{notSetUp}},
		{"everything passed", "success", "success", "skipped", "success", 0, nil, []string{notSetUp, "did not reach the checks", "did not pass"}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			out, code := finalStep(t, c.access, c.check, c.soak, c.job)
			if code != c.code {
				t.Fatalf("exit %d, want %d\n%s", code, c.code, out)
			}
			for _, w := range c.has {
				if !strings.Contains(out, w) {
					t.Errorf("the output lacks %q:\n%s", w, out)
				}
			}
			for _, w := range c.hasNot {
				if strings.Contains(out, w) {
					t.Errorf("the output has %q:\n%s", w, out)
				}
			}
		})
	}
}
