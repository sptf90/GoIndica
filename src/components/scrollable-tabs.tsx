'use client';
import { animate } from 'motion/react';
import {
  Children,
  cloneElement,
  isValidElement,
  useLayoutEffect,
  useRef,
  type ReactElement,
  type ReactNode,
} from 'react';

type TabLinkProps = {
  href?: string;
  scroll?: boolean;
};

function keepPageScroll(children: ReactNode) {
  return Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    const props = child.props as TabLinkProps;
    if (props.href == null || props.scroll != null) return child;
    return cloneElement(child as ReactElement<TabLinkProps>, { scroll: false });
  });
}

export function ScrollableTabs({
  active,
  label,
  className = '',
  children,
}: {
  active: string;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const navigation = useRef<HTMLElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);
  useLayoutEffect(() => {
    const nav = navigation.current;
    if (!nav) return;
    function showCurrent() {
      if (!nav) return;
      const current = nav.querySelector<HTMLElement>('[aria-current="page"], a.active');
      if (!current) return;
      const bounds = nav.getBoundingClientRect();
      const item = current.getBoundingClientRect();
      // Desloca apenas a lista de abas; mantém a posição vertical da página.
      if (item.left < bounds.left) nav.scrollLeft -= bounds.left - item.left + 8;
      else if (item.right > bounds.right) nav.scrollLeft += item.right - bounds.right + 8;
      if (pill.current) {
        const target = {
          x: current.offsetLeft,
          width: current.offsetWidth,
          opacity: 1,
        };
        const still = !placed.current || matchMedia('(prefers-reduced-motion: reduce)').matches;
        animate(
          pill.current,
          target,
          still ? { duration: 0 } : { type: 'spring', stiffness: 480, damping: 38 },
        );
        placed.current = true;
      }
    }
    showCurrent();
    const observer = new ResizeObserver(showCurrent);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [active]);
  return (
    <nav ref={navigation} className={`tabs ${className}`} aria-label={label}>
      <span ref={pill} className="tab-pill" aria-hidden="true" />
      {keepPageScroll(children)}
    </nav>
  );
}
