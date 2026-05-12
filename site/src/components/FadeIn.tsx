import {useEffect, useRef, useState, type CSSProperties, type ReactNode} from 'react';

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  as?: keyof JSX.IntrinsicElements;
}

/**
 * Lightweight scroll-triggered fade-in.
 *
 * Adds the .is-visible class to its root once it enters the viewport so the
 * shared .flx-fade transition (defined in custom.css) animates it in. We use
 * IntersectionObserver so the effect runs at native frame-rate without doing
 * scroll math in JS land.
 */
export default function FadeIn({
  children,
  delay = 0,
  className = '',
  style,
  as = 'div',
}: FadeInProps): JSX.Element {
  const ref = useRef<HTMLElement | null>(null);
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

  const Tag = as as any;
  return (
    <Tag
      ref={ref as any}
      className={`flx-fade ${visible ? 'is-visible' : ''} ${className}`}
      style={{transitionDelay: `${delay}ms`, ...style}}
    >
      {children}
    </Tag>
  );
}
