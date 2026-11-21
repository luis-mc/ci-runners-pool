export * from './parts.mjs';
import { esc, tag, code, table, status } from './parts.mjs';
import { labels, LABEL_CAP } from './model.mjs';
/** Routing labels and the runners that carry them now. Would become a shared Table column set (label, jobs, carriers, fallback). */
export const labelTable = (opts = {}) => table('Routing labels', ['Label', 'Jobs', 'Runner carrying it', 'Fallback'], labels.map((l) => [`<span class="pv-code">${esc(l.label)}</span>${l.shared ? ' ' + tag('shared: over cap of ' + LABEL_CAP) : ''}`, l.jobs.map(code).join(' '), l.carriers.length ? l.carriers.map(code).join(' ') : `${status('waiting', 'none yet')} <span class="pv-note">${esc(l.planned)}</span>`, code(l.fallback)]));
