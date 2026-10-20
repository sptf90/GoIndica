import 'server-only';
import { randomUUID } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { pool, rows, transaction, databaseError, type SqlRow } from '@/lib/database/pool';
import { rate } from '@/lib/database/rate';
import { hashPassword, verifyPassword, hashToken, newToken } from './crypto';
import { appUrl, secureCookies } from '@/lib/env';
import { sendMail } from '@/lib/mail/smtp';
import { confirmationEmail } from '@/lib/mail/confirmation';
import { returnPath } from '@/lib/return-path';
import { saveNewCompany, type NewCompany } from '@/lib/company';
const SESSION_COOKIE = 'goindica_session';
interface LocalUser {
  id: string;
  email: string;
  deleted_at?: string | null;
  created_at?: string;
  last_sign_in_at?: string;
  user_metadata: Record<string, string>;
  app_metadata: { providers: string[] };
  sessionPurpose: 'access' | 'recovery';
}
interface UserRow extends SqlRow {
  id: string;
  email: string;
  password_hash: string | null;
  email_confirmed_at: string | null;
  deleted_at: string | null;
}
const failure = (code: string) => ({
  message: code,
  code,
  ...(code === 'over_request_rate_limit' ? { status: 429 } : {}),
});
export class LocalAuth {
  private current: Promise<LocalUser | null> | undefined;
  private async limited(email: string, bucket: string, max: number) {
    const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    // Both limits persist across requests; never store IPs or email addresses in the limiter.
    try {
      await transaction(async (db) => {
        await rate(db, hashToken(ip), bucket, max * 3, 900);
        await rate(db, hashToken(email), bucket, max, 900);
      });
    } catch {
      throw failure('over_request_rate_limit');
    }
  }
  private async setSession(userId: string, purpose: 'access' | 'recovery' = 'access') {
    const token = newToken();
    const seconds = purpose === 'recovery' ? 900 : 60 * 60 * 24 * 14;
    await pool().execute(
      'INSERT INTO sessions(token_hash,user_id,purpose,expires_at) VALUES(?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL ? SECOND))',
      [hashToken(token), userId, purpose, seconds],
    );
    (await cookies()).set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: secureCookies(),
      sameSite: 'lax',
      path: '/',
      maxAge: seconds,
    });
    if (purpose === 'access')
      await pool().execute('UPDATE users SET last_sign_in_at=UTC_TIMESTAMP(3) WHERE id=?', [
        userId,
      ]);
    this.current = undefined;
  }
  async getUser(): Promise<{
    data: { user: LocalUser | null };
    error: { message: string; code?: string; name?: string; status?: number } | null;
  }> {
    this.current ??= (async () => {
      const token = (await cookies()).get(SESSION_COOKIE)?.value;
      if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
      const [user] = await rows<UserRow & { purpose: 'access' | 'recovery' }>(
        pool(),
        `SELECT u.id,u.email,u.deleted_at,u.created_at,u.last_sign_in_at,s.purpose FROM sessions s JOIN users u ON u.id=s.user_id
        WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP(3) AND u.deleted_at IS NULL`,
        [hashToken(token)],
      );
      return user
        ? {
            id: user.id,
            email: user.email,
            created_at: String(user.created_at),
            last_sign_in_at: user.last_sign_in_at ? String(user.last_sign_in_at) : undefined,
            user_metadata: {},
            app_metadata: { providers: ['email'] },
            sessionPurpose: user.purpose,
          }
        : null;
    })();
    try {
      return { data: { user: await this.current }, error: null };
    } catch (error) {
      return { data: { user: null }, error: databaseError(error) };
    }
  }
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    try {
      email = email.trim().toLowerCase();
      await this.limited(email, 'login', 10);
      const [user] = await rows<UserRow>(
        pool(),
        'SELECT * FROM users WHERE email=? AND deleted_at IS NULL',
        [email],
      );
      if (!(await verifyPassword(password, user?.password_hash || null)))
        return { data: { user: null, session: null }, error: failure('invalid_credentials') };
      if (!user.email_confirmed_at)
        return { data: { user: null, session: null }, error: failure('email_not_confirmed') };
      const [account] = await rows<{ blocked: boolean }>(
        pool(),
        'SELECT blocked FROM accounts WHERE id=?',
        [user.id],
      );
      if (account.blocked)
        return { data: { user: null, session: null }, error: failure('ACCOUNT_BLOCKED') };
      await this.setSession(user.id);
      const { data } = await this.getUser();
      return { data: { user: data.user, session: { user: data.user } }, error: null };
    } catch (error) {
      return { data: { user: null, session: null }, error: authFailure(error) };
    }
  }
  private async issue(
    userId: string,
    purpose: 'email' | 'recovery' | 'email_change',
    email: string,
    next = '/app',
  ) {
    const token = newToken();
    await transaction(async (db) => {
      await db.execute('DELETE FROM auth_tokens WHERE user_id=? AND purpose=?', [userId, purpose]);
      await db.execute(
        'INSERT INTO auth_tokens(token_hash,user_id,purpose,new_email,expires_at) VALUES(?,?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 1 HOUR))',
        [hashToken(token), userId, purpose, purpose === 'email_change' ? email : null],
      );
    });
    const url =
      appUrl() +
      '/auth/confirm?' +
      new URLSearchParams({ type: purpose, token_hash: token, next: returnPath(next) });
    const confirmation =
      purpose === 'recovery' ? undefined : confirmationEmail(url, purpose === 'email_change');
    await sendMail(
      email,
      purpose === 'recovery'
        ? 'Defina sua nova senha · GoIndica'
        : 'Confirme seu e-mail · GoIndica',
      confirmation?.text ??
        `Para ${purpose === 'recovery' ? 'definir uma nova senha' : 'confirmar seu e-mail'}, abra o link abaixo. Ele expira em uma hora.\n\n${url}\n\nSe você não solicitou esta mensagem, ignore-a.`,
      undefined,
      confirmation,
    );
  }
  async signUp({
    email,
    password,
    next = '/app',
    company,
  }: {
    email: string;
    password: string;
    next?: string;
    company?: NewCompany;
  }) {
    try {
      email = email.trim().toLowerCase();
      await this.limited(email, 'signup', 5);
      const [existing] = await rows<UserRow & { kind: string }>(
        pool(),
        'SELECT u.*,a.kind FROM users u LEFT JOIN accounts a ON a.id=u.id WHERE u.email=?',
        [email],
      );
      let id = existing?.id;
      if (!existing) {
        id = randomUUID();
        const hashed = await hashPassword(password);
        await transaction(async (db) => {
          await db.execute('INSERT INTO users(id,email,password_hash) VALUES(?,?,?)', [
            id,
            email,
            hashed,
          ]);
          await db.execute('INSERT INTO accounts(id,kind) VALUES(?,?)', [
            id,
            company ? 'company' : 'member',
          ]);
          if (company) await saveNewCompany(db, id!, company);
          await db.execute(
            "INSERT INTO audit_logs(id,actor_id,event_type,entity_type,entity_id,metadata) VALUES(?,?,'SIGNUP','ACCOUNT',?,?)",
            [randomUUID(), id, id, JSON.stringify(company ? { kind: 'company' } : {})],
          );
        });
      } else if (
        company &&
        existing.kind === 'company' &&
        !existing.email_confirmed_at &&
        !existing.deleted_at
      )
        // A pending company signup may be corrected (CNPJ, name) before the email is confirmed.
        await transaction((db) => saveNewCompany(db, existing.id, company));
      if (!existing || (!existing.email_confirmed_at && !existing.deleted_at))
        await this.issue(id!, 'email', email, next);
      return { data: { user: null, session: null }, error: null };
    } catch (error) {
      return { data: { user: null, session: null }, error: authFailure(error) };
    }
  }
  async resetPasswordForEmail(email: string) {
    try {
      email = email.trim().toLowerCase();
      await this.limited(email, 'recovery', 5);
      const [user] = await rows<UserRow>(
        pool(),
        `SELECT u.* FROM users u JOIN accounts a ON a.id=u.id WHERE u.email=? AND u.deleted_at IS NULL AND a.blocked=FALSE`,
        [email],
      );
      if (user) await this.issue(user.id, 'recovery', email);
      return { data: {}, error: null };
    } catch (error) {
      return { data: {}, error: authFailure(error) };
    }
  }
  async verifyOtp({ type, token_hash }: { type: string; token_hash: string }) {
    try {
      const token = await transaction(async (db) => {
        const [row] = await rows<{ user_id: string; new_email: string | null; purpose: string }>(
          db,
          `SELECT t.* FROM auth_tokens t JOIN users u ON u.id=t.user_id JOIN accounts a ON a.id=u.id
          WHERE t.token_hash=? AND t.purpose=? AND t.expires_at>UTC_TIMESTAMP(3) AND u.deleted_at IS NULL AND a.blocked=FALSE FOR UPDATE`,
          [hashToken(token_hash), type],
        );
        if (!row) throw failure('session_not_found');
        await db.execute('DELETE FROM auth_tokens WHERE token_hash=?', [hashToken(token_hash)]);
        if (type === 'email')
          await db.execute('UPDATE users SET email_confirmed_at=UTC_TIMESTAMP(3) WHERE id=?', [
            row.user_id,
          ]);
        if (type === 'email_change') {
          await db.execute(
            'UPDATE users SET email=?,email_confirmed_at=UTC_TIMESTAMP(3) WHERE id=?',
            [row.new_email, row.user_id],
          );
          await db.execute('DELETE FROM sessions WHERE user_id=?', [row.user_id]);
        }
        return row;
      });
      await this.setSession(token.user_id, type === 'recovery' ? 'recovery' : 'access');
      return { data: {}, error: null };
    } catch (error) {
      return { data: {}, error: authFailure(error) };
    }
  }
  async updateUser(input: { password?: string; email?: string }) {
    try {
      const {
        data: { user },
      } = await this.getUser();
      if (!user) throw failure('session_not_found');
      if (input.email) {
        if (user.sessionPurpose !== 'access') throw failure('session_not_found');
        await this.issue(user.id, 'email_change', input.email, '/conta');
        await sendMail(
          user.email,
          'Alteração de e-mail solicitada · GoIndica',
          'Foi solicitada uma alteração de e-mail da sua conta. Se não foi você, altere sua senha e entre em contato com a administração.',
        );
      }
      if (input.password) {
        if (input.password.length < 12 || input.password.length > 128)
          throw failure('weak_password');
        const hash = await hashPassword(input.password);
        await transaction(async (db) => {
          const [account] = await rows<{ blocked: boolean }>(
            db,
            'SELECT blocked FROM accounts WHERE id=? FOR UPDATE',
            [user.id],
          );
          if (!account || account.blocked) throw failure('ACCOUNT_BLOCKED');
          await db.execute(
            'UPDATE users SET password_hash=?,email_confirmed_at=COALESCE(email_confirmed_at,UTC_TIMESTAMP(3)) WHERE id=?',
            [hash, user.id],
          );
          await db.execute('DELETE FROM sessions WHERE user_id=?', [user.id]);
          await db.execute('DELETE FROM auth_tokens WHERE user_id=?', [user.id]);
        });
        if (user.sessionPurpose === 'access') await this.setSession(user.id);
      }
      return { data: { user }, error: null };
    } catch (error) {
      return { data: { user: null }, error: authFailure(error) };
    }
  }
  async signOut() {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (token) await pool().execute('DELETE FROM sessions WHERE token_hash=?', [hashToken(token)]);
    store.delete(SESSION_COOKIE);
    this.current = undefined;
    return { error: null };
  }
}
function authFailure(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    [
      'invalid_credentials',
      'email_not_confirmed',
      'session_not_found',
      'over_request_rate_limit',
      'weak_password',
      'ACCOUNT_BLOCKED',
    ].includes(String(error.code))
  )
    return error as ReturnType<typeof failure>;
  return databaseError(error);
}
