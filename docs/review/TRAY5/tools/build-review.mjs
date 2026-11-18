// Builds docs/review/TRAY5/index.html from the screenshots in shots/. Run: node build-review.mjs
import { writeFileSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const UP = [
  ['u1-offered', 'Update offered (two buttons)'], ['u2-downloading', 'Downloading'], ['u3-waiting', 'Waiting for jobs'],
  ['u4-installing', 'Installing'], ['u5-restarting', 'Restarting'], ['u6-done', 'Done, after the restart'], ['u7-failed', 'Failed'],
];
const IN = [['i1-welcome', 'Welcome'], ['i2-choices', 'Choices'], ['i3-installing', 'Installing'], ['i4-done', 'Done'], ['i5-failed', 'Failed']];
const OPTS = {
  baseline: { name: 'Today (main)', dir: 'baseline', w: 550, icon: 'globe', title: 'CI Runners Shared Pool', btns: 'min max close', note: 'Owner screenshot size 1100 x 880, shown at half size. No icon is set, so the browser draws a globe.' },
  A: { name: 'A: compact dialog', dir: 'A', w: 560, icon: 'crsp', title: 'Update - CI Runners Shared Pool', btns: 'close', note: '560 x 420, close only (native host).' },
  B: { name: 'B: one frame', dir: 'B', w: 560, icon: 'crsp', title: 'Update - CI Runners Shared Pool', btns: 'min max close', note: '560 wide, height follows the content (here 440). Browser app window: min and max stay.' },
  C: { name: 'C: native look', dir: 'C', w: 500, icon: 'crsp', title: 'CI Runners Shared Pool Update', btns: 'close', note: '500 x 370. Windows colours, not the Phosphor theme.' },
};
const frame = (o, src, theme, title) => {
  const k = OPTS[o];
  const ic = k.icon === 'globe' ? '<span class="globe" aria-hidden="true">&#127760;</span>' : '<img src="shots/crsp-32.png" width="16" height="16" alt="">';
  const b = k.btns.split(' ').map((x) => `<span class="cap ${x}" aria-hidden="true">${x === 'min' ? '&#8211;' : x === 'max' ? '&#9633;' : '&#10005;'}</span>`).join('');
  return `<figure class="win ${theme}" style="width:${k.w}px"><div class="tb">${ic}<span class="tt">${title ?? k.title}</span><span class="caps">${b}</span></div><img class="px" src="${src}" width="${k.w}" alt="${k.name}"></figure>`;
};
const cell = (o, id, label, theme, scale, kind) => {
  const k = OPTS[o];
  if (o === 'baseline' && kind === 'in')
    return `<div class="cell"><h4>${k.name}</h4><p class="na">Windows only: the stock WiX minimal dialogs (welcome with licence, progress, finished). Windows Installer draws them; they cannot be rendered on this Linux box, so there is no screenshot. They have no crsp theme and no step list.</p></div>`;
  const dir = o === 'baseline' ? 'baseline' : o;
  const title = kind === 'in' ? (o === 'C' ? 'CI Runners Shared Pool Setup' : 'Setup - CI Runners Shared Pool') : undefined;
  return `<div class="cell"><h4>${k.name}</h4>${frame(o, `shots/${dir}/${id}-${theme}-${scale}.png`, theme, title)}<p class="note">${k.note}</p></div>`;
};
let sections = '';
for (const [kind, list, ttl] of [['up', UP, 'Updater'], ['in', IN, 'Installer']])
  for (const [id, label] of list) {
    let row = '';
    for (const o of ['baseline', 'A', 'B', 'C']) {
      let html = '';
      for (const theme of ['dark', 'light']) for (const scale of ['100', '150'])
        html += `<div class="v v-${theme} v-${scale}">${cell(o, id, label, theme, scale, kind)}</div>`;
      row += html;
    }
    sections += `<section><h3>${ttl}: ${label}</h3><div class="row">${row}</div></section>`;
  }
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>TRAY5 update and installer windows: options</title>
<style>
:root{--bg:#fff;--fg:#111;--mut:#555;--line:#ccc;--card:#f4f4f4}
@media (prefers-color-scheme:dark){:root{--bg:#161616;--fg:#eee;--mut:#aaa;--line:#444;--card:#222}}
body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}
h1{margin:0 0 4px;font-size:22px} h2{margin:32px 0 8px;font-size:18px} h3{margin:24px 0 8px;font-size:16px} h4{margin:0 0 6px;font-size:13px;color:var(--mut)}
.bar{position:sticky;top:0;background:var(--bg);border-bottom:1px solid var(--line);padding:8px 0;margin-bottom:12px;z-index:5;display:flex;gap:20px;flex-wrap:wrap;align-items:center}
.bar label{cursor:pointer} .row{display:flex;gap:16px;align-items:flex-start;overflow-x:auto;padding-bottom:12px}
.cell{flex:0 0 auto} .note,.na{max-width:520px;color:var(--mut);font-size:12px;margin:4px 0 0} .na{width:360px;border:1px dashed var(--line);padding:8px}
.win{margin:0;border:1px solid #888;background:#fff} .tb{display:flex;align-items:center;gap:8px;height:30px;padding-left:8px;font:12px system-ui,sans-serif}
.win.light .tb{background:#f3f3f3;color:#111} .win.dark .tb{background:#202020;color:#eee}
.tt{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.caps{display:flex}.cap{width:40px;text-align:center;line-height:30px}.cap.close:hover{background:#c42b1c}
.px{display:block}.globe{font-size:14px;line-height:1}
.v{display:contents}
body:not(:has(#t-dark:checked)) .v-dark,body:has(#t-dark:checked) .v-light{display:none}
body:not(:has(#s-100:checked)) .v-100,body:has(#s-100:checked) .v-150{display:none}
.v:not(.v-dark.v-100){} 
table{border-collapse:collapse;width:100%;font-size:13px} td,th{border:1px solid var(--line);padding:6px 8px;vertical-align:top;text-align:left} th{background:var(--card)}
.wrap{overflow-x:auto} code{background:var(--card);padding:0 4px}
</style></head><body>
<h1>TRAY5: update window and installer windows, three options</h1>
<p>Review only. The owner chooses; nothing here is shipped. Every window is a real screenshot of the real web app (the page the tray opens) with the service answers mocked; each option is a prototype patch in <code>patches/</code>, and no app code is changed in this branch. The title bar of each window is drawn by this page (the page cannot show the OS frame); the content below it is the screenshot. Installer shots are the same web page in an installer host: Windows Installer, the macOS installer and Linux package managers cannot be rendered here, so no screenshot is the native thing (see REPORT.md).</p>
<div class="bar"><span><b>Theme</b>
<label><input type="radio" name="t" id="t-dark" checked> Phosphor dark</label>
<label><input type="radio" name="t" id="t-light"> Phosphor light</label></span>
<span><b>Scaling</b>
<label><input type="radio" name="s" id="s-100" checked> 100%</label>
<label><input type="radio" name="s" id="s-150"> 150%</label></span>
<span>Option C uses the Windows light or dark colours (a native dialog cannot follow Phosphor).</span></div>
<h2>Windows today, and the three options, state by state</h2>
${sections}
<h2>Sizes per state</h2>
<div class="wrap"><table><tr><th></th><th>A</th><th>B</th><th>C</th></tr>
<tr><th>Window</th><td>560 x 420 fixed. Every state fits; the right pane scrolls only for a long failure text.</td><td>560 wide. Height 360 to 440 follows the content (the page asks the host to resize on each step).</td><td>500 x 370 fixed (same ratio as a WiX dialog of 370 x 270 units).</td></tr>
<tr><th>At 150% scaling</th><td>Same size in device-independent pixels, so 840 x 630 physical. Nothing changes in the layout.</td><td>Same as A: 840 physical wide; height follows.</td><td>The MSI dialog is not DPI aware on its own: Windows scales it up as a bitmap (soft text). The web replica stays sharp.</td></tr></table></div>
</body></html>`;
writeFileSync(root + 'index.html', html);
console.log('index.html', html.length);
