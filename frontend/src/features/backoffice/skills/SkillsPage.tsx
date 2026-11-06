import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { formatCount } from '@/shared/i18n/plural';
import type { AdminSkill, AdminSkillCategory } from '../shared/admin-types';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { UnsavedChangesPrompt } from '../shared/UnsavedChangesPrompt';
import { useDialogDiscardGuard } from '../shared/use-dialog-discard-guard';
import { toCategoryBody, toSkillBody, type CategoryDraft, type SkillDraft } from './skills-form';
import { ChipListField } from '../shared/fields/ChipListField';
import { LocalizedField } from '../shared/fields/LocalizedField';
import { PageHeader } from '../shared/PageHeader';
import { EmptyState, ErrorPanel, LoadingRows } from '../shared/states';
import {
  notifyError,
  notifySuccess,
  useDeleteSkill,
  useDeleteSkillCategory,
  useSaveSkill,
  useSaveSkillCategory,
  useSkillCategories,
} from '../shared/use-admin-api';

/** Gestión de categorías y skills (spec `admin-content-management`). */
export function SkillsPage() {
  const categories = useSkillCategories();
  const saveCategory = useSaveSkillCategory();
  const deleteCategory = useDeleteSkillCategory();
  const saveSkill = useSaveSkill();
  const deleteSkill = useDeleteSkill();

  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft | null>(null);
  const [skillDraft, setSkillDraft] = useState<SkillDraft | null>(null);
  // Borrador al abrir cada diálogo: contra él se mide si hay cambios (D12).
  const [categoryBase, setCategoryBase] = useState<CategoryDraft | null>(null);
  const [skillBase, setSkillBase] = useState<SkillDraft | null>(null);
  const openCategory = (draft: CategoryDraft) => {
    setCategoryBase(draft);
    setCategoryDraft(draft);
  };
  const openSkill = (draft: SkillDraft) => {
    setSkillBase(draft);
    setSkillDraft(draft);
  };
  const categoryGuard = useDialogDiscardGuard({
    dirty:
      categoryDraft !== null &&
      categoryBase !== null &&
      JSON.stringify(toCategoryBody(categoryDraft)) !==
        JSON.stringify(toCategoryBody(categoryBase)),
    onClose: () => setCategoryDraft(null),
  });
  const skillGuard = useDialogDiscardGuard({
    dirty:
      skillDraft !== null &&
      skillBase !== null &&
      JSON.stringify(toSkillBody(skillDraft)) !== JSON.stringify(toSkillBody(skillBase)),
    onClose: () => setSkillDraft(null),
  });

  const submitCategory = (event: FormEvent) => {
    event.preventDefault();
    if (!categoryDraft || !categoryDraft.name.es.trim()) return;
    saveCategory.mutate(
      {
        id: categoryDraft.id,
        body: toCategoryBody(categoryDraft),
      },
      {
        onSuccess: () => {
          notifySuccess(categoryDraft.id ? 'Categoría actualizada' : 'Categoría creada');
          setCategoryDraft(null);
        },
        onError: (error) => notifyError(error),
      },
    );
  };

  const submitSkill = (event: FormEvent) => {
    event.preventDefault();
    if (!skillDraft || !skillDraft.name.trim()) return;
    saveSkill.mutate(
      {
        id: skillDraft.id,
        categoryId: skillDraft.categoryId,
        body: toSkillBody(skillDraft),
      },
      {
        onSuccess: () => {
          notifySuccess(skillDraft.id ? 'Skill actualizada' : 'Skill creada');
          setSkillDraft(null);
        },
        onError: (error) => notifyError(error),
      },
    );
  };

  return (
    <>
      <PageHeader
        title="Skills"
        description="Categorías y habilidades técnicas; sus tags deciden qué aparece en cada perfil curado."
        actions={
          <Button onClick={() => openCategory({ name: { es: '', en: '' }, order: 0 })}>
            <Plus aria-hidden />
            Nueva categoría
          </Button>
        }
      />

      {categories.isPending && <LoadingRows />}
      {categories.isError && (
        <ErrorPanel message={categories.error.message} onRetry={() => void categories.refetch()} />
      )}
      {categories.data?.length === 0 && (
        <EmptyState title="Todavía no hay categorías" description="Creá la primera para empezar." />
      )}

      {categories.data && categories.data.length > 0 && (
        <div className="flex flex-col gap-4">
          {categories.data.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              onEdit={() =>
                openCategory({
                  id: category.id,
                  name: { es: category.name.es, en: category.name.en ?? '' },
                  order: category.order,
                })
              }
              onDelete={() =>
                deleteCategory.mutate(category.id, {
                  onSuccess: () => notifySuccess('Categoría borrada'),
                  onError: (error) => notifyError(error, 'No se pudo borrar'),
                })
              }
              onAddSkill={() =>
                openSkill({
                  categoryId: category.id,
                  categoryName: category.name.es,
                  name: '',
                  tags: [],
                  order: category.skills.length,
                })
              }
              onEditSkill={(skill) =>
                openSkill({
                  id: skill.id,
                  categoryId: category.id,
                  categoryName: category.name.es,
                  name: skill.name,
                  tags: [...skill.tags],
                  order: skill.order,
                })
              }
              onDeleteSkill={(skill) =>
                deleteSkill.mutate(skill.id, {
                  onSuccess: () => notifySuccess('Skill borrada'),
                  onError: (error) => notifyError(error, 'No se pudo borrar'),
                })
              }
            />
          ))}
        </div>
      )}

      {/* Categoría */}
      <Dialog
        open={categoryDraft !== null}
        onOpenChange={(open) => !open && categoryGuard.requestClose()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{categoryDraft?.id ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
            <DialogDescription>
              El nombre se muestra en la grilla de skills de la vista pública.
            </DialogDescription>
          </DialogHeader>
          {categoryDraft && (
            <form onSubmit={submitCategory} className="flex flex-col gap-4" noValidate>
              <LocalizedField
                label="Nombre"
                required
                value={categoryDraft.name}
                onChange={(name) =>
                  setCategoryDraft({ ...categoryDraft, name: { es: name.es, en: name.en ?? '' } })
                }
              />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="category-order">Orden</Label>
                <Input
                  id="category-order"
                  type="number"
                  min={0}
                  value={categoryDraft.order}
                  onChange={(event) =>
                    setCategoryDraft({ ...categoryDraft, order: Number(event.target.value) })
                  }
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={categoryGuard.requestClose}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saveCategory.isPending}>
                  {saveCategory.isPending ? 'Guardando…' : 'Guardar'}
                </Button>
              </DialogFooter>
            </form>
          )}
          <UnsavedChangesPrompt {...categoryGuard.promptProps} />
        </DialogContent>
      </Dialog>

      {/* Skill */}
      <Dialog
        open={skillDraft !== null}
        onOpenChange={(open) => !open && skillGuard.requestClose()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{skillDraft?.id ? 'Editar skill' : 'Nueva skill'}</DialogTitle>
            <DialogDescription>
              {skillDraft ? `Categoría: ${skillDraft.categoryName}` : ''}
            </DialogDescription>
          </DialogHeader>
          {skillDraft && (
            <form onSubmit={submitSkill} className="flex flex-col gap-4" noValidate>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="skill-name">
                  Nombre<span className="text-brand-ink"> *</span>
                </Label>
                <Input
                  id="skill-name"
                  value={skillDraft.name}
                  onChange={(event) => setSkillDraft({ ...skillDraft, name: event.target.value })}
                />
              </div>
              <ChipListField
                label="Tags"
                value={skillDraft.tags}
                placeholder="java"
                description="Deciden en qué perfiles curados aparece esta skill."
                onChange={(tags) => setSkillDraft({ ...skillDraft, tags })}
              />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="skill-order">Orden</Label>
                <Input
                  id="skill-order"
                  type="number"
                  min={0}
                  value={skillDraft.order}
                  onChange={(event) =>
                    setSkillDraft({ ...skillDraft, order: Number(event.target.value) })
                  }
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={skillGuard.requestClose}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saveSkill.isPending}>
                  {saveSkill.isPending ? 'Guardando…' : 'Guardar'}
                </Button>
              </DialogFooter>
            </form>
          )}
          <UnsavedChangesPrompt {...skillGuard.promptProps} />
        </DialogContent>
      </Dialog>
    </>
  );
}

