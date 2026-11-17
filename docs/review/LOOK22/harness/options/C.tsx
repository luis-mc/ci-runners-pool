// OPTION C: option A, behind a read-only summary and an Edit button that turns the section editable in place.
import { Button, CheckRow, Facts, FormActions, Message, Stack } from '@crsp/ui';
import { useState } from 'react';
import { useSession } from '@app/auth/session';
import { cpuWord, gib, LiveLine, sizeWords, useLiveCheck, useRoom, useSave, type Machine } from './common';
import { SizeChoice } from './choice';

export function PoolSizeWizard({ m, onChanged }: { m: Machine; onChanged: () => void }) {
  const admin = useSession().can('admin');
  const curMem = m.settings.pool_memory_gib ?? 4;
  const curCpus = m.settings.pool_cpus ?? 2;
  const room = useRoom(m);
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<'recommended' | 'custom'>('custom');
  const [mem, setMem] = useState(curMem);
  const [cpus, setCpus] = useState(curCpus);
  const [yes, setYes] = useState(false);
  const live = useLiveCheck(m, mem, cpus, editing);
  const save = useSave(m, onChanged);
  const same = mem === curMem && cpus === curCpus;
  const why = same ? 'Nothing changed yet.' : live.tone === 'busy' ? 'Checking the size.' : !live.saveable ? 'This size does not fit. Change it first.' : live.shrink && !yes ? 'Tick the box to confirm lowering the pool size.' : undefined;
  const open = () => { setMem(curMem); setCpus(curCpus); setMode('custom'); setYes(false); save.clear(); setEditing(true); };
  const summary = (
    <Facts items={[
      { name: 'Pool size now', value: sizeWords(curMem, curCpus) },
      ...(room?.room_gib !== undefined ? [{ name: 'Room for the pool', value: gib(room.room_gib) }] : []),
      ...(room?.cpu_budget !== undefined ? [{ name: 'CPU budget', value: cpuWord(room.cpu_budget) }] : []),
    ]} />
  );
  if (!editing)
    return (
      <Stack>
        {summary}
        {save.saved ? <Message tone="done">{save.saved}</Message> : null}
        <FormActions>
          <Button onPress={open} disabled={!admin} reason={admin ? undefined : 'Only an admin can change this.'}>Edit</Button>
        </FormActions>
      </Stack>
    );
  return (
    <Stack>
      {summary}
      <SizeChoice room={room} mode={mode} setMode={setMode} mem={mem} cpus={cpus}
        setMem={(n) => { setMem(n); setMode('custom'); }} setCpus={(n) => { setCpus(n); setMode('custom'); }} />
      <LiveLine live={live} />
      {live.shrink && !same ? <CheckRow label="Yes, lower the pool size" checked={yes} onChange={setYes} /> : null}
      {save.error ? <Message tone="problem">Could not save. {save.error} Try again.</Message> : null}
      <FormActions>
        <Button onPress={() => { setEditing(false); save.clear(); }} disabled={save.busy}>Cancel</Button>
        <Button kind="primary" busy={save.busy} busyLabel="Saving" disabled={why !== undefined} reason={why}
          onPress={() => void save.run(mem, cpus, live.shrink).then((ok) => ok && setEditing(false))}>Save</Button>
      </FormActions>
    </Stack>
  );
}
