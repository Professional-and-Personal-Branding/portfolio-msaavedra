import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

// `asyncUtilTimeout` queda en el segundo por defecto a propósito: un `findBy` que tarda
// más señala un problema real. Los tests del backoffice precargan el chunk lazy del panel
// en `beforeAll` (`preloadBackoffice`), que era lo que hacía lento el primer test de cada archivo.

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
