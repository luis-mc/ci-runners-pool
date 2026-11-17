#!/usr/bin/env python3
"""Writes docs/review/LOOK22/index.html: the options side by side, one row per state."""
import html, os
here = os.path.dirname(os.path.abspath(__file__)); out = os.path.dirname(here)
COLS = [("baseline", "Today: 4-step wizard"), ("A", "A: plain section"), ("B", "B: sliders and room bar"), ("C", "C: summary and Edit")]
ROWS = {
 "baseline": ["first-run", "review", "done"],
 "A": ["clean", "recommended", "editing-ok", "editing-warning", "editing-error", "saving", "saved"],
 "B": ["clean", "recommended", "editing-ok", "editing-warning", "editing-error", "saving", "saved"],
 "C": ["clean", "editing-clean", "recommended", "editing-ok", "editing-warning", "editing-error", "saving", "saved"],
}
def sec(vp):
    s = f"<h2>{vp.title()} ({'1300' if vp=='desktop' else '393'} px), Phosphor dark</h2><div class='grid'>"
    for k, name in COLS:
        s += f"<section><h3>{html.escape(name)}</h3>"
        for st in ROWS[k]:
            f = f"{k}-{st}-{vp}.png"
            if os.path.exists(os.path.join(out, f)):
                s += f"<figure><figcaption>{k} / {st}</figcaption><a href='{f}'><img loading='lazy' src='{f}' alt='{k} {st} {vp}'></a></figure>"
        s += "</section>"
    return s + "</div>"
open(os.path.join(out, "index.html"), "w").write(f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LOOK22 pool size options</title><style>
body{{background:#0b120c;color:#cfe;font:14px/1.4 ui-monospace,monospace;margin:16px}}
.grid{{display:grid;grid-template-columns:repeat(4,minmax(320px,1fr));gap:16px;overflow-x:auto}}
img{{max-width:100%;border:1px solid #365}}figcaption{{color:#8a9;margin:8px 0 2px}}h3{{border-bottom:1px solid #365}}
a{{color:#7f9}}</style></head><body><h1>LOOK22: pool size as a settings section (options, no decision)</h1>
<p>Real console (apps/web) with a mocked API. Report: <a href="../../work/LOOK22.md">docs/work/LOOK22.md</a>. Click an image for full size.</p>
{sec('desktop')}{sec('phone')}</body></html>""")
