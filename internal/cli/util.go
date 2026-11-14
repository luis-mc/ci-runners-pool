package cli

import (
	"sort"
	"strconv"
	"strings"
)

func sortedStrings(s []string) []string {
	sort.Strings(s)
	return s
}

func splitList(s string) []string {
	out := []string{}
	for _, p := range strings.Split(s, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

func mustInt(s string) int {
	n, _ := strconv.Atoi(s)
	return n
}

// nonNil keeps an empty list as [] in JSON, not null.
func nonNil[T any](s []T) []T {
	if s == nil {
		return []T{}
	}
	return s
}

func deref[T any](p *T) T {
	var z T
	if p == nil {
		return z
	}
	return *p
}
