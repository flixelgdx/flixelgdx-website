import {createElement, useEffect, useRef, useState, type CSSProperties, type JSX, type ReactNode} from 'react';

type FadeInProps = {
  children: ReactNode;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  as?: keyof JSX.IntrinsicElements;
};

export default function FadeIn({
  children,
  delay = 0,
  className = '',
  style,
  as = 'div',
}: FadeInProps): JSX.Element {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            io.disconnect();
          }
        });
      },
      {threshold: 0.12, rootMargin: '0px 0px -10% 0px'}
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return createElement(
    as,
    {
      ref,
      className: `flx-fade ${visible ? 'is-visible' : ''} ${className}`,
      style: {transitionDelay: `${delay}ms`, ...style},
    },
    children
  );
}
