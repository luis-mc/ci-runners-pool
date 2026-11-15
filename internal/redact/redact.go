// Package redact removes known secrets from log text before it leaves the agent
// (runners R5.11). It holds the secret values a process knows (registration,
// remove and JIT tokens) and also matches the shapes of GitHub tokens, private
// keys, JWTs and credential headers.
package redact

import (
	"encoding/base64"
	"io/fs"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
)

// Mask replaces every secret (runners R5.11).
const Mask = "***"

// minLen is the shortest value kept: a shorter one would blank ordinary text.
const minLen = 6

var shapes = []*regexp.Regexp{
	regexp.MustCompile(`gh[pousr]_[A-Za-z0-9]{20,}`),
	regexp.MustCompile(`github_pat_[A-Za-z0-9_]{20,}`),
	regexp.MustCompile(`(?s)-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----`),
	regexp.MustCompile(`eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}`),
	regexp.MustCompile(`(?i)(authorization|cookie):\s*[^\r\n]+`),
	regexp.MustCompile(`(?i)(--token|--pat)\s+\S+`),
	regexp.MustCompile(`(?i)(ACTIONS_RUNNER_INPUT_(?:TOKEN|JITCONFIG)=)\S+`),
}

// Redactor is safe for concurrent use.
type Redactor struct {
	mu     sync.RWMutex
	values []string // longest first
}

// New returns a redactor that knows no values yet; the shapes always apply.
func New() *Redactor { return &Redactor{} }

// Add teaches the redactor a secret value and its base64 forms. A value that
// is too short is ignored.
func (r *Redactor) Add(v string) {
	v = strings.TrimSpace(v)
	if len(v) < minLen {
		return
	}
	forms := []string{v,
		base64.StdEncoding.EncodeToString([]byte(v)),
		base64.RawStdEncoding.EncodeToString([]byte(v)),
		base64.URLEncoding.EncodeToString([]byte(v)),
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, f := range forms {
		have := false
		for _, x := range r.values {
			if x == f {
				have = true
				break
			}
		}
		if !have {
			r.values = append(r.values, f)
		}
	}
	sort.SliceStable(r.values, func(i, j int) bool { return len(r.values[i]) > len(r.values[j]) })
}

// Redact returns s with known values and secret shapes replaced by Mask.
func (r *Redactor) Redact(s string) string {
	r.mu.RLock()
	for _, v := range r.values {
		s = strings.ReplaceAll(s, v, Mask)
	}
	r.mu.RUnlock()
	for _, re := range shapes {
		if re.NumSubexp() > 0 && strings.Contains(re.String(), "ACTIONS_RUNNER_INPUT") {
			s = re.ReplaceAllString(s, "${1}"+Mask)
			continue
		}
		s = re.ReplaceAllString(s, Mask)
	}
	return s
}

// Files is the part of a file system a private log needs.
type Files interface {
	MkdirAll(path string, perm fs.FileMode) error
	WriteFile(path string, data []byte, perm fs.FileMode) error
	ReadFile(path string) ([]byte, error)
}

// Log modes: a runner's setup log can name paths, users and command output, so
// only the owner of the folder reads it.
const (
	LogFileMode fs.FileMode = 0o600
	LogDirMode  fs.FileMode = 0o700
)

// PrivateLog appends redacted lines to one file that only its owner can read.
type PrivateLog struct {
	FS   Files
	Path string
	R    *Redactor
	Now  func() time.Time
	mu   sync.Mutex
}

// Line writes "<time> <step> <message>" after redaction. The file is made with
// LogFileMode in a LogDirMode folder; a failure is returned, never fatal to a job.
func (l *PrivateLog) Line(step, msg string) error {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now
	if l.Now != nil {
		now = l.Now
	}
	dir := l.Path
	if i := strings.LastIndexAny(dir, `/\`); i >= 0 {
		dir = dir[:i]
	}
	if err := l.FS.MkdirAll(dir, LogDirMode); err != nil {
		return err
	}
	old, _ := l.FS.ReadFile(l.Path)
	line := now().UTC().Format(time.RFC3339) + " " + l.R.Redact(step) + " " + l.R.Redact(strings.TrimSpace(msg)) + "\n"
	return l.FS.WriteFile(l.Path, append(old, line...), LogFileMode)
}
