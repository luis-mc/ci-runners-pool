// @vitest-environment jsdom
// RES15: waterfall, job graph, trend chart, sparkline, heatmap and forecast chart.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ForecastChart, Heatmap, Sparkline, TrendChart } from './Charts';
import { JobGraph, layoutGraph } from './JobGraph';
import { Waterfall } from './Waterfall';
import type { JobGraphNode, WaterfallRow } from './Viz.types';

afterEach(cleanup);

const rows: WaterfallRow[] = [
  {
    id: 'a',
    label: 'Checkout',
    group: 'Job build',
    status: 'ok',
    startSec: 0,
    endSec: 20,
    detail: 'ran 20 s',
  },
  {
    id: 'b',
    label: 'Test',
    group: 'Job build',
    status: 'running',
    startSec: 40,
    endSec: 100,
    waitFromSec: 20,
    forecast: { loSec: 100, hiSec: 140 },
    critical: true,
    detail: 'ran 1 min, forecast 2-2.5 min',
  },
];

describe('shared text alternative (altTable)', () => {
  const nodes: JobGraphNode[] = [
    { id: 'a', label: 'lint', status: 'ok' },
    { id: 'b', label: 'test', status: 'ok' },
  ];
  it('Waterfall draws no table of its own and points to the table on the page', () => {
    render(
      <>
        <Waterfall label="Jobs" rows={rows} emptyText="none" altTable="jobs-table" />
        <div id="jobs-table">the table</div>
      </>,
    );
    expect(screen.queryByText('Show as table')).toBeNull();
    expect(screen.getByRole('img').getAttribute('aria-describedby')).toBe('jobs-table');
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('Jobs');
  });
  it('JobGraph draws no table of its own and points to the table on the page', () => {
    render(
      <JobGraph
        label="Jobs"
        nodes={nodes}
        edges={[['a', 'b']]}
        emptyText="none"
        altTable="jobs-table"
      />,
    );
    expect(screen.queryByText('Show as table')).toBeNull();
    expect(screen.getByRole('img').getAttribute('aria-describedby')).toBe('jobs-table');
  });
  it('without it both keep their own table and point to nothing', () => {
    render(
      <>
        <Waterfall label="Jobs" rows={rows} emptyText="none" />
        <JobGraph label="Jobs" nodes={nodes} edges={[]} emptyText="none" />
      </>,
    );
    expect(screen.getAllByText('Show as table')).toHaveLength(2);
    for (const img of screen.getAllByRole('img'))
      expect(img.getAttribute('aria-describedby')).toBeNull();
  });
});

describe('Waterfall', () => {
  it('has a label and a table with every row', () => {
    render(
      <Waterfall
        label="Steps of job build"
        rows={rows}
        nowSec={100}
        emptyText="No steps"
      />,
    );
    const img = screen.getByRole('img');
    expect(img.getAttribute('aria-label')).toContain('Steps of job build');
    expect(img.getAttribute('aria-label')).toContain('critical path');
    expect(screen.getByText('Show as table')).toBeTruthy();
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });
  it('opens a row with the keyboard', () => {
    const open = vi.fn();
    render(
      <Waterfall
        label="Steps"
        rows={[{ ...(rows[0] as WaterfallRow), onOpen: open }]}
        emptyText="none"
      />,
    );
    const button = screen.getByRole('button', { name: /Checkout/ });
    button.focus();
    fireEvent.click(button);
    expect(open).toHaveBeenCalled();
  });
  it('says so when empty', () => {
    render(<Waterfall label="Steps" rows={[]} emptyText="No steps yet" />);
    expect(screen.getByText('No steps yet')).toBeTruthy();
  });
});

const nodes: JobGraphNode[] = ['a', 'b', 'c', 'd'].map((id) => ({
  id,
  label: `job ${id}`,
  status: 'ok' as const,
}));

