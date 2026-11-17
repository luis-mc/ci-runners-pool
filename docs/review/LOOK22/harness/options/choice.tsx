// The Recommended / Custom block that options A and C share.
import { ChoiceField, CheckRow, FieldGrid, NumberField, Stack } from '@crsp/ui';
import { cpuWord, gib, MIN_CPUS, MIN_GIB, type Check, recommended } from './common';

export function SizeChoice({
  room, mode, setMode, mem, cpus, setMem, setCpus, disabled,
}: {
  room: Check | undefined;
  mode: 'recommended' | 'custom';
  setMode: (m: 'recommended' | 'custom') => void;
  mem: number; cpus: number;
  setMem: (n: number) => void; setCpus: (n: number) => void;
  disabled?: boolean;
}) {
  const rec = recommended(room);
  return (
    <ChoiceField
      label="Pool size"
      value={mode}
      onChange={(v) => {
        const next = v as 'recommended' | 'custom';
        if (next === 'recommended' && rec) (setMem(rec.mem), setCpus(rec.cpus));
        setMode(next);
      }}
      choices={[
        {
          value: 'recommended',
          label: rec ? `Recommended (${gib(rec.mem)}, ${cpuWord(rec.cpus)})` : 'Recommended',
          description: 'Half of the room for the pool, with CPUs to match. The rest stays for this PC.',
          ...(rec ? {} : { disabledReason: 'Not known until the agent has reported.' }),
        },
        {
          value: 'custom',
          label: 'Custom',
          description: 'Choose the memory and the CPUs yourself.',
          extra: (
            <Stack>
              <FieldGrid>
                <NumberField label="Pool memory (GiB)" unit=" GiB" min={MIN_GIB} max={4096} decimals={1} value={mem} onChange={setMem} />
                <NumberField label="Pool CPUs" min={MIN_CPUS} max={512} value={cpus} onChange={setCpus} />
              </FieldGrid>
            </Stack>
          ),
        },
      ]}
    />
  );
}
export { CheckRow };
