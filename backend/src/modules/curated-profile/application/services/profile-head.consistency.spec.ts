import * as fs from 'fs';
import * as path from 'path';
import { Locale } from '../../../../shared/domain/i18n';
import { CuratedProfileOutput } from '../dto/curated-profile.output';
import { headMetaFromProfile, renderProfileHead } from './profile-head.renderer';

/**
 * add-server-rendered-head: el fragmento y el cliente derivan los mismos textos.
 * Este test y `frontend/src/shared/lib/document-meta.consistency.spec.ts` leen
 * el mismo fixture y tienen que llegar al mismo `expected`.
 */
interface Fixture {
  origin: string;
  cases: { locale: Locale; profile: Record<string, unknown>; expected: Record<string, string> }[];
}

const fixture = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../../../../../docs/fixtures/profile-head-consistency.json'),
    'utf-8',
  ),
) as Fixture;

const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

describe('fragmento de head frente a metaFromProfile del cliente', () => {
  it.each(fixture.cases)('$profile.slug ($locale)', ({ locale, profile, expected }) => {
    const data = profile as unknown as CuratedProfileOutput;
    const meta = headMetaFromProfile(data, locale, fixture.origin);
    expect({ title: meta.title, description: meta.description, canonical: meta.canonical }).toEqual(
      expected,
    );

    const html = renderProfileHead(meta, fixture.origin);
    expect(html).toContain(`<title>${escape(expected.title)}</title>`);
    expect(html).toContain(`<link rel="canonical" href="${expected.canonical}" />`);
  });
});
