'use client';
import { useActionState, useId, useRef, useEffect } from 'react';
import type { FormAction, ActionState } from '@/lib/types';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { returnPath } from '@/lib/return-path';
import { Icon } from './icon';

function restoreFields(form: HTMLFormElement, data: FormData) {
  for (const [key, value] of data.entries()) {
    if (typeof value !== 'string') continue;
    const control = form.elements.namedItem(key);
    if (control instanceof RadioNodeList) {
      for (const option of control) {
        if (option instanceof HTMLInputElement && option.value === value) option.checked = true;
      }
    } else if (
      control instanceof HTMLInputElement ||
      control instanceof HTMLTextAreaElement ||
      control instanceof HTMLSelectElement
    ) {
      if (control instanceof HTMLInputElement && control.type === 'checkbox')
        control.checked = value === 'on' || value === 'true' || value === control.value;
      else control.value = value;
    }
  }
}

export function ActionForm({
  action,
  children,
  label,
  pendingLabel = 'Salvando…',
  className = '',
  confirm,
  disabled = false,
  onSuccess,
}: {
  action: FormAction;
  children?: React.ReactNode;
  label: string;
  pendingLabel?: string;
  className?: string;
  confirm?: string;
  disabled?: boolean;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const submitted = useRef<FormData | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const error = useRef<HTMLParagraphElement>(null);
  // Pass the server action directly so Next can expose a real form endpoint.
  // Client wrappers leave action="javascript:throw…" and break Entrar on mobile
  // when /_next hydration is delayed or blocked on a LAN IP.
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});
  const errorId = useId();
  useEffect(() => {
    if (state.redirectTo) router.push(returnPath(state.redirectTo));
  }, [state.redirectTo, router]);
  useEffect(() => {
    if (state.success) onSuccess?.();
  }, [state.success, onSuccess]);
  useEffect(() => {
    if (!state.error) return;
    if (submitted.current && form.current) restoreFields(form.current, submitted.current);
    const field = Object.keys(state.fields || {})[0];
    const control = field ? form.current?.elements.namedItem(field) : null;
    if (control instanceof HTMLInputElement && control.type === 'hidden') {
      const visible = control
        .closest('.city-selector')
        ?.querySelector<HTMLInputElement>('[role="combobox"]');
      (visible || error.current)?.focus();
    } else if (control instanceof HTMLElement) control.focus();
    else error.current?.focus();
  }, [state]);
  return (
    <form
      ref={form}
      action={formAction}
      className={`action-form ${className}`}
      aria-describedby={state.error ? errorId : undefined}
      aria-busy={pending}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) {
          e.preventDefault();
          return;
        }
        submitted.current = new FormData(e.currentTarget);
      }}
    >
      {children}
      {state.error ? (
        <p ref={error} className="notice error" role="alert" id={errorId} tabIndex={-1}>
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="notice success" role="status">
          {state.success}
        </p>
      ) : null}
      {state.redirectTo ? (
        <Link href={returnPath(state.redirectTo)} className="text-link">
          Abrir pedido <Icon name="external" size={16} />
        </Link>
      ) : null}
      <button
        type="submit"
        disabled={pending || disabled}
        aria-disabled={pending || disabled}
        className="button"
        aria-describedby={state.error ? errorId : undefined}
      >
        {pending ? <span className="button-spinner" aria-hidden="true" /> : null}
        {pending ? pendingLabel : label}
      </button>
    </form>
  );
}
