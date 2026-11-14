package webui

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
)

func get(h http.Handler, target string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequestWithContext(context.Background(), http.MethodGet, target, nil))
	return rec
}

func TestEmbeddedPlaceholderServes(t *testing.T) {
	rec := get(Handler(), "/some/client/route")
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "CI Runners Shared Pool") {
		t.Fatalf("status %d body %q", rec.Code, rec.Body.String())
	}
}

func TestSPAFallbackAndAssets(t *testing.T) {
	fsys := fstest.MapFS{
		"index.html":    {Data: []byte("<html>app</html>")},
		"assets/app.js": {Data: []byte("console.log(1)")},
	}
	h := handlerFor(fsys)

	if rec := get(h, "/runners/3"); rec.Code != 200 || !strings.Contains(rec.Body.String(), "app") {
		t.Fatalf("client route: %d %q", rec.Code, rec.Body.String())
	}
	if rec := get(h, "/assets/app.js"); rec.Code != 200 || !strings.Contains(rec.Body.String(), "console.log") {
		t.Fatalf("asset: %d %q", rec.Code, rec.Body.String())
	}
	if rec := get(h, "/assets/missing.js"); rec.Code != http.StatusNotFound {
		t.Fatalf("missing asset: %d", rec.Code)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequestWithContext(context.Background(), http.MethodPost, "/", nil))
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("POST: %d", rec.Code)
	}
}
