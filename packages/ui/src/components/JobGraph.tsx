// Component 51: a job graph. The jobs of a run as stages: a job sits one stage after the last job it needs (a
// longest-path layering of the edges). On a wide screen the stages are columns with SVG connectors between the jobs;
// at phone width they are a vertical list of stages and each job says "after: a, b" (UX-49). A job that opens is a
// real button (UX-57). Status is a glyph as well as a colour, the critical path a thick outline and the words
// "critical path" (UX-58). A loop in the edges never crashes: the edge that closes it is dropped. The text
// alternative is a table under "Show as table".
import { STATUS_GLYPH } from './Status';
import { Empty } from './State';
import { VizAlt } from './VizAlt';
import type { JobGraphNode, JobGraphProps } from './Viz.types';

export const JOB_GRAPH_WORDS = {
  after: 'after',
  stage: 'Stage',
  critical: 'critical path',
  job: 'Job',
  detail: 'Detail',
} as const;

export interface Layout {
  /** Node ids per stage, in input order. */
  stages: string[][];
  /** The edges kept: known nodes, no self edge, no edge that closes a loop. */
  edges: [string, string][];
}

/** Longest-path layering. Loops are cut at the edge that closes them (depth-first back edge). */
export function layoutGraph(
  ids: readonly string[],
  edges: readonly (readonly [string, string])[],
): Layout {
  const known = new Set(ids);
  const seen = new Set<string>();
  const kept: [string, string][] = [];
  for (const [a, b] of edges) {
    const key = `${a}\u0000${b}`;
    if (a === b || !known.has(a) || !known.has(b) || seen.has(key)) continue;
    seen.add(key);
    kept.push([a, b]);
  }
  const out = new Map<string, string[]>();
  for (const [a, b] of kept) out.set(a, [...(out.get(a) ?? []), b]);
  // 0 = new, 1 = on the stack, 2 = done
  const state = new Map<string, number>();
  const back = new Set<string>();
  const visit = (start: string) => {
    const stack: { id: string; next: number }[] = [{ id: start, next: 0 }];
    state.set(start, 1);
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      if (!top) break;
      const to = out.get(top.id)?.[top.next++];
      if (to === undefined) {
        state.set(top.id, 2);
        stack.pop();
        continue;
      }
      const s = state.get(to) ?? 0;
      if (s === 1) back.add(`${top.id}\u0000${to}`);
      else if (s === 0) {
        state.set(to, 1);
        stack.push({ id: to, next: 0 });
      }
    }
  };
  for (const id of ids) if ((state.get(id) ?? 0) === 0) visit(id);
  const dag = kept.filter(([a, b]) => !back.has(`${a}\u0000${b}`));
  const level = new Map<string, number>(ids.map((id) => [id, 0]));
  // Relax until stable: a DAG of n nodes settles in at most n passes.
  for (let pass = 0; pass <= ids.length; pass++) {
    let changed = false;
    for (const [a, b] of dag) {
      const want = (level.get(a) ?? 0) + 1;
      if (want > (level.get(b) ?? 0)) {
        level.set(b, want);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const stages: string[][] = [];
  for (const id of ids) {
    const l = level.get(id) ?? 0;
    (stages[l] ??= []).push(id);
  }
  return { stages: stages.filter((s): s is string[] => Boolean(s)), edges: dag };
}

function detailOf(node: JobGraphNode): string {
  return [node.sublabel, node.critical ? JOB_GRAPH_WORDS.critical : '']
    .filter(Boolean)
    .join(', ');
}

const CELL = 100;
const INSET = 8;

export function JobGraph({ label, nodes, edges, emptyText }: JobGraphProps) {
  if (nodes.length === 0) return <Empty title={emptyText} />;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const { stages, edges: kept } = layoutGraph(
    nodes.map((n) => n.id),
    edges,
  );
  const place = new Map<string, { col: number; row: number }>();
  stages.forEach((ids, col) => ids.forEach((id, row) => place.set(id, { col, row })));
  const rowsTall = Math.max(1, ...stages.map((s) => s.length));
  const after = (id: string) =>
    kept.filter(([, b]) => b === id).map(([a]) => byId.get(a)?.label ?? a);
  const text = (n: JobGraphNode) => {
    const needs = after(n.id);
    return [
      n.copies && n.copies > 1 ? `${n.label} x ${n.copies}` : n.label,
      detailOf(n),
      needs.length > 0 ? `${JOB_GRAPH_WORDS.after}: ${needs.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join(', ');
  };
  return (
    <div className="ds-jobgraph">
      <div
        // An image hides its children from assistive tech; jobs that open are buttons, so that graph is a group.
        role={nodes.some((n) => n.onOpen) ? 'group' : 'img'}
        aria-label={`${label}: ${stages
          .map(
            (ids, i) =>
              `${JOB_GRAPH_WORDS.stage} ${i + 1}: ${ids
                .map((id) => text(byId.get(id) as JobGraphNode))
                .join('; ')}`,
          )
          .join('. ')}`}
        className="ds-jobgraph__chart"
      >
        <div
          className="ds-jobgraph__stages"
          style={{
            gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))`,
            gridTemplateRows: `auto repeat(${rowsTall}, var(--ds-row-picture))`,
          }}
        >
          <svg
            className="ds-jobgraph__edges"
            viewBox={`0 0 ${stages.length * CELL} ${rowsTall * CELL}`}
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            {kept.map(([a, b]) => {
              const from = place.get(a);
              const to = place.get(b);
              if (!from || !to) return null;
              const x1 = (from.col + 1) * CELL - INSET;
              const y1 = from.row * CELL + CELL / 2;
              const x2 = to.col * CELL + INSET;
              const y2 = to.row * CELL + CELL / 2;
              const mid = (x1 + x2) / 2;
              const crit = byId.get(a)?.critical && byId.get(b)?.critical;
              return (
                <path
                  key={`${a}>${b}`}
                  className="ds-jobgraph__edge"
                  data-critical={crit || undefined}
                  d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
                />
              );
            })}
          </svg>
          {stages.map((ids, col) => (
            <div key={col} className="ds-jobgraph__stage">
              <p className="ds-jobgraph__stage-name" style={{ gridColumn: col + 1 }}>
                {JOB_GRAPH_WORDS.stage} {col + 1}
              </p>
              <ul className="ds-jobgraph__nodes">
                {ids.map((id, row) => {
                  const n = byId.get(id) as JobGraphNode;
                  const needs = after(id);
                  const body = (
                    <>
                      <span className="ds-jobgraph__glyph" aria-hidden="true">
                        {STATUS_GLYPH[n.status]}
                      </span>
                      <span className="ds-jobgraph__text">
                        <span className="ds-jobgraph__name">
                          {n.label}
                          {n.copies && n.copies > 1 ? ` x ${n.copies}` : ''}
                        </span>
                        {n.sublabel ? (
                          <span className="ds-jobgraph__sub">{n.sublabel}</span>
                        ) : null}
                        {n.critical ? (
                          <span className="ds-jobgraph__sub">
                            {JOB_GRAPH_WORDS.critical}
                          </span>
                        ) : null}
                        {needs.length > 0 ? (
                          <span className="ds-jobgraph__after">
                            {JOB_GRAPH_WORDS.after}: {needs.join(', ')}
                          </span>
                        ) : null}
                      </span>
                    </>
                  );
                  return (
                    <li
                      key={id}
                      className="ds-jobgraph__item"
                      style={{ gridColumn: col + 1, gridRow: row + 2 }}
                    >
                      {n.onOpen ? (
                        <button
                          type="button"
                          className="ds-jobgraph__node"
                          data-list-row
                          data-status={n.status}
                          data-current={n.current || undefined}
                          data-critical={n.critical || undefined}
                          onClick={n.onOpen}
                        >
                          {body}
                        </button>
                      ) : (
                        <span
                          className="ds-jobgraph__node"
                          data-status={n.status}
                          data-current={n.current || undefined}
                          data-critical={n.critical || undefined}
                        >
                          {body}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <VizAlt
        caption={label}
        head={[
          JOB_GRAPH_WORDS.job,
          JOB_GRAPH_WORDS.stage,
          JOB_GRAPH_WORDS.after,
          JOB_GRAPH_WORDS.detail,
        ]}
        rows={stages.flatMap((ids, i) =>
          ids.map((id) => {
            const n = byId.get(id) as JobGraphNode;
            return [n.label, String(i + 1), after(id).join(', '), detailOf(n)];
          }),
        )}
      />
    </div>
  );
}
