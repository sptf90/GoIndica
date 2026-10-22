import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MainContent } from '@/components/main-content';
import ErrorPage from '@/app/error';
import NotFound from '@/app/not-found';

describe('landmarks dos fallbacks de rota', () => {
  for (const fallback of [createElement(ErrorPage, { reset() {} }), createElement(NotFound)]) {
    it(`mantém um destino de skip link e um main: ${fallback.type.name}`, () => {
      for (const tree of [fallback, createElement(MainContent, { className: 'app-main' }, fallback)]) {
        const html = renderToStaticMarkup(tree);
        expect(html.match(/<main\b/g)).toHaveLength(1);
        expect(html.match(/id="conteudo"/g)).toHaveLength(1);
        expect(html).toContain('tabindex="-1"');
        expect(html).toContain('error-page');
      }
    });
  }
});