describe('JobGraph', () => {
  it('layers by longest path', () => {
    const { stages } = layoutGraph(
      ['a', 'b', 'c', 'd'],
      [
        ['a', 'b'],
        ['b', 'c'],
        ['a', 'c'],
      ],
    );
    expect(stages).toEqual([['a', 'd'], ['b'], ['c']]);
  });
  it('survives a loop and unknown ids', () => {
    const out = layoutGraph(
      ['a', 'b', 'c'],
      [
        ['a', 'b'],
        ['b', 'c'],
        ['c', 'a'],
        ['a', 'a'],
        ['x', 'a'],
      ],
    );
    expect(out.stages.flat().sort()).toEqual(['a', 'b', 'c']);
    render(
      <JobGraph
        label="Jobs"
        nodes={nodes.slice(0, 3)}
        edges={[
          ['a', 'b'],
          ['b', 'c'],
          ['c', 'a'],
        ]}
        emptyText="none"
      />,
    );
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('Jobs');
  });
  it('says after: and opens a node', () => {
    const open = vi.fn();
    render(
      <JobGraph
        label="Jobs"
        nodes={[
          nodes[0] as JobGraphNode,
          { ...(nodes[1] as JobGraphNode), onOpen: open, copies: 3 },
        ]}
        edges={[['a', 'b']]}
        emptyText="none"
      />,
    );
    expect(screen.getAllByText('after: job a').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /job b x 3/ }));
    expect(open).toHaveBeenCalled();
  });
  it('lays out 14 nodes in 5 stages', () => {
    const many = Array.from({ length: 14 }, (_, i) => ({
      id: `n${i}`,
      label: `n${i}`,
      status: 'ok' as const,
    }));
    const edges = many.slice(3).map((n, i) => [`n${Math.max(0, i - 2)}`, n.id] as const);
    const { stages } = layoutGraph(
      many.map((n) => n.id),
      edges,
    );
    expect(stages.flat()).toHaveLength(14);
    render(<JobGraph label="Many" nodes={many} edges={edges} emptyText="none" />);
    expect(screen.getByRole('img')).toBeTruthy();
  });
  it('says so when empty', () => {
    render(<JobGraph label="Jobs" nodes={[]} edges={[]} emptyText="No jobs" />);
    expect(screen.getByText('No jobs')).toBeTruthy();
  });
});

describe('charts', () => {
  it('trend chart: label, table and empty state', () => {
    render(
      <TrendChart
        label="Wait time"
        unit="seconds"
        emptyText="Nothing yet"
        series={[
          {
            id: 's',
            label: 'Median',
            points: [
              { x: 1_700_000_000_000, y: 30, lo: 20, hi: 40 },
              { x: 1_700_086_400_000, y: 60, note: 'busy' },
            ],
          },
        ]}
      />,
    );
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('Wait time');
    expect(screen.getAllByRole('row')).toHaveLength(3);
    cleanup();
    render(<TrendChart label="x" unit="count" emptyText="Nothing yet" series={[]} />);
    expect(screen.getByText('Nothing yet')).toBeTruthy();
  });
  it('sparkline: text alternative, empty', () => {
    render(<Sparkline label="Duration" values={[3, 5, 4]} unit="seconds" markLast />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('last 4 s');
    cleanup();
    render(<Sparkline label="Duration" values={[]} unit="seconds" />);
    expect(screen.getByText('no data yet')).toBeTruthy();
  });
  it('heatmap: table of days', () => {
    const values = Array.from({ length: 24 }, (_, h) => (h === 9 ? 7 : 0));
    render(
      <Heatmap label="Busiest hours" unit="count" rows={[{ label: 'Mon', values }]} />,
    );
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('9:00');
    expect(screen.getAllByRole('row')).toHaveLength(2);
  });
  it('forecast chart: inside and outside the range', () => {
    render(
      <ForecastChart
        label="Forecast against actual"
        points={[
          { forecastSec: 100, actualSec: 110, loSec: 90, hiSec: 120, note: 'build 1' },
          { forecastSec: 100, actualSec: 200, loSec: 90, hiSec: 120, note: 'build 2' },
        ]}
      />,
    );
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain(
      '1 inside the forecast range',
    );
    expect(screen.getByText(/outside the forecast range/)).toBeTruthy();
    cleanup();
    render(<ForecastChart label="f" points={[]} />);
    expect(screen.getByText('no data yet')).toBeTruthy();
  });
});
