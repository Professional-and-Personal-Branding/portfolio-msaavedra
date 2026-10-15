import { lazy, Suspense, type ComponentProps, type ReactNode } from 'react';
import { useTheme } from './use-theme';

interface MotionSectionProps extends Omit<ComponentProps<'section'>, 'children'> {
  children: ReactNode;
  /** Retardo en segundos (para escalonar tarjetas). */
  delay?: number;
}

/** La librería de animación sale del arranque: se pide cuando hay una sección que animar. */
const AnimatedSection = lazy(() => import('./animated-section'));

/** Estado inicial de la animación (el mismo de `AnimatedSection`): la sección espera oculta. */
const WAITING_STYLE = { opacity: 0, transform: 'translateY(20px)' } as const;

/**
 * `<section>` con animación de entrada solo si el tema la habilita y el
 * visitante no pidió `prefers-reduced-motion` (spec `runtime-theming`).
 * Mientras llega la librería de animación (`LazyMotion`, en diferido) la sección se muestra
 * en su estado inicial, que es el mismo en el que espera antes de entrar en pantalla.
 */
export function MotionSection({ children, delay = 0, ...props }: MotionSectionProps) {
  const { animationsEnabled } = useTheme();
  if (!animationsEnabled) {
    return (
      <section data-motion="off" {...props}>
        {children}
      </section>
    );
  }
  return (
    <Suspense
      fallback={
        <section data-motion="on" {...props} style={{ ...WAITING_STYLE, ...props.style }}>
          {children}
        </section>
      }
    >
      <AnimatedSection delay={delay} {...props}>
        {children}
      </AnimatedSection>
    </Suspense>
  );
}
