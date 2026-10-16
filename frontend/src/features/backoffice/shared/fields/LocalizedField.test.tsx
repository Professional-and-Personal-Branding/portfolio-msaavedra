import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { LocalizedText } from '../admin-types';
import { LocalizedField } from './LocalizedField';

function Harness({
  initial,
  onChange,
}: {
  initial?: LocalizedText;
  onChange?: (value: LocalizedText) => void;
}) {
  const [value, setValue] = useState<LocalizedText | undefined>(initial);
  return (
    <LocalizedField
      label="Título"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

// improve-a11y-and-performance (D6): cada pestaña controla un panel que existe en el DOM.
describe('LocalizedField', () => {
  it('cada aria-controls de las pestañas apunta a un panel presente', () => {
    render(<Harness initial={{ es: 'Hola', en: 'Hello' }} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    for (const tab of tabs) {
      const target = tab.getAttribute('aria-controls');
      expect(target).toBeTruthy();
      const panel = document.getElementById(target ?? '');
      expect(panel).not.toBeNull();
      expect(panel).toHaveAttribute('role', 'tabpanel');
    }
  });

  it('solo el panel activo es visible y conserva el valor de cada idioma', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ es: 'Hola', en: 'Hello' }} />);

    expect(screen.getByRole('textbox', { name: 'Título (es)' })).toHaveValue('Hola');
    expect(screen.queryByRole('textbox', { name: 'Título (en)' })).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'en' }));
    expect(screen.getByRole('textbox', { name: 'Título (en)' })).toHaveValue('Hello');
    expect(screen.queryByRole('textbox', { name: 'Título (es)' })).toBeNull();
    // La etiqueta sigue al control activo.
    expect(screen.getByLabelText('Título', { selector: 'input:not([hidden])' })).toHaveValue(
      'Hello',
    );
  });

  it('editar en inglés conserva el español y cambiar de pestaña no emite cambios', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={{ es: 'Hola' }} onChange={onChange} />);

    await user.click(screen.getByRole('tab', { name: 'en' }));
    await user.click(screen.getByRole('tab', { name: 'es' }));
    expect(onChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole('tab', { name: 'en' }));
    await user.type(screen.getByRole('textbox', { name: 'Título (en)' }), 'Hi');
    expect(onChange).toHaveBeenLastCalledWith({ es: 'Hola', en: 'Hi' });
  });
});
