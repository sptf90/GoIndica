'use client';
import { useState, type ComponentProps } from 'react';
import { Icon } from './icon';
export function PasswordInput(props: Omit<ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-input">
      <input {...props} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="password-toggle"
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visible}
        onClick={() => setVisible(!visible)}
      >
        <Icon name={visible ? 'eyeClosed' : 'eye'} size={20} />
      </button>
    </div>
  );
}
