package addresses_test

import (
	"go/ast"
	"go/parser"
	"go/token"
	"io/fs"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"testing"
)

// allowlist holds the literals that may stay outside addresses.go. Each entry
// names the file and the literal and says why it is not an address crsp
// chooses. Keep it tiny.
var allowlist = map[string]string{}

// literalAddress matches a string that starts with an absolute address and a host.
var literalAddress = regexp.MustCompile(`^\^?https?://[A-Za-z0-9]`)

// skipped are the places that are not hand-written application code.
func skipped(rel string) bool {
	switch {
	case rel == "internal/addresses/addresses.go":
		return true // the one file that holds the defaults
	case strings.HasPrefix(rel, "internal/api/gen/"), strings.HasPrefix(rel, "internal/api/client/"),
		strings.HasPrefix(rel, "internal/github/fake/"), strings.HasSuffix(rel, ".gen.go"):
		return true // generated code and the fake GitHub
	}
	return false
}

// TestNoLiteralAddressesInGo: every address crsp calls or links to comes from
// the settings (CRSP_GITHUB_URL and the others), never from a literal in code
// (operations OPS35). Comments are not string literals, so examples there pass.
func TestNoLiteralAddressesInGo(t *testing.T) {
	root := filepath.Join("..", "..")
	fset := token.NewFileSet()
	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, _ := filepath.Rel(root, path)
		rel = filepath.ToSlash(rel)
		if d.IsDir() {
			switch d.Name() {
			case "node_modules", ".git", "vendor", "docs":
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(rel, ".go") || strings.HasSuffix(rel, "_test.go") || skipped(rel) {
			return nil
		}
		f, perr := parser.ParseFile(fset, path, nil, parser.SkipObjectResolution)
		if perr != nil {
			t.Errorf("%s: %v", rel, perr)
			return nil
		}
		ast.Inspect(f, func(n ast.Node) bool {
			lit, ok := n.(*ast.BasicLit)
			if !ok || lit.Kind != token.STRING {
				return true
			}
			val, uerr := strconv.Unquote(lit.Value)
			if uerr != nil || !literalAddress.MatchString(val) {
				return true
			}
			if _, ok := allowlist[rel+" "+val]; ok {
				return true
			}
			t.Errorf("%s: literal address %q; read it from the settings (internal/addresses)", fset.Position(lit.Pos()), val)
			return true
		})
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}
