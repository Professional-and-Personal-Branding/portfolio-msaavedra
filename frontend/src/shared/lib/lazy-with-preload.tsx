import { type ComponentType, lazy, useState } from 'react';

export type PreloadableComponent = ComponentType & { preload: () => Promise<void> };

/**
 * `React.lazy` con `preload()`. Un `lazy` siempre suspende en su primer render, aunque
 * el módulo ya esté cargado, y React retiene el contenido hasta 300 ms después de mostrar
 * el fallback. Si `preload()` terminó antes de montar, se renderiza el componente cargado
 * directamente: sin Suspense ni espera. La elección se fija al montar, así una precarga que
 * termina después no cambia el tipo del elemento ni remonta el árbol.
 */
export function lazyWithPreload(
  factory: () => Promise<{ default: ComponentType }>,
): PreloadableComponent {
  let loaded: ComponentType | undefined;
  const load = () =>
    factory().then((module) => {
      loaded = module.default;
      return module;
    });
  const Lazy = lazy(load);

  function Preloadable() {
    const [Component] = useState<ComponentType>(() => loaded ?? Lazy);
    return <Component />;
  }

  return Object.assign(Preloadable, {
    preload: async () => {
      await load();
    },
  });
}
