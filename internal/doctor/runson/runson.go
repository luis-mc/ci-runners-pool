// Package runson reads the runs-on of every job in a workflow file and
// resolves it to labels (doctor R5.18, R5.19).
//
// It understands a string, a flow list, a block list, a mapping with labels,
// and `${{ fromJSON(vars.NAME) }}` with an optional `|| '<default>'`. Anything
// else that holds an expression (a matrix value) is reported as unresolved,
// never guessed.
//
// Ported from dev-standards runner_health.py (parse_runs_on, resolve_labels,
// runner_carries, is_hosted) and delivery_doctor.py workflow_jobs; tests
// follow test_dl318_doctor_locked_runner.py Workflows and the runner_health
// rows of tools/test_delivery_gate.py.
package runson

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"gopkg.in/yaml.v3"
)

// Kind says how the labels of a job were found.
type Kind string

// Kinds.
const (
	// Literal labels written in the workflow.
	Literal Kind = "literal"
	// Variable labels read through fromJSON(vars.NAME).
	Variable Kind = "variable"
	// Unresolved holds an expression the doctor cannot resolve.
	Unresolved Kind = "unresolved"
)

// Job is the runs-on of one job.
type Job struct {
	Path string // workflow file path, such as .github/workflows/ci.yml
	Line int    // line of the runs-on value, 1-based
	Job  string // job key
	Kind Kind
	// Labels are the literal labels; for Variable they are the default after
	// `||`, when one is given.
	Labels []string
	// Var is the variable name for Variable.
	Var string
	// Expr is the raw text of an Unresolved expression.
	Expr string
}

var (
	// fromJSON(vars.NAME) with an optional `|| default` after the call.
	reVar = regexp.MustCompile(`^\$\{\{\s*fromJSON\(\s*vars\.([A-Za-z_][A-Za-z0-9_]*)\s*\)\s*(?:\|\|\s*(.+?))?\s*\}\}$`)
	// fromJSON(vars.NAME || 'default'): the usual way to write a default.
	reVarIn = regexp.MustCompile(`^\$\{\{\s*fromJSON\(\s*vars\.([A-Za-z_][A-Za-z0-9_]*)\s*\|\|\s*(.+?)\s*\)\s*\}\}$`)
	reExpr  = regexp.MustCompile(`\$\{\{`)
	reJSON  = regexp.MustCompile(`^fromJSON\(\s*'(.*)'\s*\)$`)
)

// Parse reads the runs-on of every job of a workflow file. A file that is not
// valid YAML returns an error; a job without runs-on (a reusable workflow
// call) is left out.
func Parse(path string, content []byte) ([]Job, error) {
	var doc yaml.Node
	if err := yaml.Unmarshal(content, &doc); err != nil {
		return nil, fmt.Errorf("%s: %w", path, err)
	}
	if len(doc.Content) == 0 {
		return nil, nil
	}
	root := doc.Content[0]
	jobs := mapValue(root, "jobs")
	if jobs == nil || jobs.Kind != yaml.MappingNode {
		return nil, nil
	}
	var out []Job
	for i := 0; i+1 < len(jobs.Content); i += 2 {
		key, val := jobs.Content[i], jobs.Content[i+1]
		ro := mapValue(val, "runs-on")
		if ro == nil {
			continue
		}
		out = append(out, parseNode(path, key.Value, ro))
	}
	return out, nil
}

func mapValue(n *yaml.Node, key string) *yaml.Node {
	if n == nil || n.Kind != yaml.MappingNode {
		return nil
	}
	for i := 0; i+1 < len(n.Content); i += 2 {
		if n.Content[i].Value == key {
			return n.Content[i+1]
		}
	}
	return nil
}

