//go:build windows

package tray

import "testing"

func TestDialogProcAttrShowsTheForm(t *testing.T) {
	a := dialogProcAttr()
	if a.HideWindow {
		t.Fatal("HideWindow hides the dialog form")
	}
	if a.CreationFlags&createNoWindow == 0 {
		t.Fatal("CREATE_NO_WINDOW is not set")
	}
}
