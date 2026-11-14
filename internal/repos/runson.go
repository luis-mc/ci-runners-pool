package repos

import (
	"encoding/json"
	"regexp"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

// RunsOnJob is the runs-on of one workflow job.
type RunsOnJob struct {
	Job  string
	Line int
	// Literal holds the labels written out in the file.
	Literal []string
	// Var names the variable of a fromJSON(vars.NAME) expression, if any.
	Var string
	// Default holds the labels of `|| '[...]'` after the variable.
	Default []string
	// Unresolved is set for an expression that cannot be resolved, such as a
	// matrix value; such a job is not checked.
	Unresolved bool
}

var fromJSONRE = regexp.MustCompile(`^\s*\$\{\{\s*fromJSON\(\s*vars\.([A-Za-z0-9_]+)\s*\)\s*(?:\|\|\s*(?:'([^']*)'|"([^"]*)"))?\s*\}\}\s*$`)

// ParseRunsOn reads the runs-on of every job in a workflow file: a string, a
// flow list, a block list, or fromJSON(vars.NAME) with an optional default. A
// file that does not parse yields no jobs.
func ParseRunsOn(content []byte) []RunsOnJob {
	var root yaml.Node
	if err := yaml.Unmarshal(content, &root); err != nil || len(root.Content) == 0 {
		return nil
	}
	doc := root.Content[0]
	if doc.Kind != yaml.MappingNode {
		return nil
	}
	jobs := mapValue(doc, "jobs")
	if jobs == nil || jobs.Kind != yaml.MappingNode {
		return nil
	}
	var out []RunsOnJob
	for i := 0; i+1 < len(jobs.Content); i += 2 {
		name, job := jobs.Content[i].Value, jobs.Content[i+1]
		if job.Kind != yaml.MappingNode {
			continue
		}
		ro := mapValue(job, "runs-on")
		if ro == nil {
			continue
		}
		out = append(out, parseOne(name, ro))
	}
	return out
}

func mapValue(m *yaml.Node, key string) *yaml.Node {
	for i := 0; i+1 < len(m.Content); i += 2 {
		if m.Content[i].Value == key {
			return m.Content[i+1]
		}
	}
	return nil
}

func parseOne(job string, n *yaml.Node) RunsOnJob {
	r := RunsOnJob{Job: job, Line: n.Line}
	switch n.Kind {
	case yaml.ScalarNode:
		r.fill(n.Value)
	case yaml.SequenceNode:
		for _, c := range n.Content {
			if c.Kind != yaml.ScalarNode || strings.Contains(c.Value, "${{") {
				r.Unresolved = true
				r.Literal = nil
				return r
			}
			r.Literal = append(r.Literal, c.Value)
		}
	case yaml.MappingNode:
		// runs-on: {group: ..., labels: ...}
		if l := mapValue(n, "labels"); l != nil {
			sub := parseOne(job, l)
			sub.Line = n.Line
			return sub
		}
		r.Unresolved = true
	default:
		r.Unresolved = true
	}
	return r
}

func (r *RunsOnJob) fill(v string) {
	if !strings.Contains(v, "${{") {
		r.Literal = []string{strings.TrimSpace(v)}
		return
	}
	m := fromJSONRE.FindStringSubmatch(v)
	if m == nil {
		r.Unresolved = true
		return
	}
	r.Var = m[1]
	def := m[2]
	if def == "" {
		def = m[3]
	}
	if def != "" {
		var labels []string
		if err := json.Unmarshal([]byte(def), &labels); err == nil {
			r.Default = labels
		} else {
			r.Default = []string{def}
		}
	}
}

// Check turns the jobs of one workflow file into findings (R5.30).
//
//   - self-hosted labels that no runner of the pool carries: fail
//     (no_runner_with_labels);
//   - self-hosted labels written out instead of fromJSON(vars.CRSP_RUNS_ON_<OS>):
//     warning (not_generic);
//   - a CRSP_RUNS_ON_<OS> variable the workflow reads that is not set: fail
//     (uses_variable).
//
// vars are the repository's variables as GitHub holds them; pool lists the
// label sets the pool's runners carry. GitHub-hosted jobs and expressions that
// cannot be resolved are not findings.
func Check(path string, jobs []RunsOnJob, vars map[string]string, pool [][]string) []Finding {
	var out []Finding
	for _, j := range jobs {
		if j.Unresolved {
			continue
		}
		labels := j.Literal
		viaVar := false
		if j.Var != "" {
			viaVar = true
			raw, set := vars[j.Var]
			switch {
			case set:
				if err := json.Unmarshal([]byte(raw), &labels); err != nil {
					out = append(out, Finding{Path: path, Line: j.Line, Kind: KindUsesVar,
						Text: "job " + j.Job + ": variable " + j.Var + " is not a JSON list of labels"})
					continue
				}
			case len(j.Default) > 0:
				labels = j.Default
			default:
				if isPoolVar(j.Var) {
					out = append(out, Finding{Path: path, Line: j.Line, Kind: KindUsesVar,
						Text: "job " + j.Job + " reads " + j.Var + ", which is not set; turn the pool on for this repository or set it"})
				}
				continue
			}
		}
		if !hasLabel(labels, "self-hosted") {
			continue // GitHub-hosted: skipped
		}
		if !carried(labels, pool) {
			out = append(out, Finding{Path: path, Line: j.Line, Labels: labels, Kind: KindNoRunner,
				Text: "job " + j.Job + " needs " + strings.Join(labels, ", ") + ", which no runner of the pool carries"})
			continue
		}
		if !viaVar {
			out = append(out, Finding{Path: path, Line: j.Line, Labels: labels, Kind: KindNotGeneric,
				Text: "job " + j.Job + " writes its labels out; use ${{ fromJSON(vars." + varFor(labels) + ") }} so the pool can change them"})
		}
	}
	return out
}

func isPoolVar(n string) bool {
	return n == "CRSP_RUNS_ON_LINUX" || n == "CRSP_RUNS_ON_WINDOWS" || n == "CRSP_RUNS_ON_MACOS"
}

func varFor(labels []string) string {
	switch {
	case hasLabel(labels, "windows"):
		return "CRSP_RUNS_ON_WINDOWS"
	case hasLabel(labels, "macos"):
		return "CRSP_RUNS_ON_MACOS"
	}
	return "CRSP_RUNS_ON_LINUX"
}

func hasLabel(labels []string, want string) bool {
	for _, l := range labels {
		if strings.EqualFold(l, want) {
			return true
		}
	}
	return false
}

// carried reports whether some runner label set holds every wanted label.
func carried(want []string, pool [][]string) bool {
	for _, set := range pool {
		ok := true
		for _, w := range want {
			if !hasLabel(set, w) {
				ok = false
				break
			}
		}
		if ok {
			return true
		}
	}
	return false
}

// VariablesRead lists, per CRSP_RUNS_ON_* variable, the workflow files that
// read it, for the question that names them when the pool is turned off
// (R5.29).
func VariablesRead(files map[string][]byte) map[string][]string {
	out := map[string][]string{}
	for path, content := range files {
		for _, j := range ParseRunsOn(content) {
			if j.Var != "" && isPoolVar(j.Var) {
				out[j.Var] = appendUnique(out[j.Var], path)
			}
		}
		// A variable read outside runs-on (a matrix, a step) still counts.
		for v := range pools {
			if strings.Contains(string(content), "vars."+v) {
				out[v] = appendUnique(out[v], path)
			}
		}
	}
	for v := range out {
		sort.Strings(out[v])
	}
	return out
}

var pools = map[string]bool{"CRSP_RUNS_ON_LINUX": true, "CRSP_RUNS_ON_WINDOWS": true, "CRSP_RUNS_ON_MACOS": true}

func appendUnique(s []string, v string) []string {
	for _, x := range s {
		if x == v {
			return s
		}
	}
	return append(s, v)
}
