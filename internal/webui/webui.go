// Package webui serves the web console, a React single-page app built to static
// files. The build copies apps/web/dist into ./dist (task web:embed). Only
// dist/placeholder.html is committed, so `go build` works without Node.
package webui

import (
	"embed"
	"io/fs"
	"net/http"
	"path"
	"strings"
)

//go:embed all:dist
var embedded embed.FS

// Handler serves the embedded web app from the embedded dist directory.
func Handler() http.Handler {
	sub, err := fs.Sub(embedded, "dist")
	if err != nil {
		panic(err) // dist is part of the embed; its absence is a build error.
	}
	return handlerFor(sub)
}

func handlerFor(root fs.FS) http.Handler {
	files := http.FileServerFS(root)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		name := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if name != "" && name != "index.html" {
			if info, err := fs.Stat(root, name); err == nil && !info.IsDir() {
				files.ServeHTTP(w, r)
				return
			}
			// A path with a file extension that does not exist is a missing asset.
			if path.Ext(name) != "" {
				http.NotFound(w, r)
				return
			}
		}
		// Anything else is a client-side route: serve the app shell.
		page := "index.html"
		if _, err := fs.Stat(root, page); err != nil {
			page = "placeholder.html"
		}
		data, err := fs.ReadFile(root, page)
		if err != nil {
			http.Error(w, "web console is not built into this binary", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache")
		_, _ = w.Write(data)
	})
}
