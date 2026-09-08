import { TopBar } from '@/features/navigation/TopBar';
import { Footer } from '@/shared/components/portfolio/Footer';
import { useUrlState } from '@/shared/lib/url-state';
import { resolveLayoutName } from '@/themes/layouts';
import { ThemeProvider } from '@/themes/theme-provider';
import { NotFound } from './components/NotFound';

export function NotFoundPage() {
  const [url] = useUrlState();
  return (
    <ThemeProvider presetSlug={url.theme}>
      <div className="flex min-h-screen flex-col">
        <TopBar activeSlug="" layout={resolveLayoutName(url.layout)} />
        <main className="flex-1">
          <NotFound />
        </main>
        <Footer />
      </div>
    </ThemeProvider>
  );
}
