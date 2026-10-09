import { useState } from 'react';
import type { UnsavedChangesPromptProps } from './UnsavedChangesPrompt';
import { useWarnBeforeUnload } from './use-warn-before-unload';

export interface DialogDiscardGuard {
  /** Para `onOpenChange(false)` del `Dialog` y para *Cancelar*: cierra directo o abre el aviso. */
  requestClose: () => void;
  /** Props para `<UnsavedChangesPrompt />`, montado dentro del formulario. */
  promptProps: UnsavedChangesPromptProps;
}

/**
 * Guardián de un formulario en diálogo (D11): intercepta su propio cierre, sin `useBlocker`.
 * El cierre posterior a un guardado exitoso lo hace el padre y no pasa por aquí.
 */
export function useDialogDiscardGuard({
  dirty,
  onClose,
}: {
  dirty: boolean;
  onClose: () => void;
}): DialogDiscardGuard {
  const [asking, setAsking] = useState(false);
  useWarnBeforeUnload(dirty);

  return {
    requestClose: () => {
      if (dirty) setAsking(true);
      else onClose();
    },
    promptProps: {
      open: asking,
      onStay: () => setAsking(false),
      onLeave: () => {
        setAsking(false);
        onClose();
      },
      leaveLabel: 'Descartar',
    },
  };
}
