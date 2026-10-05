import type { components } from '@/shared/types/api';
import { SECTION_COMPONENTS } from './section-registry';

/**
 * Id de sección, derivado del contrato OpenAPI: el catálogo vive en el backend
 * (spec `layout-engine`). El registro de componentes está tipado con
 * `Record<SectionId, …>`, así que una sección nueva del backend no compila hasta
 * implementarse acá.
 */
export type SectionId = components['schemas']['SectionId'];

/** El catálogo en orden canónico, tomado del registro que el compilador obliga a completar. */
export const SECTION_IDS = Object.keys(SECTION_COMPONENTS) as SectionId[];

export function isSectionId(value: string): value is SectionId {
  return Object.hasOwn(SECTION_COMPONENTS, value);
}

/**
 * Las secciones a renderizar: las de la API, en su orden. El backend ya aplicó
 * orden, ocultado, relleno y secciones vacías; el cliente solo descarta los ids
 * que no sabe renderizar, para que un id nuevo no rompa la vista.
 */
export function renderableSections(sections: readonly string[]): SectionId[] {
  return sections.filter(isSectionId);
}
