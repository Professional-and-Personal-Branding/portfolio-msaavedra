import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { lazyWithPreload } from '@/shared/lib/lazy-with-preload';
import { makeCuratedProfileList } from '@/test/fixtures/curated-profile';
import { API, http, HttpResponse, server } from '@/test/msw';
import { renderWithProviders } from '@/test/render';
import { ThemeProvider } from '@/themes/theme-provider';
import { DeferredMenu, type DeferredMenuInitProps } from './DeferredMenu';
import { MobileMenuTrigger, ProfilesTrigger, ThemeTrigger } from './menu-triggers';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Promesa que el test resuelve o rechaza a mano. */
function deferred() {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Un módulo de menú cuya llegada controla el test: `release()` lo resuelve, `fail()` lo rechaza. */
function controlledModule<P extends object>(
  load: () => Promise<{ default: React.ComponentType<P> }>,
) {
  let attempts = 0;
  let gate = deferred();
  const factory = vi.fn(async () => {
    attempts += 1;
    await gate.promise;
    return load();
  });
  return {
    menu: lazyWithPreload<P>(factory),
    factory,
    attempts: () => attempts,
    release: () => gate.resolve(),
    fail: () => {
      gate.reject(new Error('chunk inaccesible'));
      gate = deferred();
    },
  };
}

const themeModule = () =>
  controlledModule<DeferredMenuInitProps>(() =>
    import('./ThemeSwitcher').then((m) => ({ default: m.ThemeSwitcher })),
  );

function renderTheme(module: ReturnType<typeof themeModule>, ready = false) {
  return renderWithProviders(
    <ThemeProvider>
      <DeferredMenu
        id="theme"
        menu={module.menu}
        menuProps={{}}
        ready={ready}
        placeholder={(bind) => (
          <ThemeTrigger aria-haspopup="menu" aria-expanded={false} {...bind('theme')} />
        )}
      />
    </ThemeProvider>,
  );
}

/** Los atributos accesibles que el visitante percibe en un disparador. */
function accessibleAttributes(element: HTMLElement) {
  return {
    name: element.getAttribute('aria-label') ?? element.textContent,
    title: element.getAttribute('title'),
    haspopup: element.getAttribute('aria-haspopup'),
    expanded: element.getAttribute('aria-expanded'),
    className: element.className,
    size: element.dataset.size,
  };
}

// D3 de `improve-mobile-performance`.
describe('DeferredMenu — selector de tema', () => {
  it('el disparador provisional y el real tienen los mismos atributos accesibles', async () => {
    const module = themeModule();
    const user = userEvent.setup();
    renderTheme(module);

    const provisional = screen.getByRole('button', { name: 'Tema' });
    const before = accessibleAttributes(provisional);
    expect(before).toMatchObject({ haspopup: 'menu', expanded: 'false', title: 'Tema' });

    await user.hover(provisional); // intención: empieza a cargar
    module.release();
    await waitFor(() => expect(provisional).not.toBeInTheDocument());

    const real = screen.getByRole('button', { name: 'Tema' });
    expect(accessibleAttributes(real)).toEqual(before);
  });

  it('no carga el módulo sin intención ni momento ocioso', async () => {
    const module = themeModule();
    renderTheme(module);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(module.factory).not.toHaveBeenCalled();
  });

  it('con la vista lista, carga en un momento ocioso tras load, sin interacción', async () => {
    const module = themeModule();
    renderTheme(module, true);

    await waitFor(() => expect(module.factory).toHaveBeenCalledTimes(1));
    module.release();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Tema' })).not.toHaveAttribute(
        'data-deferred-trigger',
      ),
    );
  });

  it.each([
    ['pointerenter', (user: ReturnType<typeof userEvent.setup>, el: HTMLElement) => user.hover(el)],
    ['focus', async (_user: ReturnType<typeof userEvent.setup>, el: HTMLElement) => el.focus()],
  ])('%s sobre el disparador pide el módulo, una sola vez', async (_name, act) => {
    const module = themeModule();
    const user = userEvent.setup();
    renderTheme(module);

    const trigger = screen.getByRole('button', { name: 'Tema' });
    await act(user, trigger);
    await act(user, trigger);

    expect(module.factory).toHaveBeenCalledTimes(1);
  });

  it('el foco del disparador provisional pasa al real, sin quedar en body', async () => {
    const module = themeModule();
    renderTheme(module);
    const provisional = screen.getByRole('button', { name: 'Tema' });
    provisional.focus(); // el foco también pide el módulo
    expect(provisional).toHaveFocus();

    module.release();
    await waitFor(() => expect(provisional).not.toBeInTheDocument());

    const real = screen.getByRole('button', { name: 'Tema' });
    expect(real).toHaveFocus();
    expect(document.body).not.toHaveFocus();
  });

  it('sin foco en el provisional, el real no lo roba', async () => {
    const module = themeModule();
    const user = userEvent.setup();
    renderTheme(module);
    await user.hover(screen.getByRole('button', { name: 'Tema' }));

    module.release();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Tema' })).not.toHaveAttribute(
        'data-deferred-trigger',
      ),
    );
    expect(screen.getByRole('button', { name: 'Tema' })).not.toHaveFocus();
  });

  it('Enter sobre el provisional antes de la carga abre el menú al cargar, con el foco dentro; Escape lo devuelve al disparador', async () => {
    const module = themeModule();
    const user = userEvent.setup();
    renderTheme(module);
    screen.getByRole('button', { name: 'Tema' }).focus();

    await user.keyboard('{Enter}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    module.release();

    const menu = await screen.findByRole('menu');
    await waitFor(() => expect(menu).toContainElement(document.activeElement as HTMLElement));

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Tema' })).toHaveFocus();
  });

  it('ArrowDown y el clic también dejan pedida la apertura', async () => {
    for (const activate of ['arrow', 'click'] as const) {
      const module = themeModule();
      const user = userEvent.setup();
      const { unmount } = renderTheme(module);
      const trigger = screen.getByRole('button', { name: 'Tema' });

      if (activate === 'arrow') {
        trigger.focus();
        await user.keyboard('{ArrowDown}');
      } else {
        await user.click(trigger);
      }
      module.release();

      expect(await screen.findByRole('menu')).toBeInTheDocument();
      unmount();
    }
  });

  it('si la carga falla, el provisional sigue y la próxima activación reintenta', async () => {
    const module = themeModule();
    const user = userEvent.setup();
    renderTheme(module);
    const trigger = screen.getByRole('button', { name: 'Tema' });

    await user.hover(trigger);
    module.fail();
    await waitFor(() => expect(module.attempts()).toBe(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    // Sigue el provisional y no hay estado de error.
    expect(trigger).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await user.click(trigger);
    await waitFor(() => expect(module.attempts()).toBe(2));
    module.release();

    expect(await screen.findByRole('menu')).toBeInTheDocument();
  });
});

describe('DeferredMenu — menú de perfiles (escritorio y móvil)', () => {
  function renderProfiles(module: ReturnType<typeof profilesModule>) {
    server.use(
      http.get(`${API}/curated-profiles`, () => HttpResponse.json(makeCuratedProfileList())),
    );
    return renderWithProviders(
      <ThemeProvider>
        <DeferredMenu
          id="profiles"
          menu={module.menu}
          menuProps={{ activeSlug: 'all' }}
          ready={false}
          placeholder={(bind) => (
            <>
              <div className="hidden md:block">
                <ProfilesTrigger aria-haspopup="menu" aria-expanded={false} {...bind('desktop')} />
              </div>
              <div className="md:hidden">
                <MobileMenuTrigger
                  aria-haspopup="dialog"
                  aria-expanded={false}
                  {...bind('mobile')}
                />
              </div>
            </>
          )}
        />
      </ThemeProvider>,
    );
  }
  const profilesModule = () =>
    controlledModule<DeferredMenuInitProps & { activeSlug: string }>(() =>
      import('./ProfileMenu').then((m) => ({ default: m.ProfileMenu })),
    );

  it('los dos disparadores provisionales coinciden con los reales', async () => {
    const module = profilesModule();
    const user = userEvent.setup();
    renderProfiles(module);
    const desktop = accessibleAttributes(screen.getByRole('button', { name: 'Perfiles' }));
    const mobile = accessibleAttributes(screen.getByRole('button', { name: 'Abrir menú' }));

    await user.hover(screen.getByRole('button', { name: 'Perfiles' }));
    module.release();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Perfiles' })).not.toHaveAttribute(
        'data-deferred-trigger',
      ),
    );

    expect(accessibleAttributes(screen.getByRole('button', { name: 'Perfiles' }))).toEqual(desktop);
    expect(accessibleAttributes(screen.getByRole('button', { name: 'Abrir menú' }))).toEqual(
      mobile,
    );
  });

  it('el clic en el disparador de escritorio abre el menú al cargar', async () => {
    const module = profilesModule();
    const user = userEvent.setup();
    renderProfiles(module);

    await user.click(screen.getByRole('button', { name: 'Perfiles' }));
    module.release();

    const menu = await screen.findByRole('menu');
    expect(await within(menu).findAllByRole('link', { name: /Perfil/ })).not.toHaveLength(0);
  });

  it('Enter en el disparador de móvil abre el Sheet al cargar y Escape devuelve el foco', async () => {
    const module = profilesModule();
    const user = userEvent.setup();
    renderProfiles(module);
    screen.getByRole('button', { name: 'Abrir menú' }).focus();

    await user.keyboard('{Enter}');
    module.release();

    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveFocus();
  });
});
