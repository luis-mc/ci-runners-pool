// OPTION B: sliders with the room shown as a bar (used outside / pool / free), live check, "Use recommended", Save.
// The slider, the +/- stepper and the stacked bar are NOT in the shared UI package: they would be new parts.
import { Button, CheckRow, Cluster, Facts, FormActions, Message, Stack, Text } from '@crsp/ui';
import { useState } from 'react';
import { useSession } from '@app/auth/session';
import { cpuWord, gib, LiveLine, recommended, sizeWords, useLiveCheck, useRoom, useSave, type Machine } from './common';

function Slider({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (n: number) => void;
}) {
  const bump = (d: number) => onChange(Math.min(max, Math.max(min, Number((value + d).toFixed(1)))));
  return (
    <div className="ds-field" data-width="full">
      <label className="ds-field__label" htmlFor={label}>{label}</label>
      <div style={{ display: 'flex', gap: 'var(--space-3, 12px)', alignItems: 'center' }}>
        <Button onPress={() => bump(-step)} disabled={value <= min}>−</Button>
        <input id={label} type="range" min={min} max={max} step={step} value={value}
          style={{ flex: 1, accentColor: 'var(--primary, #4ade80)' }}
          onChange={(e) => onChange(Number(e.target.value))} />
        <Button onPress={() => bump(step)} disabled={value >= max}>+</Button>
        <strong style={{ minInlineSize: '6ch', textAlign: 'end' }}>{value}{unit}</strong>
      </div>
    </div>
  );
}

function RoomBar({ total, outside, pool, room }: { total: number; outside: number; pool: number; room: number }) {
  const pct = (n: number) => `${Math.max(0, Math.min(100, (n / total) * 100))}%`;
  const over = outside + pool > outside + room;
  const free = Math.max(0, total - outside - pool);
  const seg = (w: number, bg: string, name: string) => (
    <span title={name} style={{ inlineSize: pct(w), background: bg, display: 'block' }} />
  );
  return (
    <div>
      <div role="img" aria-label={`Used outside ${gib(outside)}, pool ${gib(pool)}, free ${gib(free)}`}
        style={{ display: 'flex', blockSize: 22, border: '1px solid var(--border, #555)', position: 'relative', overflow: 'hidden' }}>
        {seg(outside, 'var(--muted, #6b7280)', 'Used outside the pool')}
        {seg(pool, over ? 'var(--problem, #f87171)' : 'var(--primary, #4ade80)', 'Pool')}
        {seg(free, 'transparent', 'Free')}
        <span title="End of the room for the pool" style={{ position: 'absolute', insetBlock: 0, insetInlineStart: pct(outside + room), borderInlineStart: '2px dashed var(--text, #eee)' }} />
      </div>
      <Cluster>
        <Text tone="muted">{`Used outside ${gib(outside)}`}</Text>
        <Text tone="muted">{`Pool ${gib(pool)}`}</Text>
        <Text tone="muted">{`Free ${gib(free)}`}</Text>
        <Text tone="muted">{`Dashed: end of the room (${gib(room)} for the pool)`}</Text>
      </Cluster>
    </div>
  );
}

export function PoolSizeWizard({ m, onChanged }: { m: Machine; onChanged: () => void }) {
  const admin = useSession().can('admin');
  const curMem = m.settings.pool_memory_gib ?? 4;
  const curCpus = m.settings.pool_cpus ?? 2;
  const room = useRoom(m);
  const rec = recommended(room);
  const [mem, setMem] = useState(curMem);
  const [cpus, setCpus] = useState(curCpus);
  const [yes, setYes] = useState(false);
  const live = useLiveCheck(m, mem, cpus, true);
  const save = useSave(m, onChanged);
  const same = mem === curMem && cpus === curCpus;
  const why = !admin ? 'Only an admin can change this.' : same ? 'Nothing changed yet.' : live.tone === 'busy' ? 'Checking the size.' : !live.saveable ? 'This size does not fit. Change it first.' : live.shrink && !yes ? 'Tick the box to confirm lowering the pool size.' : undefined;
  const total = room?.total_gib ?? 31.7;
  return (
    <Stack>
      <Facts items={[{ name: 'Pool size now', value: sizeWords(curMem, curCpus) }]} />
      {room ? <RoomBar total={total} outside={room.used_outside_gib ?? 0} pool={mem} room={room.room_gib ?? 0} /> : null}
      <Slider label="Pool memory" value={mem} min={4} max={Math.floor(total)} step={0.5} unit=" GiB" onChange={(n) => { setMem(n); save.clear(); }} />
      <Slider label="Pool CPUs" value={cpus} min={2} max={room?.cpu_budget ? room.cpu_budget + 4 : 24} step={1} unit="" onChange={(n) => { setCpus(n); save.clear(); }} />
      {rec ? (
        <Cluster>
          <Button onPress={() => { setMem(rec.mem); setCpus(rec.cpus); save.clear(); }} disabled={mem === rec.mem && cpus === rec.cpus}>
            {`Use recommended (${gib(rec.mem)}, ${cpuWord(rec.cpus)})`}
          </Button>
        </Cluster>
      ) : null}
      <LiveLine live={live} onFit={(m2, c2) => { setMem(m2); setCpus(c2); save.clear(); }} />
      {live.shrink && !same ? <CheckRow label="Yes, lower the pool size" checked={yes} onChange={setYes} /> : null}
      {save.saved ? <Message tone="done">{save.saved}</Message> : null}
      {save.error ? <Message tone="problem">Could not save. {save.error} Try again.</Message> : null}
      <FormActions>
        <Button kind="primary" busy={save.busy} busyLabel="Saving" disabled={why !== undefined} reason={why}
          onPress={() => void save.run(mem, cpus, live.shrink)}>Save</Button>
      </FormActions>
    </Stack>
  );
}
