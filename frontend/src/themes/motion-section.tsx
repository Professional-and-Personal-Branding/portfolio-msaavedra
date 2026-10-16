import { useEffect, useRef, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import { ENTERED_ATTRIBUTE } from './motion-attributes';
import { useTheme } from './use-theme';

interface MotionSectionProps extends Omit<ComponentProps<'section'>, 'children'> {
  children: ReactNode;
  /** Retardo en segundos (para escalonar tarjetas). */
  delay?: number;
}

/**
 * `content-visibility: auto`: el navegador no hace *layout* ni *paint* de las secciones fuera de
 * pantalla (el costo de crear y medir el DOM del perfil pasa a ser el del primer pliegue). El
 * `auto` del tamaño intrínseco recuerda la altura real ya renderizada, así la barra de
 * desplazamiento se estabiliza. El hero no usa `MotionSection`: es el LCP.
 */
const OFFSCREEN_SKIP = '[content-visibility:auto] [contain-intrinsic-size:auto_640px]';

/**
 * `<section>` con animación de entrada solo si el tema la habilita y el
 * visitante no pidió `prefers-reduced-motion` (spec `runtime-theming`).
 *
 * Es siempre la misma `<section>` (D7 de `improve-mobile-performance`): la librería de animación
 * llega en diferido (`entrance-animation`) y anima el nodo existente, sin `Suspense` ni remontaje.
 * Con animaciones activas la sección espera oculta (CSS) hasta entrar en pantalla; si el módulo
 * no carga, queda visible.
 */
export function MotionSection({ children, delay = 0, className, ...props }: MotionSectionProps) {
  const { animationsEnabled } = useTheme();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!animationsEnabled || !element || element.hasAttribute(ENTERED_ATTRIBUTE)) return;
    let cancelled = false;
    let stop: (() => void) | undefined;
    import('./entrance-animation')
      .then(({ animateOnEnter }) => {
        if (!cancelled) stop = animateOnEnter(element, delay);
      })
      // Módulo inaccesible (o la animación no arranca): la sección no puede quedar oculta.
      .catch(() => element.setAttribute(ENTERED_ATTRIBUTE, ''));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [animationsEnabled, delay]);

  return (
    <section
      ref={ref}
      data-motion={animationsEnabled ? 'on' : 'off'}
      className={cn(OFFSCREEN_SKIP, className)}
      {...props}
    >
      {children}
    </section>
  );
}
