import { LazyMotion, domAnimation } from 'motion/react';
import * as motionM from 'motion/react-m';
import type { ComponentProps, ReactNode } from 'react';

export interface AnimatedSectionProps extends Omit<ComponentProps<'section'>, 'children'> {
  children: ReactNode;
  delay: number;
}

/**
 * `<section>` que anima su entrada al aparecer en pantalla. Vive en su propio módulo porque
 * `MotionSection` lo carga en diferido (`React.lazy`): así la librería de animación
 * (`LazyMotion`, `m` y las features `domAnimation`) queda fuera del arranque de la ruta
 * pública (spec `web-performance` § Presupuesto de JS del arranque público).
 */
export default function AnimatedSection({ children, delay, ...props }: AnimatedSectionProps) {
  return (
    <LazyMotion features={domAnimation} strict>
      <motionM.section
        data-motion="on"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.55, ease: 'easeOut', delay }}
        {...(props as ComponentProps<typeof motionM.section>)}
      >
        {children}
      </motionM.section>
    </LazyMotion>
  );
}
