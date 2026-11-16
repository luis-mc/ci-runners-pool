// Package installer holds a check of the MSI authoring that runs on every OS.
package installer

import (
	"os"
	"regexp"
	"strings"
	"testing"
)

func wxs(t *testing.T) string {
	t.Helper()
	b, err := os.ReadFile("crsp.wxs")
	if err != nil {
		t.Fatal(err)
	}
	// Comments may name what was removed; only the authored elements count.
	return regexp.MustCompile(`(?s)<!--.*?-->`).ReplaceAllString(string(b), "")
}

// CRSP147: one entry in the Windows programs list, replaced by every upgrade. The package
// authors no second (hand-made) Uninstall key and hides nothing: its own entry is the only one.
func TestMSIHasOneProgramsListEntry(t *testing.T) {
	s := wxs(t)
	if strings.Contains(s, `CurrentVersion\Uninstall`) {
		t.Error("the package must not write its own Uninstall key: it would be a second entry next to the MSI's")
	}
	if strings.Contains(s, "ARPSYSTEMCOMPONENT") {
		t.Error("no hidden MSI entry: with one authored entry there is nothing to hide")
	}
}

// A newer MSI replaces the old product: one fixed UpgradeCode, a major upgrade that also
// replaces the same a.b.c, and a refused downgrade.
func TestMSIUpgradeReplacesTheOldProduct(t *testing.T) {
	s := wxs(t)
	if n := strings.Count(s, `UpgradeCode="C1D62442-6DB4-4FF0-9F28-A1CE3121B332"`); n != 1 {
		t.Errorf("the UpgradeCode must be the shipped one, once: %d", n)
	}
	if !strings.Contains(s, "<MajorUpgrade") || !strings.Contains(s, `AllowSameVersionUpgrades="yes"`) || !strings.Contains(s, "DowngradeErrorMessage") {
		t.Error("MajorUpgrade with same-version upgrades and a downgrade message is missing")
	}
	if strings.Contains(s, `Scope="perUser"`) || !strings.Contains(s, `Scope="perMachine"`) {
		t.Error("one per-machine package: a per-user twin would list twice")
	}
	if strings.Count(s, "<Package ") != 1 || strings.Contains(s, "<Bundle") {
		t.Error("one product: no bundle next to the MSI")
	}
}
