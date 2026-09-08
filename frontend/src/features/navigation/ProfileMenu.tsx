import { ChevronDown, Menu } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/shared/components/ui/sheet';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useLocale } from '@/shared/i18n/use-locale';
import { buildProfileLink } from '@/shared/lib/profile-link';
import { cn } from '@/shared/lib/utils';
import { useUiStore } from '@/shared/stores/ui.store';
import type { CuratedProfileSummary } from '@/shared/types/portfolio';
import { groupProfilesByRoleType } from './group-profiles';
import { useCuratedProfiles } from '../curated-view/hooks/use-curated-profile';

interface ProfileMenuProps {
  activeSlug: string;
}

/** Menú de perfiles curados: dropdown en escritorio, panel lateral en móvil. */
export function ProfileMenu({ activeSlug }: ProfileMenuProps) {
  const { locale, t } = useLocale();
  const { data, isPending } = useCuratedProfiles(locale);
  const menuOpen = useUiStore((s) => s.menuOpen);
  const setMenuOpen = useUiStore((s) => s.setMenuOpen);
  const profiles = data ?? [];

  return (
    <>
      <div className="hidden md:block">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              {t('nav.profiles')}
              <ChevronDown aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-[70vh] w-72 overflow-y-auto">
            {isPending ? (
              <MenuSkeleton />
            ) : (
              groupProfilesByRoleType(profiles).map((group, index) => (
                <DropdownMenuGroup key={group.roleType}>
                  {index > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel className="text-[10px] font-bold tracking-[0.12em] text-brand uppercase">
                    {group.roleType || t('nav.home')}
                  </DropdownMenuLabel>
                  {group.profiles.map((profile) => (
                    <DropdownMenuItem key={profile.slug} asChild>
                      <ProfileLink profile={profile} active={profile.slug === activeSlug} />
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="md:hidden">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon-sm" aria-label={t('nav.menu')}>
              <Menu aria-hidden />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[85vw] max-w-sm overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{t('nav.profiles')}</SheetTitle>
              <SheetDescription>{t('nav.profilesHint')}</SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-6">
              {isPending ? (
                <MenuSkeleton />
              ) : (
                <ProfileMenuList
                  profiles={profiles}
                  activeSlug={activeSlug}
                  onNavigate={() => setMenuOpen(false)}
                />
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

interface ProfileMenuListProps {
  profiles: readonly CuratedProfileSummary[];
  activeSlug: string;
  onNavigate?: () => void;
}

/** Lista agrupada por `roleType` (pura: recibe los perfiles). */
export function ProfileMenuList({ profiles, activeSlug, onNavigate }: ProfileMenuListProps) {
  const { t } = useLocale();
  return (
    <nav aria-label={t('nav.profiles')} className="flex flex-col gap-5">
      {groupProfilesByRoleType(profiles).map((group) => (
        <section key={group.roleType} aria-label={group.roleType || t('nav.home')}>
          <h3 className="mb-2 pl-1 text-[10px] font-bold tracking-[0.12em] text-brand uppercase">
            {group.roleType || t('nav.home')}
          </h3>
          <ul className="flex flex-col gap-1.5">
            {group.profiles.map((profile) => (
              <li key={profile.slug}>
                <ProfileLink
                  profile={profile}
                  active={profile.slug === activeSlug}
                  onClick={onNavigate}
                  className="w-full"
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}

interface ProfileLinkProps {
  profile: CuratedProfileSummary;
  active: boolean;
  className?: string;
  onClick?: () => void;
}

function ProfileLink({ profile, active, className, onClick }: ProfileLinkProps) {
  const [params] = useSearchParams();
  return (
    <Link
      to={buildProfileLink(profile.slug, params)}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex flex-col items-start rounded-theme-sm border border-border bg-card px-3 py-2 text-left leading-tight transition-colors hover:border-brand hover:text-text',
        active &&
          'border-transparent bg-brand-gradient text-brand-foreground hover:text-brand-foreground',
        className,
      )}
    >
      <span className="text-sm font-semibold">{profile.title}</span>
      {profile.techFocus && (
        <span className={cn('text-[11px]', active ? 'opacity-80' : 'text-text-dim')}>
          {profile.techFocus}
        </span>
      )}
    </Link>
  );
}

function MenuSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-2" aria-busy>
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
