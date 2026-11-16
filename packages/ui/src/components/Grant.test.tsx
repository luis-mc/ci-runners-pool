// Component 44, the GitHub grant (github-integration R5.86, R5.87; web-console R5.93).
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GithubGrant, githubPage, stepLabel, type GrantState } from './Grant';

afterEach(cleanup);

const APP = 'https://github.com/settings/apps/crsp/permissions';
const INSTALL = 'https://github.com/settings/installations/10';

const none: GrantState = {
  ready: false,
  next: 'ask',
  missing: ['actions_variables', 'secrets'],
  steps: [
    { id: 'ask', done: false, permissions: ['actions_variables', 'secrets'], url: APP },
    {
      id: 'accept',
      done: false,
      permissions: ['actions_variables', 'secrets'],
      url: INSTALL,
    },
  ],
};
const asked: GrantState = {
  ready: false,
  next: 'accept',
  missing: ['secrets'],
  steps: [
    { id: 'ask', done: true, permissions: [], url: APP },
    { id: 'accept', done: false, permissions: ['secrets'], url: INSTALL },
  ],
};
const all: GrantState = {
  ready: true,
  missing: [],
  steps: [
    { id: 'ask', done: true, permissions: [] },
    { id: 'accept', done: true, permissions: [] },
  ],
};

describe('GithubGrant step states', () => {
  it('none done: both steps missing, the one action opens the App page', () => {
    render(<GithubGrant state={none} onCheck={() => undefined} every={0} />);
    expect(
      screen.getByText('Ask for Variables (write), Secrets (write) on the App page'),
    ).toBeTruthy();
    expect(screen.getAllByText('missing')).toHaveLength(2);
    expect(screen.queryByText('done')).toBeNull();
    const actions = screen.getAllByRole('button');
    expect(actions).toHaveLength(1);
    expect(actions[0]?.getAttribute('href')).toBe(APP);
    expect(actions[0]?.getAttribute('target')).toBe('_blank');
    expect(screen.getByText('Do this after the step above.')).toBeTruthy();
  });

  it('asked, not accepted: the first step is done and the one action opens the installation', () => {
    render(<GithubGrant state={asked} onCheck={() => undefined} every={0} />);
    expect(screen.getByText('done')).toBeTruthy();
    expect(screen.getByText('missing')).toBeTruthy();
    expect(
      screen.getByText('Accept the new permissions on the installation: Secrets (write)'),
    ).toBeTruthy();
    const actions = screen.getAllByRole('button');
    expect(actions).toHaveLength(1);
    expect(actions[0]?.getAttribute('href')).toBe(INSTALL);
    expect(actions[0]?.textContent).toBe('Accept it on GitHub');
  });

  it('all done: says Ready and has no action', () => {
    render(
      <GithubGrant
        state={all}
        onCheck={() => undefined}
        needed={['secrets']}
        every={0}
      />,
    );
    expect(screen.getByText(/Ready\. Secrets \(write\) granted\./)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('opens only pages of GitHub', () => {
    expect(githubPage('javascript:alert(1)')).toBeUndefined();
    expect(githubPage('https://evil.example/x')).toBeUndefined();
    expect(githubPage(APP)).toBe(APP);
    const bad: GrantState = {
      ...none,
      steps: [
        {
          id: 'ask',
          done: false,
          permissions: ['secrets'],
          url: 'https://evil.example/x',
        },
      ],
    };
    render(<GithubGrant state={bad} onCheck={() => undefined} every={0} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('names the exact permission at a step, and the whole set once it is done', () => {
    const words = { secrets: 'Secrets (write)' };
    expect(
      stepLabel({ id: 'ask', done: false, permissions: ['secrets'] }, ['secrets'], words),
    ).toBe('Ask for Secrets (write) on the App page');
    expect(
      stepLabel({ id: 'ask', done: true, permissions: [] }, ['secrets'], words),
    ).toBe('Ask for Secrets (write) on the App page');
  });
});

describe('GithubGrant re-check', () => {
  it('checks again when the tab regains focus and says GitHub is open after the action', () => {
    const check = vi.fn();
    render(<GithubGrant state={asked} onCheck={check} every={0} />);
    expect(check).not.toHaveBeenCalled();
    fireEvent.focus(window);
    expect(check).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText(/GitHub is open in a new tab/)).toBeTruthy();
  });

  it('calls onReady once when the state turns ready, and stops checking', () => {
    const check = vi.fn();
    const ready = vi.fn();
    const { rerender } = render(
      <GithubGrant state={asked} onCheck={check} onReady={ready} every={0} />,
    );
    expect(ready).not.toHaveBeenCalled();
    rerender(<GithubGrant state={all} onCheck={check} onReady={ready} every={0} />);
    expect(ready).toHaveBeenCalledTimes(1);
    rerender(<GithubGrant state={all} onCheck={check} onReady={ready} every={0} />);
    expect(ready).toHaveBeenCalledTimes(1);
    fireEvent.focus(window);
    expect(check).not.toHaveBeenCalled();
  });

  it('checks on a timer while it waits', () => {
    vi.useFakeTimers();
    try {
      const check = vi.fn();
      render(<GithubGrant state={asked} onCheck={check} every={1000} />);
      vi.advanceTimersByTime(2500);
      expect(check).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows a failed check with its reason', () => {
    render(
      <GithubGrant
        state={undefined}
        error="GitHub is not answering."
        onCheck={() => undefined}
        every={0}
      />,
    );
    expect(screen.getByRole('alert').textContent).toMatch(/GitHub is not answering/);
  });
});