interface CategoryCardProps {
  category: AdminSkillCategory;
  onEdit: () => void;
  onDelete: () => void;
  onAddSkill: () => void;
  onEditSkill: (skill: AdminSkill) => void;
  onDeleteSkill: (skill: AdminSkill) => void;
}

function CategoryCard({
  category,
  onEdit,
  onDelete,
  onAddSkill,
  onEditSkill,
  onDeleteSkill,
}: CategoryCardProps) {
  return (
    <section aria-label={category.name.es} className="surface p-card">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="flex-1 font-semibold text-brand-2-ink">{category.name.es}</h2>
        <span className="text-xs text-text-dim">
          {formatCount(category.skills.length, { one: 'skill', other: 'skills' })}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={`Editar categoría ${category.name.es}`}
          onClick={onEdit}
        >
          <Pencil aria-hidden />
        </Button>
        <ConfirmDialog
          trigger={
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={`Borrar categoría ${category.name.es}`}
            >
              <Trash2 aria-hidden />
            </Button>
          }
          title="Borrar categoría"
          description={`Se borrará "${category.name.es}" y también ${category.skills.length === 1 ? 'su' : 'sus'} ${formatCount(category.skills.length, { one: 'skill', other: 'skills' })}. Esta acción no se puede deshacer.`}
          onConfirm={onDelete}
        />
        <Button variant="outline" size="sm" onClick={onAddSkill}>
          <Plus aria-hidden />
          Skill
        </Button>
      </header>

      {category.skills.length === 0 ? (
        <p className="text-sm text-text-dim">Sin skills todavía.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {category.skills.map((skill) => (
            <li
              key={skill.id}
              className="flex items-center gap-1 rounded-theme-sm border border-border bg-bg-soft py-1 pr-1 pl-3"
            >
              <span className="text-sm">{skill.name}</span>
              {skill.tags.length > 0 && (
                <span className="text-[10px] text-text-dim">{skill.tags.join(',')}</span>
              )}
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Editar ${skill.name}`}
                onClick={() => onEditSkill(skill)}
              >
                <Pencil aria-hidden />
              </Button>
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="icon-xs" aria-label={`Borrar ${skill.name}`}>
                    <Trash2 aria-hidden />
                  </Button>
                }
                title="Borrar skill"
                description={`Se borrará "${skill.name}" de ${category.name.es}.`}
                onConfirm={() => onDeleteSkill(skill)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
