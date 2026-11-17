import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Table, TableBody, TableCell, TableRow } from './table';

const fila = (
  <TableBody>
    <TableRow>
      <TableCell>dato</TableCell>
    </TableRow>
  </TableBody>
);

describe('Table', () => {
  it('sin regionLabel el contenedor queda como antes: sin role, aria-label ni tabindex', () => {
    const { container } = render(<Table>{fila}</Table>);

    const contenedor = container.querySelector('[data-slot="table-container"]');
    expect(contenedor).not.toBeNull();
    expect(contenedor).not.toHaveAttribute('role');
    expect(contenedor).not.toHaveAttribute('aria-label');
    expect(contenedor).not.toHaveAttribute('tabindex');
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('con regionLabel el contenedor es una región con nombre y foco', () => {
    render(<Table regionLabel="Visitas por enlace">{fila}</Table>);

    const region = screen.getByRole('region', { name: 'Visitas por enlace' });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region).toHaveAttribute('data-slot', 'table-container');
  });
});
