import '@/app/styles/workspace.css';
import { memberSummary } from '@/server/queries';
import { CommunityStatus } from '@/components/community-status';
import Link from 'next/link';
import { AppChrome } from '@/components/app-chrome';
import { member } from '@/server/auth';
import { Avatar } from '@/components/ui';
import { Icon } from '@/components/icon';
import { profilePhotoUrl } from '@/lib/profile-links';
import { logout } from '@/server/actions';
import { AccountMenu } from '@/components/account-menu';
export const metadata = { robots: { index: false, follow: false } };
export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const { profile, admin } = await member();
  const summary = await memberSummary();
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
        <AccountMenu
          trigger={
            <>
              <Avatar name={profile.display_name} size={40} src={profilePhotoUrl(profile)} />
              <span className="profile-copy">
                <strong>{profile.display_name.split(' ')[0]}</strong> <span>@{profile.username}</span>
              </span>
              <Icon name="chevron" size={14} />
            </>
          }
        >
          <Link href="/perfil">
            <Icon name="person" size={18} />
            Meu perfil
          </Link>
          <form action={logout}>
            <button type="submit">
              <Icon name="logout" size={18} />
              Sair
            </button>
          </form>
        </AccountMenu>
      }
    >
      {children}
    </AppChrome>
  );
}
