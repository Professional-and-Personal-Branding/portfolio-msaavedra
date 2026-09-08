import type { LayoutProps } from './index';
import { SECTION_COMPONENTS } from './section-registry';

const ASIDE_SECTIONS = new Set(['hero', 'contact']);

/** Columna lateral fija con identidad y contacto; contenido a la derecha; en móvil apilado. */
export function SidebarLayout({ data, sections }: LayoutProps) {
  const aside = sections.filter((id) => ASIDE_SECTIONS.has(id));
  const main = sections.filter((id) => !ASIDE_SECTIONS.has(id));

  return (
    <div
      data-layout="sidebar"
      className="mx-auto grid w-full max-w-(--t-max-width) gap-8 px-6 pt-8 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-12"
    >
      <aside className="flex flex-col gap-6 self-start lg:sticky lg:top-24">
        {aside.map((id) => {
          const Section = SECTION_COMPONENTS[id];
          return <Section key={id} data={data} variant="compact" />;
        })}
      </aside>
      <div className="min-w-0">
        {main.map((id) => {
          const Section = SECTION_COMPONENTS[id];
          return <Section key={id} data={data} />;
        })}
      </div>
    </div>
  );
}
