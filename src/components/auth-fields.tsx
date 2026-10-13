import Link from 'next/link';
import { PasswordInput } from './password-input';

export function EmailField() {
  return (
    <div className="field">
      <label htmlFor="email">E-mail</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={254}
        required
      />
    </div>
  );
}

export function PasswordFields({ creating = false }: { creating?: boolean }) {
  return (
    <>
      <div className="field">
        <label htmlFor="password">{creating ? 'Crie uma senha' : 'Senha'}</label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete={creating ? 'new-password' : 'current-password'}
          minLength={creating ? 12 : 1}
          maxLength={128}
          aria-describedby={creating ? 'password-hint' : undefined}
          required
        />
        {creating ? (
          <span className="hint" id="password-hint">
            Pelo menos 12 caracteres. Você pode usar uma frase fácil de lembrar.
          </span>
        ) : null}
      </div>
      {creating ? (
        <div className="field">
          <label htmlFor="passwordConfirmation">Repita a senha</label>
          <PasswordInput
            id="passwordConfirmation"
            name="passwordConfirmation"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
        </div>
      ) : null}
    </>
  );
}

export function AuthTerms() {
  return (
    <p className="hint">
      Ao continuar, você aceita os <Link href="/termos">termos de uso</Link> e a{' '}
      <Link href="/privacidade">política de privacidade</Link>.
    </p>
  );
}
