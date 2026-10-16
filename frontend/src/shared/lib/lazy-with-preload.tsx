import { type ComponentType, createElement, lazy, useState } from 'react';

export type PreloadableComponent<P extends object = object> = ComponentType<P> & {
  /** Pide el módulo (una sola vez; si falla, la próxima llamada reintenta). */
  preload: () => Promise<void>;
  /** El módulo ya llegó: renderizar el componente no suspende. */
  isLoaded: () => boolean;
};

/**
 * `React.lazy` con `preload()`. Un `lazy` siempre suspende en su primer render, aunque
 * el módulo ya esté cargado, y React retiene el contenido hasta 300 ms después de mostrar
 * el fallback. Si `preload()` terminó antes de montar, se renderiza el componente cargado
 * directamente: sin Suspense ni espera. La elección se fija al montar, así una precarga que
 * termina después no cambia el tipo del elemento ni remonta el árbol.
 *
 * La promesa del módulo se comparte: `preload()` y el `lazy` piden `factory` una sola vez, y una
 * carga fallida se olvida para que la próxima llamada vuelva a intentarla.
 */
export function lazyWithPreload<P extends object = object>(
  factory: () => Promise<{ default: ComponentType<P> }>,
): PreloadableComponent<P> {
  let loaded: ComponentType<P> | undefined;
  let pending: Promise<{ default: ComponentType<P> }> | undefined;
  const load = () => {
    pending ??= factory().then(
      (module) => {
        loaded = module.default;
        return module;
      },
      (error: unknown) => {
        pending = undefined;
        throw error;
      },
    );
    return pending;
  };
  const Lazy: ComponentType<P> = lazy(load) as unknown as ComponentType<P>;

  function Preloadable(props: P) {
    const [Component] = useState<ComponentType<P>>(() => loaded ?? Lazy);
    return createElement(Component, props);
  }

  return Object.assign(Preloadable, {
    preload: async () => {
      await load();
    },
    isLoaded: () => loaded !== undefined,
  });
}
