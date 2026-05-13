import {JSX, ReactNode} from 'react';

/**
 * Inline help bubble.
 *
 * Wraps any child element with a hover/focus tooltip. We keep the markup
 * dead simple (a styled <span> for the tip) so the tooltip works on touch
 * devices via :focus-within as well.
 */
export default function Hint({
  tip,
  children,
}: {
  tip: ReactNode;
  children: ReactNode;
}): JSX.Element {
  return (
    <span className="flx-hint" tabIndex={0}>
      {children}
      <span className="flx-hint__tip" role="tooltip">
        {tip}
      </span>
    </span>
  );
}
