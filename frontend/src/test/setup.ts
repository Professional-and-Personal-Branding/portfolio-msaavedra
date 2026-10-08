import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, expect } from 'vitest';

afterEach(() => {
  cleanup();
});

// Los tests de pantallas del backoffice precargan el chunk lazy del panel. Sin esto, el primer
// render de `/admin/*` de cada archivo paga la importación del chunk y el throttle de Suspense de
// React 19 (300 ms) dentro del timeout del primer `findBy`, y falla con la máquina cargada. Va acá,
// y no en cada archivo, para que una pantalla nueva no tenga que acordarse de hacerlo.
const BACKOFFICE_SCREEN_TEST = /[\\/]features[\\/]backoffice[\\/].+\.test\.tsx$/;

beforeAll(async () => {
  if (!BACKOFFICE_SCREEN_TEST.test(expect.getState().testPath ?? '')) return;
  const { preloadBackoffice } = await import('@/app/lazy-backoffice');
  await preloadBackoffice();
});

// `asyncUtilTimeout` queda en el segundo por defecto a propósito: con la precarga de arriba, un
// `findBy` que tarda más señala un problema real.

// jsdom no implementa matchMedia (lo usa `useReducedMotion` de Motion).
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  });
}

// jsdom no implementa IntersectionObserver (lo usa `whileInView` de Motion).
if (typeof window !== 'undefined' && !('IntersectionObserver' in window)) {
  class IntersectionObserverStub {
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds: readonly number[] = [];
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: IntersectionObserverStub,
  });
}

// jsdom reporta `en-US`; el locale por defecto del producto es `es` (los tests con ?lang=en lo sobreescriben).
Object.defineProperty(window.navigator, 'language', { value: 'es-ES', configurable: true });

// Radix (Select, DropdownMenu) usa APIs de puntero y scroll que jsdom no implementa.
if (typeof Element !== 'undefined') {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => undefined;
  Element.prototype.releasePointerCapture ??= () => undefined;
  Element.prototype.scrollIntoView ??= () => undefined;
}

// jsdom no implementa ResizeObserver (lo usa Radix para medir el Switch y los popovers).
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
