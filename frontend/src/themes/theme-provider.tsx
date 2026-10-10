import { useEffect, useMemo, type CSSProperties, type ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';
import { cn } from '@/shared/lib/utils';
import { tokensToCssVars } from './css-vars';
import { ensureFontLoaded } from './fonts';
import { findPreset } from './presets';
import { parseThemeTokens } from './tokens';

import { ThemeContext, type ThemeContextValue } from './theme-context';

export interface ThemeProviderProps {
  /** `theme.tokens` del perfil curado (JSON de la API, puede ser parcial o null). */
  profileTokens?: unknown;
  /** Slug del preset elegido (`?theme=`); un slug desconocido se ignora. */
  presetSlug?: string | null;
  className?: string;
  children: ReactNode;
}

/**
 * Convierte tokens en CSS variables sobre el contenedor raíz (no sobre
 * `document.documentElement`, para que varios previews convivan en Fase 5).
 * Precedencia: preset elegido > tema del perfil > `modern-dark`.
 */
export function ThemeProvider({
  profileTokens,
  presetSlug,
  className,
  children,
}: ThemeProviderProps) {
  const reducedMotion = useReducedMotion() ?? false;

  const { tokens, preset, source } = useMemo(() => {
    const chosen = findPreset(presetSlug) ?? null;
    if (chosen) return { tokens: chosen.tokens, preset: chosen, source: 'preset' as const };
    const hasProfileTokens = profileTokens !== null && profileTokens !== undefined;
    return {
      tokens: parseThemeTokens(profileTokens),
      preset: null,
      source: hasProfileTokens ? ('profile' as const) : ('default' as const),
    };
  }, [presetSlug, profileTokens]);

  const cssVars = useMemo(() => tokensToCssVars(tokens), [tokens]);

  useEffect(() => {
    ensureFontLoaded(tokens.typography.fontSans);
    ensureFontLoaded(tokens.typography.fontHeading);
  }, [tokens.typography.fontSans, tokens.typography.fontHeading]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      tokens,
      preset,
      source,
      animationsEnabled: tokens.effects.animations && !reducedMotion,
    }),
    [tokens, preset, source, reducedMotion],
  );

  const style: CSSProperties = { ...cssVars, colorScheme: tokens.mode };

  return (
    <ThemeContext.Provider value={value}>
      <div
        data-theme={preset?.slug ?? source}
        data-mode={tokens.mode}
        className={cn(
          'min-h-screen bg-bg font-sans text-text print:min-h-0 print:bg-transparent',
          tokens.mode === 'dark' && 'dark',
          className,
        )}
        style={style}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
