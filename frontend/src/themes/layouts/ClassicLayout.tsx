import type { LayoutProps } from './index';
import { SECTION_COMPONENTS } from './section-registry';

/** Una columna, hero arriba (como `docs/demo.html`). */
export function ClassicLayout({ data, sections }: LayoutProps) {
  return (
    <div data-layout="classic" className="mx-auto w-full max-w-(--t-max-width) px-6">
      {sections.map((id) => {
        const Section = SECTION_COMPONENTS[id];
        return <Section key={id} data={data} />;
      })}
    </div>
  );
}
