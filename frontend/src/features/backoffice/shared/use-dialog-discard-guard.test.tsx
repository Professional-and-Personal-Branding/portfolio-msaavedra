import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { UnsavedChangesPrompt } from './UnsavedChangesPrompt';
import { useDialogDiscardGuard } from './use-dialog-discard-guard';

/** Formulario mínimo: el padre lo abre y lo cierra; `Guardar` cierra desde el padre sin pasar por el guardián. */
function Harness() {
  const [open, setOpen] = useState(true);
  return open ? <Form onClose={() => setOpen(false)} /> : <p>cerrado</p>;
}

function Form({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const guard = useDialogDiscardGuard({ dirty: name !== '', onClose });
  return (
    <Dialog open onOpenChange={(next) => !next && guard.requestClose()}>
      <DialogContent>
        <DialogTitle>Formulario</DialogTitle>
        <DialogDescription>Descripción</DialogDescription>
        <input aria-label="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="button" onClick={guard.requestClose}>
          Cancelar
        </button>
        <button type="button" onClick={onClose}>
          Guardar
        </button>
        <UnsavedChangesPrompt {...guard.promptProps} />
      </DialogContent>
    </Dialog>
  );
}

const beforeUnload = () => {
  const event = new Event('beforeunload', { cancelable: true });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
};

const escape = () => fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
const clickOutside = async () => {
  const user = userEvent.setup();
  await user.click(document.querySelector('[data-slot="dialog-overlay"]') as Element);
};
const clickX = () => fireEvent.click(screen.getByRole('button', { name: /close|cerrar/i }));

const closers: Array<[string, () => unknown]> = [
  ['Escape', escape],
  ['clic fuera', clickOutside],
  ['la X', clickX],
  ['Cancelar', () => fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))],
];

describe('useDialogDiscardGuard', () => {
  it.each(closers)('sin cambios cierra directo con %s', async (_n, close) => {
    render(<Harness />);
    await close();
    expect(await screen.findByText('cerrado')).toBeInTheDocument();
    expect(screen.queryByText('Tenés cambios sin guardar')).not.toBeInTheDocument();
  });

  it.each(closers)(
    'con cambios, %s abre el aviso y el formulario sigue abierto',
    async (_n, close) => {
      render(<Harness />);
      await userEvent.setup().type(screen.getByLabelText('Nombre'), 'abc');
      await close();
      expect(await screen.findByText('Tenés cambios sin guardar')).toBeInTheDocument();
      expect(screen.getByLabelText('Nombre')).toHaveValue('abc');
    },
  );

  it('Seguir editando conserva los valores', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText('Nombre'), 'abc');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await user.click(await screen.findByRole('button', { name: 'Seguir editando' }));
    expect(screen.queryByText('Tenés cambios sin guardar')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Nombre')).toHaveValue('abc');
  });

  it('Descartar cierra el formulario', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText('Nombre'), 'abc');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await user.click(await screen.findByRole('button', { name: 'Descartar' }));
    expect(await screen.findByText('cerrado')).toBeInTheDocument();
  });

  it('cerrar desde el padre (guardado) no pide confirmación', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText('Nombre'), 'abc');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('cerrado')).toBeInTheDocument();
    expect(screen.queryByText('Tenés cambios sin guardar')).not.toBeInTheDocument();
  });

  it('beforeunload se cancela solo con el diálogo abierto y sucio', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(beforeUnload().defaultPrevented).toBe(false);
    await user.type(screen.getByLabelText('Nombre'), 'a');
    expect(beforeUnload().defaultPrevented).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(beforeUnload().defaultPrevented).toBe(false);
  });
});
