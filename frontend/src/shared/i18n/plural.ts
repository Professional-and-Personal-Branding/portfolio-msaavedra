import type { Locale } from './locale';

/** Formas de un sustantivo contable: singular (`one`) y plural (`other`). */
export interface PluralForms {
  readonly one: string;
  readonly other: string;
}

/**
 * «{n} {sustantivo}» con la forma que corresponde al número, según las reglas del idioma
 * (`Intl.PluralRules`). En español y en inglés solo el 1 es `one`: el 0 va en plural.
 * Las formas las pone quien llama; el diccionario público (`messages.ts`) no se usa acá para no
 * cargar el arranque del sitio con textos del panel (change polish-views-updated-at-and-builder, D5).
 */
export function formatCount(count: number, forms: PluralForms, locale: Locale = 'es'): string {
  const form = new Intl.PluralRules(locale).select(count) === 'one' ? forms.one : forms.other;
  return `${count} ${form}`;
}
