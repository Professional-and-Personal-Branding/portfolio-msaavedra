import { ConfirmDialog } from './ConfirmDialog';

export interface UnsavedChangesPromptProps {
  open: boolean;
  /** *Seguir editando* (también Escape dentro del aviso). */
  onStay: () => void;
  /** Confirma la salida o el descarte. */
  onLeave: () => void;
  leaveLabel: string;
}

/** Aviso presentacional de cambios sin guardar; lo comparten el guardián de página y el de diálogo. */
export function UnsavedChangesPrompt({
  open,
  onStay,
  onLeave,
  leaveLabel,
}: UnsavedChangesPromptProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && open) onStay();
      }}
      title="Tenés cambios sin guardar"
      description="Si salís ahora, se descartan los cambios de esta página."
      cancelLabel="Seguir editando"
      confirmLabel={leaveLabel}
      onConfirm={onLeave}
    />
  );
}
