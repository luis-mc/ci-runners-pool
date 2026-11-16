// Component 41: the key-hint bar (UX-57). It sits fixed at the window foot and is not drawn on a touch or coarse
// pointer. It shows only the keys that work on the page: a page registers its keys with `useKeyHints`, and a part
// that adds a key (the table adds j, k and Enter) registers it too, so `j / k` shows only where a list exists.
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export interface KeyHint {
  keys: string;
  does: string;
}

interface Registry {
  set: (owner: symbol, items: readonly KeyHint[]) => void;
  clear: (owner: symbol) => void;
  all: readonly KeyHint[];
}

const Ctx = createContext<Registry | null>(null);

/** Holds the keys the mounted parts registered. `Frame` provides one; a test may wrap its own. */
export function KeyHintsProvider({ children }: { children: ReactNode }) {
  const [owners, setOwners] = useState<ReadonlyMap<symbol, readonly KeyHint[]>>(
    new Map(),
  );
  const registry = useMemo<Registry>(() => {
    const merged: KeyHint[] = [];
    const seen = new Set<string>();
    for (const items of owners.values())
      for (const h of items)
        if (!seen.has(h.keys)) {
          seen.add(h.keys);
          merged.push(h);
        }
    return {
      all: merged,
      set: (owner, items) =>
        setOwners((m) => {
          const prev = m.get(owner);
          if (
            prev &&
            prev.length === items.length &&
            prev.every((h, i) => h.keys === items[i]?.keys && h.does === items[i]?.does)
          )
            return m;
          return new Map(m).set(owner, items);
        }),
      clear: (owner) =>
        setOwners((m) => {
          if (!m.has(owner)) return m;
          const next = new Map(m);
          next.delete(owner);
          return next;
        }),
    };
  }, [owners]);
  return <Ctx.Provider value={registry}>{children}</Ctx.Provider>;
}

/** Registers the keys a page or part handles while it is mounted. An empty list registers nothing. */
export function useKeyHints(items: readonly KeyHint[]): void {
  const registry = useContext(Ctx);
  const owner = useRef(Symbol('key-hints'));
  const signature = JSON.stringify(items);
  useEffect(() => {
    if (!registry) return;
    const id = owner.current;
    registry.set(id, JSON.parse(signature) as KeyHint[]);
    return () => registry.clear(id);
    // The registry object changes with every registration; only the keys decide.
  }, [signature, registry === null]);
}

/** The bar: the registered keys, plus any `items` the caller passes. Draws nothing when no key works. */
export function KeyHints({ items = [] }: { items?: readonly KeyHint[] | undefined }) {
  const registry = useContext(Ctx);
  const merged: KeyHint[] = [];
  const seen = new Set<string>();
  for (const h of [...items, ...(registry?.all ?? [])])
    if (!seen.has(h.keys)) {
      seen.add(h.keys);
      merged.push(h);
    }
  if (merged.length === 0) return null;
  return (
    <footer className="ds-keyhints" aria-label="Keys">
      <ul className="ds-keyhints__list">
        {merged.map((h) => (
          <li key={h.keys}>
            <kbd className="ds-kbd">{h.keys}</kbd> {h.does}
          </li>
        ))}
      </ul>
    </footer>
  );
}
