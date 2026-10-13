'use client';
import { useActionState, useId, useRef, useEffect } from 'react';
import type { FormAction, ActionState } from '@/lib/types';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { returnPath } from '@/lib/return-path';
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
  const preserveValues = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const error = useRef<HTMLParagraphElement>(null);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (previous, data) => {
      preserveValues.current = false;
      const result = await action(previous, data);
      // React reseta os campos após uma action. Uma falha precisa preservar a edição
      // no próprio formulário, sem armazenar senhas ou outros valores fora dele.
      preserveValues.current = Boolean(result.error);
      if (result.success) onSuccess?.();
      return result;
    },
    {},
  );
  const errorId = useId();
  useEffect(() => {
    if (state.redirectTo) router.push(returnPath(state.redirectTo));
  }, [state.redirectTo, router]);
  useEffect(() => {
    if (!state.error) return;
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
      onReset={(event) => {
        if (preserveValues.current) event.preventDefault();
      }}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
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
          Abrir pedido ↗
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
