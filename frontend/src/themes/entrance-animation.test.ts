import { beforeEach, describe, expect, it, vi } from 'vitest';

type EnterCallback = (element: Element) => void;

const inViewMock =
  vi.fn<(element: Element, onEnter: EnterCallback, options: object) => () => void>();
const animateMock = vi.fn<(element: Element, keyframes: object, options: object) => unknown>();

vi.mock('motion', () => ({ inView: inViewMock }));
vi.mock('motion/mini', () => ({ animate: animateMock }));

const { animateOnEnter } = await import('./entrance-animation');

describe('animateOnEnter', () => {
  let stop: ReturnType<typeof vi.fn>;
  let enter: EnterCallback;
  let finish: () => void;
  let element: HTMLElement;

  beforeEach(() => {
    stop = vi.fn();
    inViewMock.mockReset();
    inViewMock.mockImplementation((_element, onEnter) => {
      enter = onEnter;
      return stop as () => void;
    });
    animateMock.mockReset();
    animateMock.mockImplementation(() => ({
      finished: new Promise<void>((resolve) => {
        finish = resolve;
      }),
    }));
    element = document.createElement('section');
  });

  it('observa la sección con el margen de siempre y devuelve cómo dejar de observar', () => {
    const cancel = animateOnEnter(element, 0.2);

    expect(inViewMock).toHaveBeenCalledWith(element, expect.any(Function), { margin: '-40px' });
    expect(cancel).toBe(stop);
    expect(animateMock).not.toHaveBeenCalled();
  });

  it('al entrar en pantalla anima opacidad y desplazamiento con el delay recibido, una sola vez', () => {
    animateOnEnter(element, 0.2);

    enter(element);
    enter(element);

    expect(animateMock).toHaveBeenCalledTimes(1);
    expect(animateMock).toHaveBeenCalledWith(
      element,
      { opacity: [0, 1], transform: ['translateY(20px)', 'translateY(0px)'] },
      { duration: 0.55, ease: 'easeOut', delay: 0.2 },
    );
    // Deja de observar apenas arranca: no se anima otra vez al volver a entrar.
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('al terminar marca la sección como vista y limpia los estilos en línea', async () => {
    element.style.opacity = '1';
    element.style.transform = 'translateY(0px)';
    animateOnEnter(element, 0);
    enter(element);
    expect(element).not.toHaveAttribute('data-motion-entered');

    finish();
    await vi.waitFor(() => expect(element).toHaveAttribute('data-motion-entered'));

    expect(element.style.opacity).toBe('');
    expect(element.style.transform).toBe('');
  });
});
