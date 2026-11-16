// Runs before the first paint (a classic script in <head>): puts the saved theme name and mode on the page,
// so there is no flash of the default theme. The names match packages/ui/src/themes.ts.
(function () {
  try {
    var root = document.documentElement;
    var names = ['phosphor', 'tokyo-night', 'catppuccin', 'gruvbox', 'solarized', 'nord'];
    var name = window.localStorage.getItem('crsp.theme-name');
    // A new install is Phosphor, dark (owner decision LOOK D11); a saved 'system' leaves the mode to the OS.
    root.setAttribute('data-theme-name', names.indexOf(name) >= 0 ? name : 'phosphor');
    var mode = window.localStorage.getItem('crsp.theme-mode');
    if (mode === 'dark' || mode === 'light') root.setAttribute('data-theme', mode);
    else if (mode === null) root.setAttribute('data-theme', 'dark');
  } catch (e) {
    // Storage is blocked: the page keeps the default theme.
    document.documentElement.setAttribute('data-theme-name', 'phosphor');
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
