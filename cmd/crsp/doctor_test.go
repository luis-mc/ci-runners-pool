package main

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDoctorCommandExitCodes(t *testing.T) {
	body := func(worst string) http.HandlerFunc {
		return func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(202)
			_, _ = w.Write([]byte(`{"id":"dr_1","trigger":"cli","state":"done","started_at":"2026-11-14T10:00:00Z","worst":"` + worst + `","counts":{"` + worst + `":1},"findings":[{"check":"machine.disk","subject":{"kind":"machine","id":"m","name":"a"},"severity":"` + worst + `","title":"t","fix":{"text":"f"},"needs_admin":false,"milestone":1,"checked_at":"2026-11-14T10:00:00Z"}]}`))
		}
	}
	for worst, want := range map[string]int{"warn": 0, "fail": 1} {
		srv := httptest.NewServer(body(worst))
		t.Setenv("CRSP_URL", srv.URL)
		var out, errb bytes.Buffer
		if code := run([]string{"doctor", "--json"}, &out, &errb); code != want || !strings.Contains(out.String(), `"worst": "`+worst+`"`) {
			t.Errorf("%s: exit %d, want %d\n%s%s", worst, code, want, out.String(), errb.String())
		}
		srv.Close()
	}
	t.Setenv("CRSP_URL", "http://127.0.0.1:1")
	var out, errb bytes.Buffer
	if code := run([]string{"doctor"}, &out, &errb); code != 3 {
		t.Errorf("unreachable controller: exit %d", code)
	}
}
