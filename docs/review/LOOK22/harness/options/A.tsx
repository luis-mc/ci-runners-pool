// OPTION A: a plain settings section. Recommended / Custom, a live check line, one Save. No step row.
import { Button, CheckRow, Facts, FormActions, Message, Stack } from '@crsp/ui';
import { useState } from 'react';
import { useSession } from '@app/auth/session';
import { gib, cpuWord, LiveLine, sizeWords, useLiveCheck, useRoom, useSave, type Machine } from './common';
import { SizeChoice } from './choice';

export function PoolSizeWizard({ m, onChanged }: { m: Machine; onChanged: () => void }) {
  const admin = useSession().can('admin');
  const curMem = m.settings.pool_memory_gib ?? 4;
  const curCpus = m.settings.pool_cpus ?? 2;
  const room = useRoom(m);
  const [mode, setMode] = useState<'recommended' | 'custom'>('custom');
  const [mem, setMem] = useState(curMem);
  const [cpus, setCpus] = useState(curCpus);
  const [yes, setYes] = useState(false);
  const live = useLiveCheck(m, mem, cpus, true);
  const save = useSave(m, onChanged);
  const same = mem === curMem && cpus === curCpus;
  const why = !admin ? 'Only an admin can change this.' : same ? 'Nothing changed yet.' : live.tone === 'busy' ? 'Checking the size.' : !live.saveable ? 'This size does not fit. Change it first.' : live.shrink && !yes ? 'Tick the box to confirm lowering the pool size.' : undefined;
  return (
    <Stack>
      <Facts items={[
        { name: 'Pool size now', value: sizeWords(curMem, curCpus) },
        ...(room?.room_gib !== undefined ? [{ name: 'Room for the pool', value: gib(room.room_gib) }] : []),
        ...(room?.cpu_budget !== undefined ? [{ name: 'CPU budget', value: cpuWord(room.cpu_budget) }] : []),
      ]} />
      <SizeChoice room={room} mode={mode} setMode={setMode} mem={mem} cpus={cpus}
        setMem={(n) => { setMem(n); setMode('custom'); save.clear(); }}
        setCpus={(n) => { setCpus(n); setMode('custom'); save.clear(); }} />
      <LiveLine live={live} onFit={(m2, c2) => { setMem(m2); setCpus(c2); setMode('custom'); save.clear(); }} />
      {live.shrink && !same ? <CheckRow label="Yes, lower the pool size" checked={yes} onChange={setYes} /> : null}
      {save.saved ? <Message tone="done">{save.saved}</Message> : null}
      {save.error ? <Message tone="problem">Could not save. {save.error} Try again.</Message> : null}
      <FormActions>
        <Button kind="primary" busy={save.busy} busyLabel="Saving" disabled={why !== undefined}
          reason={why} onPress={() => void save.run(mem, cpus, live.shrink)}>
          Save
        </Button>
      </FormActions>
    </Stack>
  );
}
