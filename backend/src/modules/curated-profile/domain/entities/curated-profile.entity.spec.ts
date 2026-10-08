import { AccessToken } from '../value-objects/access-token.vo';
import { CuratedProfile, CuratedProfileProps } from './curated-profile.entity';

const BASE: CuratedProfileProps = {
  id: 'cp1',
  slug: 'acme-lead',
  title: { es: 'T' },
  headline: { es: 'H' },
  description: null,
  roleType: null,
  techFocus: null,
  filterTags: [],
  includeIds: [],
  excludeIds: [],
  accentColor: '#000000',
  themeId: null,
  themeOverrides: null,
  layout: 'classic',
  sectionsOrder: [],
  sectionsHidden: [],
  visibility: 'PUBLIC',
  accessToken: AccessToken.none(),
  views: 0,
};

describe('CuratedProfile — ciclo de vida', () => {
  it('sin archivedAt ni listed: no archivado y enumerado', () => {
    const cp = CuratedProfile.create(BASE);
    expect(cp.archivedAt).toBeNull();
    expect(cp.isArchived).toBe(false);
    expect(cp.listed).toBe(true);
  });

  it('with() acepta archivedAt y listed sin tocar lo demás', () => {
    const fecha = new Date('2026-10-05T12:00:00Z');
    const cp = CuratedProfile.create(BASE).with({ archivedAt: fecha, listed: false });
    expect(cp.archivedAt).toEqual(fecha);
    expect(cp.isArchived).toBe(true);
    expect(cp.listed).toBe(false);
    expect(cp.slug).toBe('acme-lead');
    expect(cp.visibility).toBe('PUBLIC');
  });

  it('un archivado no es accesible ni con visibilidad PUBLIC', () => {
    const cp = CuratedProfile.create({ ...BASE, archivedAt: new Date() });
    expect(cp.canAccess(null)).toBe(false);
  });

  it('listed no altera el acceso', () => {
    expect(CuratedProfile.create({ ...BASE, listed: false }).canAccess(null)).toBe(true);
  });

  it('toProps conserva los campos nuevos', () => {
    const props = CuratedProfile.create({ ...BASE, listed: false }).toProps();
    expect(props.listed).toBe(false);
    expect(props.archivedAt).toBeNull();
  });
});
