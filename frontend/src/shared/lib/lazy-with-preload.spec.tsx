import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { lazyWithPreload } from './lazy-with-preload';

const Panel = () => <p>panel</p>;

const renderInSuspense = (Component: ReturnType<typeof lazyWithPreload>) =>
  render(
    <Suspense fallback={<p>cargando</p>}>
      <Component />
    </Suspense>,
  );

describe('lazyWithPreload', () => {
  it('sin precarga se comporta como React.lazy: muestra el fallback y luego el componente', async () => {
    const Lazy = lazyWithPreload(() => Promise.resolve({ default: Panel }));

    renderInSuspense(Lazy);

    expect(screen.getByText('cargando')).toBeInTheDocument();
    expect(await screen.findByText('panel')).toBeInTheDocument();
  });

  it('tras preload() renderiza en el primer commit, sin pasar por el fallback', async () => {
    const Lazy = lazyWithPreload(() => Promise.resolve({ default: Panel }));

    await Lazy.preload();
    renderInSuspense(Lazy);

    expect(screen.getByText('panel')).toBeInTheDocument();
    expect(screen.queryByText('cargando')).not.toBeInTheDocument();
  });

  it('pasa las props al componente cargado, con y sin precarga', async () => {
    const Greeting = ({ name }: { name: string }) => <p>hola {name}</p>;
    const Lazy = lazyWithPreload<{ name: string }>(() => Promise.resolve({ default: Greeting }));

    const { unmount } = render(
      <Suspense fallback={<p>cargando</p>}>
        <Lazy name="Ada" />
      </Suspense>,
    );
    expect(await screen.findByText('hola Ada')).toBeInTheDocument();
    unmount();

    await Lazy.preload();
    render(<Lazy name="Grace" />);
    expect(screen.getByText('hola Grace')).toBeInTheDocument();
  });

  it('isLoaded() informa si el módulo ya llegó', async () => {
    const Lazy = lazyWithPreload(() => Promise.resolve({ default: Panel }));

    expect(Lazy.isLoaded()).toBe(false);
    await Lazy.preload();
    expect(Lazy.isLoaded()).toBe(true);
  });

  it('comparte la promesa del módulo: varias precargas piden la fábrica una vez', async () => {
    const factory = vi.fn(() => Promise.resolve({ default: Panel }));
    const Lazy = lazyWithPreload(factory);

    await Promise.all([Lazy.preload(), Lazy.preload(), Lazy.preload()]);

    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('una carga fallida se olvida: la próxima precarga reintenta', async () => {
    const factory = vi
      .fn<() => Promise<{ default: typeof Panel }>>()
      .mockRejectedValueOnce(new Error('chunk inaccesible'))
      .mockResolvedValue({ default: Panel });
    const Lazy = lazyWithPreload(factory);

    await expect(Lazy.preload()).rejects.toThrow('chunk inaccesible');
    expect(Lazy.isLoaded()).toBe(false);
    await Lazy.preload();

    expect(factory).toHaveBeenCalledTimes(2);
    expect(Lazy.isLoaded()).toBe(true);
  });
});
