// Part of components 50 to 55: the text alternative of a visual part (UX-41, UX-17). A real table, folded under the
// chart in a section that says "Show as table"; the chart itself has role="img" with the label.
import { Disclosure } from './Rows';

export const SHOW_AS_TABLE = 'Show as table';

export function VizAlt({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: readonly string[];
  rows: readonly (readonly string[])[];
}) {
  return (
    <Disclosure summary={SHOW_AS_TABLE}>
      <table className="ds-viz-table">
        <caption className="ds-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={`${i}-${h}`} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, i) =>
                i === 0 ? (
                  <th key={i} scope="row">
                    {cell}
                  </th>
                ) : (
                  <td key={i}>{cell}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </Disclosure>
  );
}
