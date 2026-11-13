import type { CvEntityType } from '../shared/admin-types';
import { EDIT_PARAM } from '../shared/use-edit-param';

/**
 * Destino del enlace «Abrir» de un hallazgo (D12 de `add-cv-consistency-rules`). Las pantallas de
 * listas abren el diálogo del ítem con `?editar=<id>`; el perfil curado tiene ficha propia.
 */
export function issueHref(entityType: CvEntityType, entityId: string): string {
  const id = encodeURIComponent(entityId);
  switch (entityType) {
    case 'profile':
    case 'language':
      return '/admin/portada';
    case 'experience':
      return `/admin/experiencias?${EDIT_PARAM}=${id}`;
    case 'skillCategory':
    case 'skill':
      return `/admin/skills?${EDIT_PARAM}=${id}`;
    case 'education':
    case 'certification':
      return `/admin/formacion?${EDIT_PARAM}=${id}`;
    case 'project':
    case 'repository':
    case 'socialLink':
      return `/admin/proyectos?${EDIT_PARAM}=${id}`;
    case 'curatedProfile':
      return `/admin/perfiles/${id}`;
  }
}
