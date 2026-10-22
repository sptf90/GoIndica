// TSX resolves Next's extensionless package imports when rendering components outside Next.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Avatar, Status, statusLabels } from '../../src/components/ui';
import ErrorPage from '../../src/app/error';
import type { RequestStatus } from '../../src/lib/types';

const statuses = Object.keys(statusLabels).map((status) =>
  renderToStaticMarkup(createElement(Status, { status: status as RequestStatus })),
).join('');
const avatars = [
  { size: 40, mobileSize: 36 },
  { size: 72, mobileSize: 64 },
  { size: 80, mobileSize: 64 },
  { size: 32 },
].map((props) => ['photo', 'initials'].map((kind) => renderToStaticMarkup(createElement(Avatar, {
  ...props,
  name: 'Pessoa da comunidade',
  src: kind === 'photo' ? '/icon.svg' : undefined,
}))).join('')).join('');
process.stdout.write(JSON.stringify({
  statuses,
  avatars,
  error: renderToStaticMarkup(createElement(ErrorPage, { reset() {} })),
}));