func parseNode(path, job string, n *yaml.Node) Job {
	j := Job{Path: path, Line: n.Line, Job: job, Kind: Literal}
	unresolved := func(raw string) Job {
		j.Kind, j.Expr, j.Labels, j.Var = Unresolved, raw, nil, ""
		return j
	}
	switch n.Kind {
	case yaml.ScalarNode:
		return parseScalar(j, n.Value)
	case yaml.SequenceNode:
		for _, c := range n.Content {
			if c.Kind != yaml.ScalarNode || reExpr.MatchString(c.Value) {
				return unresolved(strings.TrimSpace(c.Value))
			}
			j.Labels = append(j.Labels, c.Value)
		}
		return j
	case yaml.MappingNode:
		// runs-on: {group: x, labels: [..]} selects by group and labels.
		if l := mapValue(n, "labels"); l != nil {
			sub := parseNode(path, job, l)
			sub.Line = l.Line
			return sub
		}
		return unresolved("group")
	}
	return unresolved("")
}

func parseScalar(j Job, v string) Job {
	v = strings.TrimSpace(v)
	m := reVar.FindStringSubmatch(v)
	if m == nil {
		m = reVarIn.FindStringSubmatch(v)
	}
	if m != nil {
		j.Kind, j.Var = Variable, m[1]
		if m[2] != "" {
			def, ok := parseDefault(m[2])
			if !ok {
				j.Kind, j.Var, j.Expr = Unresolved, "", v
				return j
			}
			j.Labels = def
		}
		return j
	}
	if reExpr.MatchString(v) {
		j.Kind, j.Expr = Unresolved, v
		return j
	}
	j.Labels = []string{v}
	return j
}

// parseDefault reads what follows `||`: 'label', '["a","b"]' or fromJSON('["a"]').
func parseDefault(s string) ([]string, bool) {
	s = strings.TrimSpace(s)
	if m := reJSON.FindStringSubmatch(s); m != nil {
		return ParseLabelList(m[1])
	}
	if len(s) >= 2 && s[0] == '\'' && s[len(s)-1] == '\'' {
		inner := s[1 : len(s)-1]
		if strings.HasPrefix(strings.TrimSpace(inner), "[") {
			return ParseLabelList(inner)
		}
		return []string{inner}, inner != ""
	}
	return nil, false
}

// ParseLabelList reads a JSON list of strings, the form of a RUNS_ON_* variable.
func ParseLabelList(v string) ([]string, bool) {
	var l []string
	if err := json.Unmarshal([]byte(v), &l); err != nil || len(l) == 0 {
		return nil, false
	}
	return l, true
}

// Resolve gives the labels of a job. vars maps variable name to its value as
// GitHub holds it. ok is false when they cannot be known: an unresolved
// expression, or a variable that is not set and has no default. missingVar
// names the variable in the second case.
func (j Job) Resolve(vars map[string]string) (labels []string, ok bool, missingVar string) {
	switch j.Kind {
	case Literal:
		return j.Labels, true, ""
	case Variable:
		if v, set := vars[j.Var]; set {
			if l, valid := ParseLabelList(v); valid {
				return l, true, ""
			}
			return nil, false, ""
		}
		if len(j.Labels) > 0 {
			return j.Labels, true, ""
		}
		return nil, false, j.Var
	}
	return nil, false, ""
}

// SelfHosted says whether a label set targets self-hosted runners.
func SelfHosted(labels []string) bool {
	for _, l := range labels {
		if strings.EqualFold(l, "self-hosted") {
			return true
		}
	}
	return false
}

// IsHosted says whether a label set is GitHub-hosted: no self-hosted label
// and every label names a hosted image or a larger-runner group.
func IsHosted(labels []string) bool {
	if len(labels) == 0 || SelfHosted(labels) {
		return false
	}
	return true
}

// Carries says whether one runner's labels hold every label of need (GitHub
// matches labels case-insensitively).
func Carries(runner, need []string) bool {
	have := make(map[string]bool, len(runner))
	for _, l := range runner {
		have[strings.ToLower(l)] = true
	}
	for _, n := range need {
		if !have[strings.ToLower(n)] {
			return false
		}
	}
	return true
}

// OSOfVariable maps RUNS_ON_<OS> to the OS name, "" for any other name.
func OSOfVariable(name string) string {
	switch name {
	case "RUNS_ON_LINUX":
		return "linux"
	case "RUNS_ON_WINDOWS":
		return "windows"
	case "RUNS_ON_MACOS":
		return "macos"
	}
	return ""
}

// VariableOfOS is the inverse of OSOfVariable.
func VariableOfOS(os string) string { return "RUNS_ON_" + strings.ToUpper(os) }
