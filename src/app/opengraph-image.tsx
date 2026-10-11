import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const alt = 'GoIndica · Procurando algo na sua cidade? Pergunte para quem conhece.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const logo = await readFile(join(process.cwd(), 'public/goindica-logo.svg'));
  const logoSrc = `data:image/svg+xml;base64,${logo.toString('base64')}`;
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: '#ffffff',
        color: '#1c2b18',
        borderLeft: '16px solid #347d25',
        padding: '40px 70px 60px',
        width: '100%',
        height: '100%',
        fontFamily: 'sans-serif',
      }}
    >
      {/* ImageResponse renders an embedded image rather than a Next.js image component. */}
      <img src={logoSrc} alt="GoIndica" width={400} height={97} />
      <div
        style={{ display: 'flex', fontSize: 68, fontWeight: 600, marginTop: 32, lineHeight: 1.1 }}
      >
        Procurando algo na sua cidade?
      </div>
      <div style={{ display: 'flex', fontSize: 56, color: '#397527', marginTop: 20 }}>
        Pergunte para quem conhece.
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: 25,
          marginTop: 'auto',
          padding: '20px 24px',
          borderRadius: 12,
          background: '#edf7e7',
        }}
      >
        Pessoas indicam. Você encontra. Quem ajudou ganha pontos.
      </div>
    </div>,
    size,
  );
}
