import { describe, expect, it } from 'vitest';
import { detectLocale, isLocale } from './locale';
import { messages, translate, type MessageKey } from './messages';

describe('translate', () => {
  it('devuelve la traducción del locale', () => {
    expect(translate('es', 'section.experience.title')).toBe('Experiencia Profesional');
    expect(translate('en', 'section.experience.title')).toBe('Professional Experience');
  });

  it('cae a es cuando falta la traducción', () => {
    const key = 'clave.inventada' as MessageKey;
    const original = messages.en[key];
    messages.es[key] = 'Texto en español';
    delete messages.en[key];

    expect(translate('en', key)).toBe('Texto en español');

    delete messages.es[key];
    if (original !== undefined) messages.en[key] = original;
  });

  it('en cubre todas las claves de es (sin huecos accidentales)', () => {
    const missing = Object.keys(messages.es).filter((k) => !(k in messages.en));
    expect(missing).toEqual([]);
  });
});

describe('detectLocale', () => {
  it('en-US → en; es-BO → es; vacío → es', () => {
    expect(detectLocale('en-US')).toBe('en');
    expect(detectLocale('EN')).toBe('en');
    expect(detectLocale('es-BO')).toBe('es');
    expect(detectLocale('pt-BR')).toBe('es');
    expect(detectLocale(undefined)).toBe('es');
  });
});

describe('isLocale', () => {
  it('acepta solo es/en', () => {
    expect(isLocale('es')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(isLocale(null)).toBe(false);
  });
});
