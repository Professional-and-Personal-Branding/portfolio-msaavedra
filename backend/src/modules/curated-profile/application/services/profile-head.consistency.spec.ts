import * as fs from 'fs';
import * as path from 'path';
import { Locale } from '../../../../shared/domain/i18n';
import { CuratedProfileOutput } from '../dto/curated-profile.output';
import { headMetaFromProfile, renderProfileHead } from './profile-head.renderer';

/**
 * add-server-rendered-head y upgrade-profile-structured-data: el fragmento y el
 * cliente derivan los mismos textos y el mismo JSON-LD. Este test y
 * `frontend/src/shared/lib/document-meta.consistency.spec.ts` leen el mismo
 * fixture, que es el snapshot versionado, y tienen que llegar al mismo `expected`.
 */
interface Expected {
  title: string;
  description: string;
  canonical: string;
  jsonLd?: Record<string, unknown>;
}

interface Fixture {
  origin: string;
  cases: { locale: Locale; profile: Record<string, unknown>; expected: Expected }[];
}

const fixture = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../../../../../docs/fixtures/profile-head-consistency.json'),
    'utf-8',
  ),
) as Fixture;

const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const SCRIPT = /<script type="application\/ld\+json">(.*?)<\/script>/s;

describe('fragmento de head frente a metaFromProfile del cliente', () => {
  it.each(fixture.cases)('$profile.slug ($locale)', ({ locale, profile, expected }) => {
    const data = profile as unknown as CuratedProfileOutput;
    const meta = headMetaFromProfile(data, locale, fixture.origin);
    expect({ title: meta.title, description: meta.description, canonical: meta.canonical }).toEqual(
      {
        title: expected.title,
        description: expected.description,
        canonical: expected.canonical,
      },
    );

    const html = renderProfileHead(meta, fixture.origin);
    expect(html).toContain(`<title>${escape(expected.title)}</title>`);
    expect(html).toContain(`<link rel="canonical" href="${expected.canonical}" />`);

    // JSON-LD: igualdad profunda y serialización idéntica (también cuenta el orden de las claves).
    if (expected.jsonLd) {
      expect(meta.jsonLd).toEqual(expected.jsonLd);
      expect(JSON.stringify(meta.jsonLd)).toBe(JSON.stringify(expected.jsonLd));
      const embedded = SCRIPT.exec(html)?.[1];
      expect(embedded).toBeDefined();
      expect(JSON.parse(embedded ?? '')).toEqual(expected.jsonLd);
    } else {
      expect(meta.jsonLd).toBeUndefined();
      expect(html).not.toContain('application/ld+json');
    }
  });
});
