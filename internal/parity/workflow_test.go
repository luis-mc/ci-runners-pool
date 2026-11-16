package parity

import (
	"os"
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
