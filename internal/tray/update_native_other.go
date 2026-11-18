//go:build !windows

package tray

// OSNativeWindow is nil: macOS and Linux open the console's update page (task TRAY7 builds
// their windows).
func OSNativeWindow(string, string) NativeWindow { return nil }

// OSToast is the desktop notice; a click cannot be caught here.
func OSToast(title, body string, _ func()) { DesktopNotice(title, body) }
