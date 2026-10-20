'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { checkUsername } from '@/server/actions';
import { Icon } from './icon';

type Availability = 'available' | 'taken' | 'invalid' | 'unknown';
const pattern = /^[a-z][a-z0-9_]{2,23}$/;
export function UsernameField({ initial }: { initial: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initial);
  const [result, setResult] = useState<{ name: string; status: Availability } | null>(null);
  const name = value.trim().toLowerCase();
  const local = !name || name === initial ? 'idle' : pattern.test(name) ? null : 'invalid';
  const status = local ?? (result?.name === name ? result.status : 'checking');
  useEffect(() => {
    if (local) return;
    let active = true;
    const timer = setTimeout(async () => {
      const status = await checkUsername(name).catch(() => 'unknown' as const);
      if (active) setResult({ name, status });
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [name, local]);
  useEffect(() => {
    input.current?.setCustomValidity(
      status === 'taken' ? 'Este nome de usuário já está em uso. Escolha outro.' : '',
    );
  }, [status]);
  const message =
    status === 'checking'
      ? 'Verificando disponibilidade…'
      : status === 'available'
        ? 'Disponível.'
        : status === 'taken'
          ? 'Este nome de usuário já está em uso. Escolha outro.'
          : '';
  return (
    <div className="field">
      <label htmlFor="username">Nome de usuário</label>
      <input
        ref={input}
        id="username"
        name="username"
        minLength={3}
        maxLength={24}
        pattern="[a-z][a-z0-9_]{2,23}"
        autoCapitalize="none"
        spellCheck={false}
        autoComplete="username"
        required
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-invalid={status === 'taken' || status === 'invalid' ? true : undefined}
        aria-describedby="username-hint username-status"
      />
      <span className="hint" id="username-hint">
        3 a 24 letras minúsculas, números ou _. Comece com uma letra. É assim que a comunidade vê
        você.
      </span>
      <span
        className={status === 'taken' ? 'hint field-error' : 'hint'}
        id="username-status"
        aria-live="polite"
      >
        {message}
      </span>
    </div>
  );
}
export function ProfilePhotoField({ existingUrl }: { existingUrl?: string }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState('');
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState('');
  const selection = useRef(0);
  const source = preview || (!removed ? existingUrl : '');
  return (
    <div className="field photo-field">
      <label htmlFor={id}>
        Foto de perfil <span className="muted">(opcional)</span>
      </label>
      <input type="hidden" name="removePhoto" value={String(removed)} />
      <div className="photo-picker">
        <Icon name="camera" size={20} />
        <span aria-hidden="true">{source ? 'Trocar foto' : 'Adicionar foto'}</span>
        <input
          className="photo-input"
          ref={input}
          id={id}
          type="file"
          name="photo"
          accept="image/jpeg,image/png,image/webp"
          aria-describedby={id + '-hint'}
          onChange={(event) => {
            const current = ++selection.current;
            const file = event.target.files?.[0];
            setError('');
            setPreview('');
            if (!file) return;
            if (
              file.size > 5 * 1024 * 1024 ||
              !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
            ) {
              setError('Escolha uma foto JPG, PNG ou WebP de até 5 MB.');
              event.target.value = '';
              return;
            }
            const reader = new FileReader();
            reader.onload = () => {
              if (selection.current === current) {
                setPreview(String(reader.result));
                setRemoved(false);
              }
            };
            reader.readAsDataURL(file);
          }}
        />
      </div>
      <p className="hint" id={id + '-hint'}>
        JPG, PNG ou WebP, até 5 MB. A foto é recortada em formato quadrado.
      </p>
      {error ? (
        <p className="notice error" role="alert">
          {error}
        </p>
      ) : null}
      {source ? (
        <div className="photo-preview">
          <img className="avatar" src={source} width={96} height={96} alt="Prévia da foto de perfil" />
          <button
            type="button"
            className="text-link"
            onClick={() => {
              selection.current++;
              setPreview('');
              setRemoved(true);
              if (input.current) input.current.value = '';
            }}
          >
            Remover foto
          </button>
        </div>
      ) : null}
    </div>
  );
}
