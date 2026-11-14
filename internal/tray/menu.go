package tray

// Menu item labels. Words come from docs/design-system/v1/content.md (R6.7).
const (
	LabelOpen         = "Open"
	LabelOpenLogs     = "Open log folder"
	LabelStartAtLogin = "Start at login"
	LabelQuit         = "Quit"
)

// MenuItem is one entry of the tray menu.
type MenuItem struct {
	Label   string
	Action  bool // pressable
	Switch  bool // has a tick
	Checked bool
}

// MenuM1 returns the M1 menu in order (R5.1). The first line is the status text.
func MenuM1(status Status, startAtLogin bool) []MenuItem {
	return []MenuItem{
		{Label: status.Text()},
		{Label: LabelOpen, Action: true},
		{Label: LabelOpenLogs, Action: true},
		{Label: LabelStartAtLogin, Action: true, Switch: true, Checked: startAtLogin},
		{Label: LabelQuit, Action: true},
	}
}
