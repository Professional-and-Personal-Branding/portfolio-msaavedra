import { inView } from 'motion';
import { animate } from 'motion/mini';
import { ENTERED_ATTRIBUTE } from './motion-attributes';

/** Duración de la entrada, en segundos (la misma de la animación anterior). */
export const ENTRANCE_DURATION = 0.55;

/**
 * Anima la entrada de `element` la primera vez que aparece en pantalla (D7 de
 * `improve-mobile-performance`): opacidad y desplazamiento, con la API *vanilla* de Motion sobre
 * el mismo nodo, sin remontar su contenido. El estado inicial (oculto) lo declara `theme.css`
 * para `[data-motion='on']:not([data-motion-entered])`; al terminar se marca `data-motion-entered`
 * y se limpian los estilos en línea que deja la animación, así un re-render no la vuelve a ocultar.
 * Devuelve cómo dejar de observar (no cancela una animación ya empezada).
 */
export function animateOnEnter(element: HTMLElement, delay: number): () => void {
  let started = false;
  const stop = inView(
    element,
    () => {
      if (started) return;
      started = true;
      stop();
      const markEntered = () => {
        element.style.removeProperty('opacity');
        element.style.removeProperty('transform');
        element.setAttribute(ENTERED_ATTRIBUTE, '');
      };
      animate(
        element,
        { opacity: [0, 1], transform: ['translateY(20px)', 'translateY(0px)'] },
        { duration: ENTRANCE_DURATION, ease: 'easeOut', delay },
      ).finished.then(markEntered, markEntered);
    },
    { margin: '-40px' },
  );
  return stop;
}
