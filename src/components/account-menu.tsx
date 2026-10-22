'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export function AccountMenu({ trigger, children }: { trigger: ReactNode; children: ReactNode }) {
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const hoverClose = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const open = expanded || hovered;

  useEffect(() => () => {
    if (hoverClose.current) clearTimeout(hoverClose.current);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = () => {
      setExpanded(false);
      setHovered(false);
    };
    const dismiss = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      close();
      button.current?.focus();
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div
      ref={container}
      className="account-menu"
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') {
          if (hoverClose.current) clearTimeout(hoverClose.current);
          setHovered(true);
        }
      }}
      onPointerLeave={() => {
        // Allow a diagonal pointer path across the gap to the wider popup.
        hoverClose.current = setTimeout(() => setHovered(false), 300);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setExpanded(false);
          setHovered(false);
        }
      }}
    >
      <button
        ref={button}
        type="button"
        className="profile-link"
        aria-label="Opções da conta"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setExpanded(!expanded);
          setHovered(false);
        }}
      >
        {trigger}
      </button>
      <div
        id={id}
        className="account-popover"
        hidden={!open}
        onFocusCapture={() => setExpanded(true)}
        onClickCapture={(event) => {
          if ((event.target as HTMLElement).closest('a')) {
            setExpanded(false);
            setHovered(false);
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
