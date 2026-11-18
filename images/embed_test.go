package images

import (
	"bytes"
	"io/fs"
	"os"
	"path/filepath"
	"testing"
)

// TestEmbeddedTreeMatchesFolder proves the binary carries exactly the files of
// images/: none missing, none changed, none extra.
func TestEmbeddedTreeMatchesFolder(t *testing.T) {
	onDisk := map[string][]byte{}
	for _, top := range []string{"linux-base", "layers", "persistent"} {
		err := filepath.WalkDir(top, func(p string, d fs.DirEntry, err error) error {
			if err != nil || d.IsDir() {
				return err
			}
			b, err := os.ReadFile(p)
			onDisk[filepath.ToSlash(p)] = b
			return err
		})
		if err != nil {
			t.Fatal(err)
		}
	}
	embedded := map[string][]byte{}
	err := fs.WalkDir(FS, ".", func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		b, err := fs.ReadFile(FS, p)
		embedded[p] = b
		return err
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(onDisk) == 0 {
		t.Fatal("no image files found")
	}
	for p, want := range onDisk {
		got, ok := embedded[p]
		if !ok {
			t.Errorf("%s is in images/ but not in the binary", p)
		} else if !bytes.Equal(got, want) {
			t.Errorf("%s differs from the file in images/", p)
		}
	}
	for p := range embedded {
		if _, ok := onDisk[p]; !ok {
			t.Errorf("%s is in the binary but not in images/", p)
		}
	}
}

// TestEmbeddedFilesAreSmallText keeps the binary small: text only, and a small
// total.
func TestEmbeddedFilesAreSmallText(t *testing.T) {
	total := 0
	err := fs.WalkDir(FS, ".", func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		b, err := fs.ReadFile(FS, p)
		if err != nil {
			return err
		}
		total += len(b)
		if bytes.IndexByte(b, 0) >= 0 {
			t.Errorf("%s is not a text file", p)
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if total > 256<<10 {
		t.Errorf("embedded images are %d bytes; the limit is 256 KiB", total)
	}
}
