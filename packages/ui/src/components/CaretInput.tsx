// The text box with the block caret of the Phosphor look (components 11, 14, 38; token --ds-cursor-blink). It draws
// a terminal block at the real insertion point and hides the native caret only while the block is shown. The block
// is a sibling of the input, hidden from screen readers, and drawn only while the box has focus and nothing is
// selected. Right-to-left text, a password and an IME composition fall back to the native caret.
import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type InputHTMLAttributes,
} from 'react';

export interface BlockCaret {
  /** Offsets inside the input's offset parent, in px. */
  left: number;
  top: number;
  width: number;
  height: number;
  /** The character the block sits on; drawn inverted on top of the block so it stays readable. */
  char: string;
  font: CSSProperties;
}

const RTL =
  /[\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}]/u;

function textWidth(host: HTMLElement, font: CSSProperties, text: string): number {
  const probe = document.createElement('span');
  Object.assign(probe.style, font, {
    position: 'absolute',
    visibility: 'hidden',
    whiteSpace: 'pre',
    insetBlockStart: '0',
    insetInlineStart: '0',
  });
  probe.textContent = text;
  host.appendChild(probe);
  const w = probe.getBoundingClientRect().width;
  probe.remove();
  return w;
}

/** Where the block goes for this input now, or null when the native caret must stay (or nothing shows). */
export function measureCaret(input: HTMLInputElement): BlockCaret | null {
  if (input.disabled || input.readOnly || input.type === 'password') return null;
  const start = input.selectionStart;
  const end = input.selectionEnd;
  if (start === null || end === null || start !== end) return null;
  const cs = getComputedStyle(input);
  if (cs.direction === 'rtl' || RTL.test(input.value)) return null;
  const font: CSSProperties = {
    fontStyle: cs.fontStyle,
    fontWeight: cs.fontWeight,
    fontSize: cs.fontSize,
    fontFamily: cs.fontFamily,
    letterSpacing: cs.letterSpacing,
    textTransform: cs.textTransform,
  };
  const host = input.parentElement ?? document.body;
  const before = textWidth(host, font, input.value.slice(0, start));
  const char = input.value.charAt(start);
  const charW = char.trim() ? textWidth(host, font, char) : 0;
  const padL = parseFloat(cs.paddingLeft) || 0;
  const padR = parseFloat(cs.paddingRight) || 0;
  const x = before - input.scrollLeft;
  // The box's own borders, not clientLeft: some browsers count more than the border in it.
  const borderL = parseFloat(cs.borderLeftWidth) || 0;
  const borderR = parseFloat(cs.borderRightWidth) || 0;
  const room = input.offsetWidth - borderL - borderR - padL - padR;
  if (x < -0.5 || x > room + 0.5) return null;
  const size = parseFloat(cs.fontSize) || 16;
  const height = Math.round(size * 1.1);
  return {
    left: input.offsetLeft + borderL + padL + x,
    top: input.offsetTop + (input.offsetHeight - height) / 2,
    width: charW || size * 0.6,
    height,
    char,
    font,
  };
}

export const CaretInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function CaretInput(props, forwarded) {
  const { onFocus, onBlur, onKeyUp, onSelect, onMouseUp, onScroll, onInput } = props;
  const ref = useRef<HTMLInputElement | null>(null);
  const focused = useRef(false);
  const composing = useRef(false);
  const [caret, setCaret] = useState<BlockCaret | null>(null);

  const update = useCallback(() => {
    const el = ref.current;
    const next = el && focused.current && !composing.current ? measureCaret(el) : null;
    // Same place, same character: keep the element, so the blink is not restarted by a redraw.
    setCaret((prev) =>
      prev && next && JSON.stringify(prev) === JSON.stringify(next) ? prev : next,
    );
  }, []);

  const setRef = (el: HTMLInputElement | null) => {
    ref.current = el;
    const f = forwarded;
    if (typeof f === 'function') f(el);
    else if (f) (f as { current: HTMLInputElement | null }).current = el;
  };

  // The value changed from outside (a clear button, a reset) or the box was drawn again.
  useLayoutEffect(() => {
    if (focused.current) update();
  });

  // Arrow keys, Home and End, clicks and selection by mouse all end in a selection change.
  useEffect(() => {
    const onSel = () => {
      if (focused.current && document.activeElement === ref.current) update();
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, [update]);

  return (
    <>
      <input
        {...props}
        ref={setRef}
        data-caret={caret ? 'block' : undefined}
        onFocus={(e) => {
          focused.current = true;
          update();
          onFocus?.(e);
        }}
        onBlur={(e) => {
          focused.current = false;
          composing.current = false;
          setCaret(null);
          onBlur?.(e);
        }}
        onKeyUp={(e) => {
          update();
          onKeyUp?.(e);
        }}
        onSelect={(e) => {
          update();
          onSelect?.(e);
        }}
        onMouseUp={(e) => {
          update();
          onMouseUp?.(e);
        }}
        onScroll={(e) => {
          update();
          onScroll?.(e);
        }}
        onInput={(e) => {
          update();
          onInput?.(e);
        }}
        onCompositionStart={(e) => {
          composing.current = true;
          setCaret(null);
          props.onCompositionStart?.(e);
        }}
        onCompositionEnd={(e) => {
          composing.current = false;
          update();
          props.onCompositionEnd?.(e);
        }}
      />
      {caret ? (
        <span
          // A new key on every move restarts the blink: the block is solid while the caret moves.
          key={`${caret.left}-${caret.char}`}
          className="ds-caret"
          data-caret-block
          aria-hidden="true"
          style={{
            ...caret.font,
            insetInlineStart: caret.left,
            insetBlockStart: caret.top,
            inlineSize: caret.width,
            blockSize: caret.height,
          }}
        >
          {caret.char}
        </span>
      ) : null}
    </>
  );
});
