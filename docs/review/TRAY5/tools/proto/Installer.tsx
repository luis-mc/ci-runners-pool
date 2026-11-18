// TRAY5 prototype only: the installer window as the same shared wizard (welcome, choices, installing, done, failed).
import { Facts, Message, Stack, Switch, Text, Wizard, type WizardPhase } from '@crsp/ui';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { OPT, Proto } from './Chrome';

const STEPS = OPT === 'B' ? ['Welcome', 'Choices', 'Install', 'Done'] : ['Welcome', 'Choices', 'Installing', 'Done'];
const noop = () => undefined;

export function InstallerPage() {
  const [params] = useSearchParams();
  const state = params.get('state') ?? 'welcome';
  const [tray, setTray] = useState(true);
  const [open, setOpen] = useState(true);
  const phase: WizardPhase =
    state === 'installing' ? 'running' : state === 'done' ? 'done' : state === 'failed' ? 'failed' : 'ready-to-review';
  const current = state === 'welcome' ? 0 : state === 'choices' ? 1 : state === 'done' ? 3 : 2;
  let body;
  if (state === 'welcome')
    body = (
      <Stack>
        <Text>Install CI Runners Shared Pool 0.1.12 on this PC.</Text>
        <Text>It adds the crsp service, the tray icon and a Start menu shortcut. Your data stays.</Text>
      </Stack>
    );
  else if (state === 'choices')
    body = (
      <Stack>
        <Facts items={[{ name: 'Install folder', value: 'C:\\Program Files\\crsp' }]} />
        <Switch label="Start the tray when I sign in" on={tray} onChange={setTray} />
        <Switch label="Open the console when done" on={open} onChange={setOpen} />
      </Stack>
    );
  else if (state === 'installing') body = <Text>Running jobs are not affected. Nothing else to do.</Text>;
  else if (state === 'failed')
    body = (
      <Message tone="problem">
        The install did not finish. The installer stopped with code 1603. Nothing was changed. The log is
        C:\ProgramData\crsp\logs\msi-install.log. Then try again.
      </Message>
    );
  else
    body = (
      <Stack>
        <Message tone="done">Now running 0.1.12.</Message>
        <Facts items={[{ name: 'Version', value: '0.1.12' }, { name: 'Service', value: 'running' }]} />
      </Stack>
    );
  return (
    <Proto title="Setup">
      <main>
        <div className="ds-page" data-frame="compact">
          <Wizard
            name="Setup"
            steps={STEPS}
            current={current}
            firstStep={-1}
            phase={phase}
            progress={phase === 'running' ? { text: 'Installing 60%', value: 60, max: 100 } : undefined}
            onBack={noop}
            backLabel={state === 'welcome' ? 'Cancel' : state === 'done' || state === 'failed' ? 'Close' : 'Back'}
            primary={{ label: state === 'welcome' ? 'Next' : 'Install', busyLabel: 'Installing', onPress: noop }}
            donePrimary={{ label: 'Open the console', onPress: noop }}
            onTryAgain={noop}
          >
            {body}
          </Wizard>
        </div>
      </main>
    </Proto>
  );
}
