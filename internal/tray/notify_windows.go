//go:build windows

package tray

import "golang.org/x/sys/windows"

// DesktopNotice shows one notice in a message box on its own thread.
func DesktopNotice(title, body string) {
	t, _ := windows.UTF16PtrFromString(title)
	b, _ := windows.UTF16PtrFromString(body)
	go func() {
		_, _ = windows.MessageBox(0, b, t, windows.MB_OK|windows.MB_ICONINFORMATION|windows.MB_SETFOREGROUND)
	}()
}
