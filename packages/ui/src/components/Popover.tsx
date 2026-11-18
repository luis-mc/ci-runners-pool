// The shared dismiss behaviour of every menu and popover (LOOK30): a press or touch outside it closes it, and
// Escape closes it with focus back on its button. A popover part calls this and puts the refs on its parts.
import { useEffect, useRef, type RefObject } from 'react';

export function usePopoverDismiss<
  B extends HTMLElement = HTMLButtonElement,
  P extends HTMLElement = HTMLDivElement,
>(
  open: boolean,
  close: () => void,
): { buttonRef: RefObject<B | null>; panelRef: RefObject<P | null> } {
  const buttonRef = useRef<B | null>(null);
  const panelRef = useRef<P | null>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return undefined;
    const outside = (e: Event) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (panelRef.current?.contains(t) || buttonRef.current?.contains(t)) return;
      closeRef.current();
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      closeRef.current();
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('mousedown', outside, true);
    document.addEventListener('touchstart', outside, true);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('mousedown', outside, true);
      document.removeEventListener('touchstart', outside, true);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return { buttonRef, panelRef };
}
