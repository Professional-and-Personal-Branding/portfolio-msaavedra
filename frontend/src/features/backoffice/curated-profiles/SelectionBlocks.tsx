import type { UseQueryResult } from '@tanstack/react-query';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import type { AdminExperience, AdminProject, AdminSkillCategory } from '../shared/admin-types';
import { ErrorPanel, LoadingRows } from '../shared/states';
import type { ProfileDraft } from './profile-draft';
import {
  categoryOverrideCounts,
  filterSkillCategories,
  hasOverrideConflict,
  overrideState,
  type OverrideMode,
} from './selection-overrides';
import { OverrideList, OverrideRow, OverrideScrollArea } from './SelectionOverrides';

type Overrides = Pick<ProfileDraft, 'includeIds' | 'excludeIds'>;

interface BlockProps<T> {
  draft: Overrides;
  query: UseQueryResult<T[]>;
  onOverride: (id: string, mode: OverrideMode) => void;
}

/** Visibles primero y ocultos al final, conservando el orden de cada grupo (D6). */
function hiddenLast<T extends { visible: boolean }>(items: readonly T[]): T[] {
  return [...items.filter((item) => item.visible), ...items.filter((item) => !item.visible)];
}

/** Carga y error propios del bloque: no bloquean el resto de la ficha ni el guardado (D9). */
function BlockState({
  query,
  children,
}: {
  query: UseQueryResult<unknown[]>;
  children: ReactNode;
}) {
  if (query.isPending) return <LoadingRows rows={3} />;
  if (query.isError) {
    return <ErrorPanel message={query.error.message} onRetry={() => void query.refetch()} />;
  }
  return <>{children}</>;
}

/** Bloque Experiencias de la pestaña Selección. */
export function ExperiencesBlock({ draft, query, onOverride }: BlockProps<AdminExperience>) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">Experiencias</p>
      <p className="mb-3 text-xs text-text-dim">
        Forzá la inclusión de una experiencia que no comparte tags, o excluí una que sí.
      </p>
      <BlockState query={query}>
        <OverrideScrollArea label="Experiencias">
          <OverrideList>
            {hiddenLast(query.data ?? []).map((experience) => (
              <OverrideRow
                key={experience.id}
                name={experience.company}
                label={experience.company}
                detail={experience.role.es}
                state={overrideState(draft, experience.id)}
                conflict={hasOverrideConflict(draft, experience.id)}
                hidden={!experience.visible}
                feminine
                onChange={(mode) => onOverride(experience.id, mode)}
              />
            ))}
          </OverrideList>
        </OverrideScrollArea>
      </BlockState>
    </div>
  );
}

/** Bloque Skills: una fila por skill agrupada por categoría, con buscador por nombre (D3, D10). */
export function SkillsBlock({ draft, query, onOverride }: BlockProps<AdminSkillCategory>) {
  // Estado de vista: no entra en el borrador, no ensucia la ficha ni toca el preview.
  const [search, setSearch] = useState('');
  const searchId = useId();
  const categories = useMemo(
    () => filterSkillCategories(query.data ?? [], search),
    [query.data, search],
  );
  const searching = search.trim() !== '';

  return (
    <div>
      <p className="mb-2 text-sm font-semibold">Skills</p>
      <p className="mb-3 text-xs text-text-dim">
        Forzá o quitá skills una por una. Incluir y Excluir se apagan entre sí: la exclusión es la
        que gana.
      </p>
      <BlockState query={query}>
        <div className="mb-3 flex flex-col gap-1.5">
          <Label htmlFor={searchId}>Buscar skill</Label>
          <Input
            id={searchId}
            value={search}
            placeholder="Kotlin"
            autoComplete="off"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        {searching && categories.length === 0 ? (
          <p role="status" className="text-xs text-text-dim">
            Ninguna skill coincide con &quot;{search.trim()}&quot;
          </p>
        ) : (
          <OverrideScrollArea label="Skills">
            <div className="flex flex-col gap-3">
              {categories.map((category) => (
                <SkillGroup
                  key={category.id}
                  category={category}
                  counts={categoryOverrideCounts(draft, category)}
                  draft={draft}
                  onOverride={onOverride}
                />
              ))}
            </div>
          </OverrideScrollArea>
        )}
      </BlockState>
    </div>
  );
}

function SkillGroup({
  category,
  counts,
  draft,
  onOverride,
}: {
  category: AdminSkillCategory;
  counts: { included: number; excluded: number };
  draft: Overrides;
  onOverride: (id: string, mode: OverrideMode) => void;
}) {
  const headingId = useId();
  const summary = [
    counts.included > 0 && `${counts.included} ${counts.included === 1 ? 'incluida' : 'incluidas'}`,
    counts.excluded > 0 && `${counts.excluded} ${counts.excluded === 1 ? 'excluida' : 'excluidas'}`,
  ].filter(Boolean);

  return (
    <div role="group" aria-labelledby={headingId} className="flex flex-col gap-1">
      <p id={headingId} className="text-xs font-semibold">
        {category.name.es}
        {summary.length > 0 && (
          <span className="font-normal text-text-dim"> · {summary.join(' · ')}</span>
        )}
      </p>
      <OverrideList>
        {category.skills.map((skill) => (
          <OverrideRow
            key={skill.id}
            name={skill.name}
            label={skill.name}
            state={overrideState(draft, skill.id)}
            conflict={hasOverrideConflict(draft, skill.id)}
            feminine
            onChange={(mode) => onOverride(skill.id, mode)}
          />
        ))}
      </OverrideList>
    </div>
  );
}

/** Bloque Proyectos: Incluir y Excluir por proyecto, los ocultos al final (D4, D6). */
export function ProjectsBlock({ draft, query, onOverride }: BlockProps<AdminProject>) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">Proyectos</p>
      <p className="mb-3 text-xs text-text-dim">
        Forzá la inclusión de un proyecto que no comparte tags, o excluí uno que sí.
      </p>
      <BlockState query={query}>
        <OverrideScrollArea label="Proyectos">
          <OverrideList>
            {hiddenLast(query.data ?? []).map((project) => (
              <OverrideRow
                key={project.id}
                name={project.name}
                label={project.name}
                detail={project.role.es}
                state={overrideState(draft, project.id)}
                conflict={hasOverrideConflict(draft, project.id)}
                hidden={!project.visible}
                onChange={(mode) => onOverride(project.id, mode)}
              />
            ))}
          </OverrideList>
        </OverrideScrollArea>
      </BlockState>
    </div>
  );
}
