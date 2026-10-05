import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Locale } from '@/shared/i18n/locale';
import type { CuratedProfile } from '@/shared/types/portfolio';
import { metaFromProfile } from './document-meta';

/**
 * add-server-rendered-head: el fragmento del servidor y el cliente derivan los
 * mismos textos. Este test y `profile-head.consistency.spec.ts` (backend) leen el
 * mismo fixture y tienen que llegar al mismo `expected`.
 */
interface Fixture {
  origin: string;
  cases: { locale: Locale; profile: Record<string, unknown>; expected: Record<string, string> }[];
}

const fixture = JSON.parse(
  readFileSync(
    resolve(__dirname, '../../../../docs/fixtures/profile-head-consistency.json'),
    'utf-8',
  ),
) as Fixture;

describe('metaFromProfile frente al fragmento del servidor', () => {
  it.each(fixture.cases)('$profile.slug ($locale)', ({ locale, profile, expected }) => {
    const meta = metaFromProfile(profile as unknown as CuratedProfile, locale, fixture.origin);
    expect({ title: meta.title, description: meta.description, canonical: meta.canonical }).toEqual(
      expected,
    );
  });
});
