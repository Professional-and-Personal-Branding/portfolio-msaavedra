import {
  type ComponentType,
  createElement,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { afterLoadIdle } from '@/shared/lib/after-load-idle';
import type { PreloadableComponent } from '@/shared/lib/lazy-with-preload';

/**
 * Lo que el menú real recibe al montarse tras un intercambio, para seguir como si el módulo
 * hubiera estado desde el principio: `open` es la fuente (disparador) cuya activación quedó
 * pedida antes de la carga, y `focus`, si el disparador provisional tenía el foco.
 */
export interface MenuInit {
  open: string | null;
  focus: boolean;
}

/** Props que `DeferredMenu` agrega al menú real; el menú solo las usa al montarse. */
export interface DeferredMenuInitProps {
  init?: MenuInit;
}

/** Lo que recibe cada disparador provisional (`bind(fuente)`); el llamador agrega los `aria-*`. */
export interface ProvisionalTriggerProps {
  'data-deferred-trigger': string;
  onPointerEnter: () => void;
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onFocus: () => void;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

interface DeferredMenuProps<P extends object> {
  /** Identifica a este menú entre los disparadores provisionales (para detectar su foco). */
  id: string;
  menu: PreloadableComponent<P & DeferredMenuInitProps>;
  menuProps: P;
  /** La vista terminó de revelarse (o llegó a un estado terminal): ya se puede traer el menú. */
  ready: boolean;
  /** Disparadores provisionales, con el mismo marcado que los reales. */
  placeholder: (bind: (source: string) => ProvisionalTriggerProps) => ReactNode;
}

/**
 * Menú de la barra cuyo módulo (Radix `DropdownMenu`/`Sheet` y Floating UI) no viaja en el
 * arranque (D3 de `improve-mobile-performance`). Muestra `placeholder` y carga el módulo:
 *   - en un momento ocioso después de `load`, cuando la vista está lista (`ready`), o
 *   - antes, ante `pointerenter`, `pointerdown` o `focus` sobre un disparador provisional.
 * Un clic, `Enter`/`Espacio` o `ArrowDown` sobre el provisional deja pedida la apertura y el menú
 * real abre al montarse; si el provisional tenía el foco, el disparador real lo recibe en el
 * mismo commit. Si la carga falla, el provisional sigue y la próxima activación reintenta.
 */
export function DeferredMenu<P extends object>({
  id,
  menu,
  menuProps,
  ready,
  placeholder,
}: DeferredMenuProps<P>) {
  const [init, setInit] = useState<MenuInit | null>(() =>
    menu.isLoaded() ? { open: null, focus: false } : null,
  );
  const requested = useRef<string | null>(null);

  const load = useCallback(() => {
    menu.preload().then(
      () => {
        const active = document.activeElement;
        const focus = active instanceof HTMLElement && active.dataset.deferredTrigger === id;
        // Se calcula acá y no dentro del actualizador, que React evalúa más tarde.
        const next: MenuInit = { open: requested.current, focus };
        requested.current = null;
        setInit((current) => current ?? next);
      },
      () => {
        // Chunk inaccesible (por ejemplo, tras un deploy): el provisional sigue y reintenta.
        requested.current = null;
      },
    );
  }, [menu, id]);

  useEffect(() => {
    if (!ready || init) return;
    return afterLoadIdle(load);
  }, [ready, init, load]);

  if (init) {
    return createElement(menu as ComponentType<P & DeferredMenuInitProps>, { ...menuProps, init });
  }

  const request = (source: string) => {
    requested.current = source;
    load();
  };
  const bind = (source: string): ProvisionalTriggerProps => ({
    'data-deferred-trigger': id,
    onPointerEnter: load,
    // Radix abre con el botón principal al presionar; el provisional respeta el mismo gesto.
    onPointerDown: (event) => {
      if (event.button === 0 && !event.ctrlKey) request(source);
      else load();
    },
    onFocus: load,
    onClick: () => request(source),
    onKeyDown: (event) => {
      if (event.key !== 'ArrowDown') return;
      event.preventDefault();
      request(source);
    },
  });
  return <>{placeholder(bind)}</>;
}
