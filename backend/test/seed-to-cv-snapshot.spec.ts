import * as fs from 'fs';
import * as path from 'path';
import { runCvRules } from '../src/modules/cv-consistency/domain/run-cv-rules';
import { seedToCvSnapshot } from '../scripts/lib/seed-to-cv-snapshot';
import { parseSeedSource, SeedSource } from '../scripts/lib/seed-source';

const DOCS = path.resolve(__dirname, '../../docs');
const load = (file: string): SeedSource => {
  const parsed = parseSeedSource(JSON.parse(fs.readFileSync(path.join(DOCS, file), 'utf-8')));
  if (!parsed.ok) throw new Error(`${file} no pasa el parser del seed`);
  return parsed.value;
};

describe('seedToCvSnapshot (D13)', () => {
  const source = load('cv-data.json');
  const snapshot = seedToCvSnapshot(source);

  it('cuenta lo mismo que el archivo (el perfil `all` se suma a las plantillas)', () => {
    expect(snapshot.experiences).toHaveLength(source.experiences.length);
    expect(snapshot.education).toHaveLength(source.education.length);
    expect(snapshot.certifications).toHaveLength(source.certifications.length);
    expect(snapshot.projects).toHaveLength(source.projects.length);
    expect(snapshot.skillCategories).toHaveLength(source.skillCategories.length);
    expect(snapshot.languages).toHaveLength(source.profile.languages.length);
    expect(snapshot.curatedProfiles).toHaveLength(source.profileTemplates.length + 1);
  });

  it('usa la clave del seed cuando existe y una posicional si no', () => {
    expect(snapshot.profile?.id).toBe('profile');
    expect(snapshot.experiences[0].id).toBe(`experience:${source.experiences[0].id}`);
    expect(snapshot.projects[0].id).toBe(`project:${source.projects[0].id}`);
    expect(snapshot.curatedProfiles.map((c) => c.id)).toContain('all');
    expect(snapshot.curatedProfiles[1].id).toBe(source.profileTemplates[0].slug);
    expect(snapshot.certifications[4].id).toBe('certification#4');
    expect(snapshot.education[0].id).toBe('education#0');
    expect(snapshot.skillCategories[3].id).toBe('skillCategory#3');
    expect(snapshot.skillCategories[3].skills[2].id).toBe('skill#3.2');
    expect(snapshot.languages[0].id).toBe('language#0');
  });

  it('las claves son estables entre dos traducciones del mismo archivo', () => {
    expect(seedToCvSnapshot(source)).toEqual(snapshot);
  });

  it('las skills heredan los tags de su categoría si no traen propios', () => {
    for (const category of snapshot.skillCategories) {
      for (const skill of category.skills) expect(Array.isArray(skill.tags)).toBe(true);
    }
  });

  it('resuelve las referencias de includeRefs y excludeRefs a las claves de la instantánea', () => {
    const base = load('examples/cv-data.example.json');
    const experienceKey = base.experiences[0].id;
    const skillName =
      typeof base.skillCategories[0].skills[0] === 'string'
        ? base.skillCategories[0].skills[0]
        : (base.skillCategories[0].skills[0] as { name: string }).name;
    const withRefs: SeedSource = {
      ...base,
      profileTemplates: [
        {
          ...base.profileTemplates[0],
          includeRefs: [`experience:${experienceKey}`, `skill:${skillName}`],
          excludeRefs: [`project:${base.projects[0].id}`],
        },
      ],
    };
    const [, curated] = seedToCvSnapshot(withRefs).curatedProfiles;
    expect(curated.includeIds).toEqual([`experience:${experienceKey}`, 'skill#0.0']);
    expect(curated.excludeIds).toEqual([`project:${base.projects[0].id}`]);
    const known = seedToCvSnapshot(withRefs);
    expect(known.experiences.map((e) => e.id)).toContain(`experience:${experienceKey}`);
    expect(
      runCvRules(known, { asOf: '2026-11' }).filter((i) => i.code === 'curated.orphan-reference'),
    ).toEqual([]);
  });

  it('una referencia a una clave inexistente queda como id huérfano', () => {
    const base = load('examples/cv-data.example.json');
    const orphan: SeedSource = {
      ...base,
      profileTemplates: [
        { ...base.profileTemplates[0], excludeRefs: ['experience:no-existe', 'skill:Nada'] },
      ],
    };
    const result = seedToCvSnapshot(orphan);
    const [, curated] = result.curatedProfiles;
    expect(curated.excludeIds).toEqual(['experience:no-existe', 'skill:Nada']);
    const orphans = runCvRules(result, { asOf: '2026-11' }).filter(
      (i) => i.code === 'curated.orphan-reference',
    );
    expect(orphans.map((i) => i.params.id)).toEqual(['experience:no-existe', 'skill:Nada']);
  });

  it('un perfil archivado del archivo queda archivado', () => {
    const base = load('examples/cv-data.example.json');
    const archived = seedToCvSnapshot(base).curatedProfiles.find(
      (c) => c.slug === 'ejemplo-archivado',
    );
    expect(archived?.archived).toBe(true);
  });
});
