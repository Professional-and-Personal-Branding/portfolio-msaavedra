import { motion } from 'motion/react';
import type { ComponentProps, ReactNode } from 'react';
import { useTheme } from './use-theme';

interface MotionSectionProps extends Omit<ComponentProps<'section'>, 'children'> {
  children: ReactNode;
  /** Retardo en segundos (para escalonar tarjetas). */
  delay?: number;
}

/**
 * `<section>` con animación de entrada solo si el tema la habilita y el
 * visitante no pidió `prefers-reduced-motion` (spec `runtime-theming`).
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
    <motion.section
      data-motion="on"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.55, ease: 'easeOut', delay }}
      {...(props as ComponentProps<typeof motion.section>)}
    >
      {children}
    </motion.section>
  );
}
