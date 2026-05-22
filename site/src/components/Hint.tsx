import {type JSX, type ReactNode} from 'react';

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
