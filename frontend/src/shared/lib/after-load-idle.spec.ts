import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { afterLoadIdle } from './after-load-idle';

function setReadyState(state: DocumentReadyState) {
  Object.defineProperty(document, 'readyState', { value: state, configurable: true });
}

describe('afterLoadIdle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(document, 'readyState');
  });

  it('con el documento cargado y sin requestIdleCallback, usa setTimeout', () => {
    setReadyState('complete');
    const callback = vi.fn();

    afterLoadIdle(callback);
    expect(callback).not.toHaveBeenCalled();
    vi.runAllTimers();

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('con el documento cargando, espera al evento load', () => {
    setReadyState('loading');
    const callback = vi.fn();

    afterLoadIdle(callback);
    vi.runAllTimers();
    expect(callback).not.toHaveBeenCalled();

    window.dispatchEvent(new Event('load'));
    vi.runAllTimers();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('usa requestIdleCallback con el tope indicado cuando existe', () => {
    setReadyState('complete');
    const request = vi.fn((cb: () => void) => {
      cb();
      return 7;
    });
    vi.stubGlobal('requestIdleCallback', request);
    window.requestIdleCallback = request as unknown as typeof window.requestIdleCallback;
    const callback = vi.fn();

    afterLoadIdle(callback, 1500);

    expect(request).toHaveBeenCalledWith(callback, { timeout: 1500 });
    expect(callback).toHaveBeenCalledTimes(1);
    Reflect.deleteProperty(window, 'requestIdleCallback');
  });

  it('cancelar antes de que ocurra evita la llamada', () => {
    setReadyState('loading');
    const callback = vi.fn();

    const cancel = afterLoadIdle(callback);
    cancel();
    window.dispatchEvent(new Event('load'));
    vi.runAllTimers();

    expect(callback).not.toHaveBeenCalled();
  });
});
