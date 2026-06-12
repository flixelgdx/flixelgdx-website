import {useRef, useState, type JSX, type ReactNode} from 'react';
import {createPortal} from 'react-dom';

type TooltipPos = {top: number; left: number};

/**
 * Wraps `children` so that hovering or focusing them shows `tip` as a tooltip.
 * The tooltip is rendered in a portal on `document.body` and positioned over
 * the wrapped element so it is never clipped by an overflow-hidden ancestor.
 */
export default function Hint({tip, children}: {tip: ReactNode; children: ReactNode}): JSX.Element {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<TooltipPos | null>(null);

  function show() {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({top: r.top, left: r.left + r.width / 2});
  }

  function hide() {
    setPos(null);
  }

  return (
    <span
      ref={ref}
      className="flx-hint"
      tabIndex={0}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {pos && createPortal(
        <span className="flx-hint__tip" role="tooltip" style={{top: pos.top, left: pos.left}}>
          {tip}
        </span>,
        document.body
      )}
    </span>
  );
}
