import { ConfirmDialog } from './ConfirmDialog';
import type { UnsavedChangesGuard } from './use-unsaved-changes-guard';

/** Diálogo del guardián: *Seguir editando* cancela la navegación, *Salir sin guardar* la deja pasar. */
export function UnsavedChangesDialog({ guard }: { guard: UnsavedChangesGuard }) {
  const { blocker } = guard;
  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      onOpenChange={(open) => {
        if (!open && blocker.state === 'blocked') blocker.reset();
      }}
      title="Tenés cambios sin guardar"
      description="Si salís ahora, se descartan los cambios de esta página."
      cancelLabel="Seguir editando"
      confirmLabel="Salir sin guardar"
      onConfirm={() => {
        if (blocker.state === 'blocked') blocker.proceed();
      }}
    />
  );
}
