import { CommunityStatus } from '@/components/community-status';
import { check } from '@/lib/errors';
import Link from 'next/link';
import { AppChrome } from '@/components/app-chrome';
import { member } from '@/server/auth';
import { Avatar } from '@/components/ui';
import { Icon } from '@/components/icon';
export const metadata = { robots: { index: false, follow: false } };
export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const { db, profile, admin } = await member();
  const summary = check(await db.rpc('member_summary'));
  return (
    <AppChrome
      admin={admin}
      notifications={
        <CommunityStatus
          key={summary.unread + ':' + summary.pending + ':' + summary.saved}
          initial={summary}
        />
      }
      account={
        <Link href="/perfil" className="profile-link" title="Meu perfil">
          <Avatar name={profile.display_name} url={profile.avatar_url} size={40} />
          <span className="profile-copy">
            <strong>{profile.display_name.split(' ')[0]}</strong> <span>@{profile.username}</span>
          </span>
          <Icon name="chevron" size={14} />
        </Link>
      }
    >
      {children}
    </AppChrome>
  );
}
