'use client';
import { useId, useRef, useState } from 'react';

export function RequestPhotoField({ existingUrl }: { existingUrl?: string }) {
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
        Foto do que você procura <span className="muted">(opcional)</span>
      </label>
      <input type="hidden" name="removePhoto" value={String(removed)} />
      <input
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
      <p className="hint" id={id + '-hint'}>
        JPG, PNG ou WebP, até 5 MB. A foto ajuda a identificar o item. Se sair desta tela, selecione
        a foto novamente.
      </p>
      {error ? (
        <p className="notice error" role="alert">
          {error}
        </p>
      ) : null}
      {source ? (
        <div className="photo-preview">
          <img src={source} width={240} height={180} alt="Prévia da foto do pedido" />
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
