import { ConfirmDialog } from './ConfirmDialog';

export interface UnsavedChangesPromptProps {
  open: boolean;
  /** *Seguir editando* (también Escape dentro del aviso). */
  onStay: () => void;
  /** Confirma la salida o el descarte. */
  onLeave: () => void;
  leaveLabel: string;
  /** Texto del aviso; por defecto el de página (constructor y Portada). */
  description?: string;
}

/** Aviso presentacional de cambios sin guardar; lo comparten el guardián de página y el de diálogo. */
export function UnsavedChangesPrompt({
  open,
  onStay,
  onLeave,
  leaveLabel,
  description = 'Si salís ahora, se descartan los cambios de esta página.',
}: UnsavedChangesPromptProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && open) onStay();
      }}
      title="Tenés cambios sin guardar"
      description={description}
      cancelLabel="Seguir editando"
      confirmLabel={leaveLabel}
      onConfirm={onLeave}
    />
  );
}
