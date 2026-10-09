import { UnsavedChangesPrompt } from './UnsavedChangesPrompt';
import type { UnsavedChangesGuard } from './use-unsaved-changes-guard';

/** Diálogo del guardián: *Seguir editando* cancela la navegación, *Salir sin guardar* la deja pasar. */
export function UnsavedChangesDialog({ guard }: { guard: UnsavedChangesGuard }) {
  const { blocker } = guard;
  return (
    <UnsavedChangesPrompt
      open={blocker.state === 'blocked'}
      onStay={() => {
        if (blocker.state === 'blocked') blocker.reset();
      }}
      onLeave={() => {
        if (blocker.state === 'blocked') blocker.proceed();
      }}
      leaveLabel="Salir sin guardar"
    />
  );
}
