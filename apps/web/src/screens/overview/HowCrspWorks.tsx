// The "How crsp works" strip (D33, LOOK31): Pool -> Machines -> Runners, and repositories use the pool.
// It shows on first run only, until the pool has a machine, a runner and a repository, and the user can dismiss it.
import { Button, Message, TextLink } from '@crsp/ui';
import { useState } from 'react';
import { unwrap, useClient } from '../../api/api';
import { useLoad } from '../../api/hooks';
import { useMachines } from '../../api/machines';
import { useVersion } from '../../live/LiveProvider';
import { allRepositories } from '../repositories/plans';

export const STRIP_STORE_NAME = 'crsp.howItWorks.dismissed';

/** The strip is for a pool that is not set up: it needs a machine, a runner and a repository to go away. */
export function showStrip(f: {
  machines: number;
  runners: number;
  repositories: number;
  dismissed: boolean;
}): boolean {
  if (f.dismissed) return false;
  return f.machines === 0 || f.runners === 0 || f.repositories === 0;
}

function wasDismissed(): boolean {
  try {
    return window.localStorage.getItem(STRIP_STORE_NAME) === '1';
  } catch {
    return false;
  }
}

export function HowCrspWorks() {
  const client = useClient();
  const machines = useMachines();
  const rv = useVersion('runners');
  const runners = useLoad(() => unwrap(client.GET('/api/v1/runners')), [rv]);
  const repos = useLoad(() => allRepositories(client, { pool: 'on' }), []);
  const [dismissed, setDismissed] = useState(wasDismissed);
  // Nothing shows while the three counts are still loading: a set-up pool never sees it flash.
  if (
    machines.result.state !== 'ready' ||
    runners.result.state !== 'ready' ||
    repos.result.state !== 'ready'
  )
    return null;
  if (
    !showStrip({
      machines: machines.result.data.items.length,
      runners: runners.result.data.items.length,
      repositories: repos.result.data.items.length,
      dismissed,
    })
  )
    return null;
  return (
    <Message
      tone="note"
      action={
        <Button
          onPress={() => {
            setDismissed(true);
            try {
              window.localStorage.setItem(STRIP_STORE_NAME, '1');
            } catch {
              // The strip stays hidden for this visit only.
            }
          }}
        >
          Hide this
        </Button>
      }
    >
      How crsp works: the Pool has Machines, and each machine has Runners. Repositories
      use the pool. Start in <TextLink to="/pool">Shared Pool</TextLink>.
    </Message>
  );
}
