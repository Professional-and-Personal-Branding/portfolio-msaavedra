import { Fragment, useMemo, type CSSProperties, type ReactNode } from 'react';
import type { Locale } from '@/shared/i18n/locale';
import { translate } from '@/shared/i18n/messages';
import type { CuratedProfile } from '@/shared/types/portfolio';
import { tokensToCssVars } from '@/themes/css-vars';
import { paperTokens } from '@/themes/presets/paper';
import { useTheme } from '@/themes/use-theme';
import {
  buildPrintSheet,
  displayUrl,
  type PrintBlock,
  type PrintExperience,
  type PrintLink,
} from './print-sheet';

interface PrintableSheetProps {
  data: CuratedProfile;
  locale: Locale;
}

/**
 * Hoja imprimible de un perfil curado (decisión D1 de `add-printable-one-page`). Está en el
 * DOM de la vista pero con `display: none` en pantalla; al imprimir es lo único que se ve.
 * Solo renderiza el modelo de `buildPrintSheet`: no decide qué entra. No usa `MotionSection`
 * ni `motion` (D7), ni degradés, sombras o texto recortado: es HTML estático y siempre visible.
 */
export function PrintableSheet({ data, locale }: PrintableSheetProps) {
  const { tokens } = useTheme();
  const origin = globalThis.location?.origin ?? '';
  const model = useMemo(() => buildPrintSheet(data, locale, origin), [data, locale, origin]);
  const style = useMemo<CSSProperties>(
    () => ({ ...tokensToCssVars(paperTokens(tokens)), colorScheme: 'light' }),
    [tokens],
  );
  const { header } = model;

  return (
    <div
      data-print-sheet
      aria-hidden="true"
      lang={locale}
      className="hidden bg-bg font-sans text-[9.5pt] leading-[1.3] text-text print:block"
      style={style}
    >
      <header className="mb-1.5 border-b-2 border-brand pb-1.5">
        <h1 className="font-heading text-[18pt] leading-tight font-bold">{header.fullName}</h1>
        {header.headline && (
          <p className="font-heading text-[11pt] leading-tight font-semibold">{header.headline}</p>
        )}
        {header.description && (
          <p className="mt-0.5 line-clamp-2 text-text-muted">{header.description}</p>
        )}
        <Inline
          className="mt-1"
          items={header.contact.map((link) => (
            <LinkOrText link={link} />
          ))}
        />
        {header.details.map((line) => (
          <p key={line} className="text-[8.5pt] text-text-muted">
            {line}
          </p>
        ))}
      </header>

      {model.blocks.map((block) => (
        <Block key={block.section} block={block} />
      ))}

      <p className="mt-1.5 border-t border-border pt-1 text-[8pt] text-text-muted">
        {translate(locale, 'print.fullVersion')}:{' '}
        <a href={model.fullUrl} className="text-text underline">
          {displayUrl(model.fullUrl)}
        </a>
      </p>
    </div>
  );
}

