'use client';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Icon, type IconName } from './icon';
import { destinations, secondary } from './navigation';

const noop = () => () => {};
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

type Shortcut = { href: string; label: string; icon: IconName; keywords: string[] };

function Item({
  icon,
  label,
  hint,
  onSelect,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  onSelect: () => void;
}) {
  return (
    <Command.Item value={label} onSelect={onSelect}>
      <span className="command-icon">
        <Icon name={icon} size={18} />
      </span>
      <span className="command-label">{label}</span>
      {hint ? <span className="command-hint">{hint}</span> : null}
    </Command.Item>
  );
}

export function CommandPalette({ admin }: { admin: boolean }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const mac = useSyncExternalStore(
    noop,
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => false,
  );

  useEffect(() => {
    const toggle = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    document.addEventListener('keydown', toggle);
    return () => document.removeEventListener('keydown', toggle);
  }, []);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
      element.querySelector('input')?.focus();
    }
    if (!open && element.open) element.close();
  }, [open]);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const dismiss = (event: MouseEvent) => {
      if (event.target === element) element.close();
    };
    element.addEventListener('click', dismiss);
    return () => element.removeEventListener('click', dismiss);
  }, []);

  const close = () => {
    setOpen(false);
    setQuery('');
  };
  const go = (href: string) => {
    close();
    router.push(href);
  };
  const term = query.trim();
  const shortcuts: Shortcut[] = [
    {
      href: '/pedidos/novo',
      label: 'Novo pedido',
      icon: 'plus',
      keywords: ['criar', 'perguntar', 'pedido', 'indicacao'],
    },
    ...[...destinations, ...secondary].map((item) => ({
      ...item,
      keywords: [item.href.slice(1)],
    })),
    ...(admin
      ? [{ href: '/admin', label: 'Administração', icon: 'shield' as const, keywords: ['admin'] }]
      : []),
  ];
  const needle = normalize(term);
  const matches = shortcuts.filter((item) =>
    [item.label, ...item.keywords].some((text) => normalize(text).includes(needle)),
  );

  return (
    <>
      <button
        type="button"
        className="command-trigger"
        aria-label="Buscar e navegar"
        aria-keyshortcuts="Control+K Meta+K"
        onClick={() => setOpen(true)}
      >
        <Icon name="search" size={18} />
        <span>Buscar ou ir para…</span>
        <kbd>{mac ? '⌘ K' : 'Ctrl K'}</kbd>
      </button>
      <dialog ref={dialog} className="command-dialog" aria-label="Buscar e navegar" onClose={close}>
        {open ? (
          <Command label="Buscar e navegar" loop shouldFilter={false}>
            <div className="command-search">
              <Icon name="search" size={20} />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="O que você procura na cidade?"
              />
              <kbd>Esc</kbd>
            </div>
            <Command.List>
              {term ? (
                <Command.Group heading="Na sua cidade">
                  <Item
                    icon="search"
                    label={`Buscar “${term}” nos pedidos`}
                    onSelect={() => go(`/app?q=${encodeURIComponent(term)}`)}
                  />
                  <Item
                    icon="message"
                    label={`Perguntar à cidade: “${term}”`}
                    onSelect={() => go(`/pedidos/novo?q=${encodeURIComponent(term)}`)}
                  />
                </Command.Group>
              ) : null}
              {matches.length ? (
                <Command.Group heading="Ir para">
                  {matches.map((item) => (
                    <Item
                      key={item.href}
                      icon={item.icon}
                      label={item.label}
                      hint={item.href === '/pedidos/novo' ? 'Perguntar' : undefined}
                      onSelect={() => go(item.href)}
                    />
                  ))}
                </Command.Group>
              ) : null}
            </Command.List>
            <footer className="command-footer">
              <span>
                <kbd>↑</kbd>
                <kbd>↓</kbd> navegar
              </span>
              <span>
                <kbd>Enter</kbd> abrir
              </span>
            </footer>
          </Command>
        ) : null}
      </dialog>
    </>
  );
}
