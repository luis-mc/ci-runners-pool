package sys

import (
	"context"
	"runtime"
	"testing"
)

// RunStream gives each output line, split at \n or \r, to the callback and
// still returns the whole output.
func TestRunStreamGivesLines(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("needs sh")
	}
	var lines []string
	res, err := ExecCommands{}.RunStream(context.Background(), Command{Name: "sh", Args: []string{"-c", `printf 'a\nb\rc\n'; printf 'd' >&2`}}, func(l string) { lines = append(lines, l) })
	if err != nil || res.ExitCode != 0 {
		t.Fatalf("%v %+v", err, res)
	}
	if len(lines) != 3 || lines[0] != "a" || lines[1] != "b" || lines[2] != "c" {
		t.Fatalf("lines %q", lines)
	}
	if res.Stdout != "a\nb\rc\n" || res.Stderr != "d" {
		t.Fatalf("output %+v", res)
	}
}
