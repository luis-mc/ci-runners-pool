// Runs before the first paint (a classic script in <head>): puts the saved theme name and mode on the page,
// so there is no flash of the default theme. The names match packages/ui/src/themes.ts.
(function () {
  try {
    var root = document.documentElement;
    var names = ['phosphor', 'tokyo-night', 'catppuccin', 'gruvbox', 'solarized', 'nord'];
    var name = window.localStorage.getItem('crsp.theme-name');
    if (names.indexOf(name) >= 0) root.setAttribute('data-theme-name', name);
    var mode = window.localStorage.getItem('crsp.theme-mode');
    // Nothing saved yet: a new install is dark (owner decision D4). Only a saved "system" follows the device.
    if (mode === 'dark' || mode === 'light') root.setAttribute('data-theme', mode);
    else if (mode !== 'system') root.setAttribute('data-theme', 'dark');
  } catch (e) {
    // Storage is blocked: the page keeps the default theme.
  }
})();
