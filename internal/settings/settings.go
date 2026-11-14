// Package settings reads and changes the controller settings: retention
// (observability R5.32, R6.8), the backup time and the number of backup days
// (operations R5.21, R5.23). A value outside its floor and ceiling is refused
// with the allowed range. Every change writes one audit row in the same
// transaction (observability R5.24, R5.25).
//
// Other areas read settings with Service.Get. Unset keys have the defaults
// below, so a fresh database needs no seeding.
package settings

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/luis-mc/ci-runners-shared-pool/internal/audit"
	"github.com/luis-mc/ci-runners-shared-pool/internal/store"
)

// Settings are the controller settings with defaults applied.
type Settings struct {
	RetentionJobHistoryDays    int
	RetentionLogsDays          int
	RetentionLogsMiBPerMachine int
	RetentionAuditDays         int
	RetentionLoadRawHours      int
	BackupTimeLocal            string // HH:MM, 24-hour local time
	BackupKeepDays             int
	MaxEventStreams            int
	// AutoUpdate is operations R5.15: on by default; a newer stable release
	// installs by itself after a drain.
	AutoUpdate bool
}

// Patch is a partial change. A nil field is left alone.
type Patch struct {
	RetentionJobHistoryDays    *int
	RetentionLogsDays          *int
	RetentionLogsMiBPerMachine *int
	RetentionAuditDays         *int
	RetentionLoadRawHours      *int
	BackupTimeLocal            *string
	BackupKeepDays             *int
	MaxEventStreams            *int
	AutoUpdate                 *bool
}

// Defaults are the owner's defaults (observability R6.8, operations R5.21).
var Defaults = Settings{
	RetentionJobHistoryDays:    90,
	RetentionLogsDays:          14,
	RetentionLogsMiBPerMachine: 512,
	RetentionAuditDays:         400,
	RetentionLoadRawHours:      24,
	BackupTimeLocal:            "03:00",
	BackupKeepDays:             14,
	MaxEventStreams:            50,
	AutoUpdate:                 true,
}

// Range is the floor and ceiling of a numeric setting.
type Range struct{ Min, Max int }

// Ranges match the Settings schema in packages/contract/openapi.yaml.
var Ranges = map[string]Range{
	"retention_job_history_days":     {7, 400},
	"retention_logs_days":            {1, 90},
	"retention_logs_mib_per_machine": {64, 10240},
	"retention_audit_days":           {90, 1825},
	"retention_load_raw_hours":       {1, 168},
	"backup_keep_days":               {1, 365},
	"max_event_streams":              {1, 200},
}

// RangeError lists every refused value with its allowed range.
type RangeError struct {
	Problems []string
}

func (e *RangeError) Error() string { return strings.Join(e.Problems, "; ") }

var hhmm = regexp.MustCompile(`^([01][0-9]|2[0-3]):[0-5][0-9]$`)

// Service reads and writes settings.
type Service struct {
	db *store.Store
}

// New returns the settings service over db.
func New(db *store.Store) *Service { return &Service{db: db} }

// Get returns the settings with defaults for every key not stored. A stored
// value that no longer fits its range (an edited database) falls back to the
// default, so a bad row never stops retention or backup.
func (s *Service) Get(ctx context.Context) (Settings, error) {
	rows, err := s.db.ListSettings(ctx)
	if err != nil {
		return Settings{}, err
	}
	out := Defaults
	for _, r := range rows {
		switch r.Key {
		case "auto_update":
			var v bool
			if json.Unmarshal([]byte(r.Value), &v) == nil {
				out.AutoUpdate = v
			}
		case "backup_time_local":
			var v string
			if json.Unmarshal([]byte(r.Value), &v) == nil && hhmm.MatchString(v) {
				out.BackupTimeLocal = v
			}
		default:
			var v int
			if json.Unmarshal([]byte(r.Value), &v) != nil || !inRange(r.Key, v) {
				continue
			}
			if p := intField(&out, r.Key); p != nil {
				*p = v
			}
		}
	}
	return out, nil
}

func inRange(key string, v int) bool {
	r, ok := Ranges[key]
	return ok && v >= r.Min && v <= r.Max
}

