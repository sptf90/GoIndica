import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'GoIndica · Pergunte à sua cidade',
    short_name: 'GoIndica',
    lang: 'pt-BR',
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    background_color: '#fdfdf1',
    theme_color: '#ec5e27',
    icons: [
      { src: '/icons/app-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/app-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  };
}