/** Elementos separados por un punto medio, en una o más líneas. */
function Inline({ items, className }: { items: ReactNode[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <p className={className}>
      {items.map((item, index) => (
        <Fragment key={index}>
          {index > 0 && <span aria-hidden> · </span>}
          {item}
        </Fragment>
      ))}
    </p>
  );
}

function LinkOrText({ link }: { link: PrintLink }) {
  return link.href ? (
    <a href={link.href} className="text-text underline">
      {link.text}
    </a>
  ) : (
    <span>{link.text}</span>
  );
}

function Block({ block }: { block: PrintBlock }) {
  // Los repositorios son una sola línea con el rótulo en línea (D9 de `add-featured-repositories`).
  if (block.kind === 'repositories') {
    return (
      <section data-print-block={block.section} className="border-t border-border py-1">
        <p className="line-clamp-1">
          <span className="font-heading text-[8pt] font-bold tracking-wider text-text-muted uppercase">
            {block.label}:
          </span>{' '}
          {block.items.map((item, index) => (
            <Fragment key={item.href ?? item.text}>
              {index > 0 && <span aria-hidden> · </span>}
              <LinkOrText link={item} />
            </Fragment>
          ))}
          {block.omittedLabel && (
            <>
              <span aria-hidden> · </span>
              <span className="text-text-muted italic">{block.omittedLabel}</span>
            </>
          )}
        </p>
      </section>
    );
  }
  return (
    <section
      data-print-block={block.section}
      className="grid grid-cols-[28mm_1fr] gap-x-3 border-t border-border py-1 first:border-t-0"
    >
      <h2 className="font-heading text-[8pt] font-bold tracking-wider text-text-muted uppercase">
        {block.label}
      </h2>
      <div className="min-w-0">
        <BlockBody block={block} />
        {block.omittedLabel && (
          <p className="mt-0.5 text-[8.5pt] text-text-muted italic">{block.omittedLabel}</p>
        )}
      </div>
    </section>
  );
}

function BlockBody({ block }: { block: PrintBlock }) {
  switch (block.kind) {
    case 'summary':
      return <p className="line-clamp-4">{block.text}</p>;
    case 'experience':
      return (
        <>
          {block.detailed.map((experience, index) => (
            <DetailedExperience key={`${experience.company}-${index}`} experience={experience} />
          ))}
          {block.lines.length > 0 && (
            <ul className="mt-0.5 flex flex-col">
              {block.lines.map((line) => (
                <li key={line} className="line-clamp-1 break-inside-avoid">
                  {line}
                </li>
              ))}
            </ul>
          )}
        </>
      );
    case 'skills':
      return (
        <ul className="flex flex-col">
          {block.categories.map((category) => (
            <li
              key={category.name}
              className="line-clamp-2 break-inside-avoid text-[8.5pt] leading-[1.25]"
            >
              <span className="font-semibold">{category.name}:</span> {category.skills.join(' · ')}
              {category.more > 0 && ` · +${category.more}`}
            </li>
          ))}
        </ul>
      );
    case 'projects':
      return (
        <ul className="flex flex-col gap-0.5">
          {block.items.map((project) => (
            <li key={project.name} className="flex gap-3 break-inside-avoid">
              <p className="line-clamp-2 min-w-0 flex-1">
                <span className="font-semibold">{project.name}</span>
                {project.role && <span className="text-text-muted"> ({project.role})</span>}
                {project.summary && <> — {project.summary}</>}
              </p>
              {project.url && (
                <span className="shrink-0 text-[8.5pt]">
                  <LinkOrText link={project.url} />
                </span>
              )}
            </li>
          ))}
        </ul>
      );
    case 'education':
      return (
        <ul className="flex flex-col">
          {block.items.map((item) => (
            <li
              key={`${item.degree}-${item.institution}`}
              className="flex justify-between gap-3 break-inside-avoid"
            >
              <span className="line-clamp-1 min-w-0">
                <span className="font-semibold">{item.degree}</span> — {item.institution}
              </span>
              <span className="shrink-0 text-text-muted">{item.period}</span>
            </li>
          ))}
        </ul>
      );
    case 'certifications':
      return (
        <p className="line-clamp-3">
          {block.items.map((item, index) => (
            <Fragment key={index}>
              {index > 0 && <span aria-hidden> · </span>}
              {item.text}
              {item.credential && (
                <>
                  {' '}
                  <LinkOrText link={item.credential} />
                </>
              )}
            </Fragment>
          ))}
        </p>
      );
    case 'repositories':
      return null; // lo dibuja `Block`
  }
}

function DetailedExperience({ experience }: { experience: PrintExperience }) {
  const when = [experience.period, experience.location].filter(Boolean).join(' · ');
  return (
    <article className="mb-0.5 break-inside-avoid last:mb-0">
      <div className="flex justify-between gap-3">
        <h3 className="line-clamp-1 min-w-0 font-semibold">
          {experience.role} — {experience.company}
        </h3>
        <span className="shrink-0 text-[8.5pt] text-text-muted">{when}</span>
      </div>
      {experience.achievements.length > 0 && (
        <ul className="list-disc pl-4 marker:text-text-muted">
          {experience.achievements.map((achievement) => (
            <li key={achievement} className="line-clamp-2">
              {achievement}
            </li>
          ))}
        </ul>
      )}
      {experience.technologies.length > 0 && (
        <p className="line-clamp-1 text-[8.5pt] text-text-muted">
          {experience.technologies.join(' · ')}
          {experience.technologiesMore > 0 && ` · +${experience.technologiesMore}`}
        </p>
      )}
    </article>
  );
}