func intField(s *Settings, key string) *int {
	switch key {
	case "retention_job_history_days":
		return &s.RetentionJobHistoryDays
	case "retention_logs_days":
		return &s.RetentionLogsDays
	case "retention_logs_mib_per_machine":
		return &s.RetentionLogsMiBPerMachine
	case "retention_audit_days":
		return &s.RetentionAuditDays
	case "retention_load_raw_hours":
		return &s.RetentionLoadRawHours
	case "backup_keep_days":
		return &s.BackupKeepDays
	case "max_event_streams":
		return &s.MaxEventStreams
	}
	return nil
}

// Update validates p, writes the changed keys and one audit row in one
// transaction, and returns the new settings. A refused change writes a
// "refused" audit row and changes nothing.
func (s *Service) Update(ctx context.Context, actor audit.Actor, p Patch) (Settings, error) {
	before, err := s.Get(ctx)
	if err != nil {
		return Settings{}, err
	}
	after := before
	ints := map[string]*int{
		"retention_job_history_days":     p.RetentionJobHistoryDays,
		"retention_logs_days":            p.RetentionLogsDays,
		"retention_logs_mib_per_machine": p.RetentionLogsMiBPerMachine,
		"retention_audit_days":           p.RetentionAuditDays,
		"retention_load_raw_hours":       p.RetentionLoadRawHours,
		"backup_keep_days":               p.BackupKeepDays,
		"max_event_streams":              p.MaxEventStreams,
	}
	var problems []string
	changes := map[string]any{}
	writes := map[string]string{}
	for _, key := range sortedKeys(Ranges) {
		v := ints[key]
		if v == nil {
			continue
		}
		r := Ranges[key]
		if *v < r.Min || *v > r.Max {
			problems = append(problems, fmt.Sprintf("%s must be between %d and %d", key, r.Min, r.Max))
			continue
		}
		old := *intField(&before, key)
		*intField(&after, key) = *v
		if old != *v {
			changes[key] = strconv.Itoa(old) + " -> " + strconv.Itoa(*v)
			writes[key] = strconv.Itoa(*v)
		}
	}
	if p.BackupTimeLocal != nil {
		v := *p.BackupTimeLocal
		switch {
		case !hhmm.MatchString(v):
			problems = append(problems, "backup_time_local must be HH:MM in 24-hour time, from 00:00 to 23:59")
		case v != before.BackupTimeLocal:
			after.BackupTimeLocal = v
			changes["backup_time_local"] = before.BackupTimeLocal + " -> " + v
			b, _ := json.Marshal(v)
			writes["backup_time_local"] = string(b)
		}
	}
	if p.AutoUpdate != nil && *p.AutoUpdate != before.AutoUpdate {
		after.AutoUpdate = *p.AutoUpdate
		changes["auto_update"] = strconv.FormatBool(before.AutoUpdate) + " -> " + strconv.FormatBool(*p.AutoUpdate)
		writes["auto_update"] = strconv.FormatBool(*p.AutoUpdate)
	}
	target := audit.Target{Type: "settings", ID: "controller"}
	if len(problems) > 0 {
		_ = audit.New(s.db).RecordRefused(ctx, actor, "settings.update", target, map[string]any{"summary": strings.Join(problems, "; ")})
		return Settings{}, &RangeError{Problems: problems}
	}
	if len(writes) == 0 {
		return after, nil
	}
	err = s.db.WithTx(ctx, func(tx *store.Tx) error {
		for _, key := range sortedKeys(writes) {
			if err := tx.SetSetting(key, writes[key], actor.Login); err != nil {
				return err
			}
		}
		return audit.RecordTx(tx, actor, "settings.update", target, changes)
	})
	if err != nil {
		return Settings{}, err
	}
	return after, nil
}

func sortedKeys[V any](m map[string]V) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	// small maps: insertion sort keeps the file free of another import
	for i := 1; i < len(keys); i++ {
		for j := i; j > 0 && keys[j] < keys[j-1]; j-- {
			keys[j], keys[j-1] = keys[j-1], keys[j]
		}
	}
	return keys
}
