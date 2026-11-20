package fsdriver

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// PutContent replaces an existing file and leaves no temporary file behind
// (on Windows the rename failed while the temporary file was open).
func TestPutContentReplaces(t *testing.T) {
	dir := t.TempDir()
	d, err := New(map[string]any{"rootdirectory": dir})
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	for _, v := range []string{"one", "two"} {
		if err := d.PutContent(ctx, "/a/b/startedat", []byte(v)); err != nil {
			t.Fatal(err)
		}
	}
	got, err := d.GetContent(ctx, "/a/b/startedat")
	if err != nil || string(got) != "two" {
		t.Fatalf("%q %v", got, err)
	}
	ents, _ := os.ReadDir(filepath.Join(dir, "a", "b"))
	for _, e := range ents {
		if strings.HasSuffix(e.Name(), ".tmp") {
			t.Fatalf("temporary file left: %s", e.Name())
		}
	}
}
