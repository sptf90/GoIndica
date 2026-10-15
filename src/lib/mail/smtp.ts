import 'server-only';
import { readFileSync } from 'node:fs';
import nodemailer, { type SendMailOptions } from 'nodemailer';
import { requiredEnv } from '@/lib/env';
let transport: ReturnType<typeof nodemailer.createTransport> | undefined;
export async function sendMail(
  to: string,
  subject: string,
  text: string,
  messageId?: string,
  content?: Pick<SendMailOptions, 'html' | 'attachments'>,
) {
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  transport ??= nodemailer.createTransport({
    host: requiredEnv('SMTP_HOST'),
    port,
    secure,
    requireTLS: !secure,
    auth: { user: requiredEnv('SMTP_USER'), pass: requiredEnv('SMTP_PASSWORD') },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 15000,
    tls: {
      rejectUnauthorized: true,
      ...(process.env.SMTP_CA_FILE ? { ca: readFileSync(process.env.SMTP_CA_FILE) } : {}),
    },
  });
  const sent = await transport.sendMail({
    from: requiredEnv('EMAIL_FROM'),
    to,
    subject,
    text,
    ...content,
    ...(messageId ? { messageId } : {}),
  });
  if (!sent.accepted?.length) throw new Error('EMAIL_DELIVERY_FAILED');
}
