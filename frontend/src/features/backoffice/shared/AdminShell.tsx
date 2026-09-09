import {
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  Palette,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { Button } from '@/shared/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/shared/components/ui/sheet';
import { Toaster } from '@/shared/components/ui/sonner';
import { applyDocumentMeta, restoreDocumentMeta } from '@/shared/lib/document-meta';
import { cn } from '@/shared/lib/utils';
import { ThemeProvider } from '@/themes/theme-provider';
import { useLogout, useSession } from '../auth/use-session';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/experiencias', label: 'Experiencias', icon: Wrench, end: false },
  { to: '/admin/skills', label: 'Skills', icon: Sparkles, end: false },
  { to: '/admin/perfiles', label: 'Perfiles curados', icon: Palette, end: false },
] as const;

/**
 * Marco del backoffice. Fija el preset `modern-dark` para que el panel tenga
 * una apariencia estable, independiente del tema que se esté editando en el
 * customizador (decisión D4).
 */
export function AdminShell({ children }: { children: ReactNode }) {
  // El backoffice nunca se indexa (spec `public-seo`).
  useEffect(() => {
    applyDocumentMeta({
      title: 'Backoffice · Portafolio',
      description: 'Panel de administración del portafolio.',
      canonical: `${globalThis.location?.origin ?? ''}/admin`,
      locale: 'es',
      noindex: true,
    });
    return () => restoreDocumentMeta();
  }, []);

  return (
    <ThemeProvider presetSlug="modern-dark">
      <div className="flex min-h-screen flex-col">{children}</div>
      <Toaster position="bottom-right" richColors closeButton />
    </ThemeProvider>
  );
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const { data: admin } = useSession();
  const { logout, isPending } = useLogout();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border glass">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                className="md:hidden"
                aria-label="Abrir menú"
              >
                <Menu aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <SheetHeader>
                <SheetTitle>Backoffice</SheetTitle>
                <SheetDescription>Administración del portafolio</SheetDescription>
              </SheetHeader>
              <nav aria-label="Secciones" className="flex flex-col gap-1 px-4 pb-6">
                <NavLinks onNavigate={() => setMenuOpen(false)} />
              </nav>
            </SheetContent>
          </Sheet>

          <Link to="/admin" className="font-heading text-sm font-bold tracking-tight">
            Backoffice
          </Link>

          <nav aria-label="Secciones" className="ml-4 hidden items-center gap-1 md:flex">
            <NavLinks />
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {admin && (
              <span className="hidden text-xs text-text-dim sm:inline" data-testid="admin-name">
                {admin.name}
              </span>
            )}
            <Button asChild variant="outline" size="sm">
              <Link to="/" target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden />
                <span className="hidden sm:inline">Ver portafolio</span>
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => void logout()} disabled={isPending}>
              <LogOut aria-hidden />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </Button>
          </div>
        </div>
      </header>

      <main key={location.pathname} className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
    </>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2 rounded-theme-sm px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-brand/15 text-brand'
                : 'text-text-muted hover:bg-bg-soft hover:text-text',
            )
          }
        >
          <item.icon className="size-4" aria-hidden />
          {item.label}
        </NavLink>
      ))}
    </>
  );
}
