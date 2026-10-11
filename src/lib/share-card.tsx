import 'server-only';
import { ImageResponse } from 'next/og';
import QRCode from 'qrcode';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function renderShareCard({
  description,
  city,
  url,
  resolved,
}: {
  description: string;
  city: string;
  url: string;
  resolved: boolean;
}) {
  const qr = await QRCode.toDataURL(url, { width: 280, margin: 4, errorCorrectionLevel: 'M' });
  const logo =
    'data:image/svg+xml;base64,' +
    (await readFile(join(process.cwd(), 'public/goindica-logo.svg'))).toString('base64');
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        padding: '72px',
        background: '#f9fbf7',
        color: '#1c2b18',
        fontFamily: 'sans-serif',
        borderTop: '20px solid #347d25',
      }}
    >
      <img src={logo} width={400} height={97} alt="GoIndica" />
      <div style={{ display: 'flex', marginTop: 72, fontSize: 28, letterSpacing: 3 }}>
        {resolved ? 'DESCOBERTA DA COMUNIDADE' : 'QUEM CONHECE A CIDADE, AJUDA'}
      </div>
      <div
        style={{
          display: 'flex',
          marginTop: 30,
          fontSize: description.length > 180 ? 42 : 54,
          fontWeight: 700,
          lineHeight: 1.22,
          wordBreak: 'break-word',
        }}
      >
        {description}
      </div>
      <div style={{ display: 'flex', marginTop: 32, fontSize: 30, color: '#52644c' }}>{city}</div>
      <div
        style={{
          display: 'flex',
          marginTop: 'auto',
          alignItems: 'center',
          gap: 32,
          paddingTop: 40,
          borderTop: '2px solid #dbe5d5',
        }}
      >
        <img src={qr} width={260} height={260} alt="QR code do pedido" />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ display: 'flex', fontSize: 36, fontWeight: 700 }}>
            {resolved ? 'Veja onde encontraram' : 'Sabe onde encontrar?'}
          </div>
          <div style={{ display: 'flex', marginTop: 18, fontSize: 25, lineHeight: 1.4 }}>
            Leia o QR code para abrir o pedido e participar.
          </div>
          <div style={{ display: 'flex', marginTop: 24, fontSize: 20, color: '#52644c' }}>
            {new URL(url).host}
          </div>
        </div>
      </div>
    </div>,
    { width: 1080, height: 1350, headers: { 'Cache-Control': 'private, no-store' } },
  );
}
