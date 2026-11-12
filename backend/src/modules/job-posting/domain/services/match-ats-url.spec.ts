import { matchAtsUrl } from './match-ats-url';

function match(raw: string) {
  return matchAtsUrl(new URL(raw));
}

describe('matchAtsUrl (D3)', () => {
  it.each([
    ['https://boards.greenhouse.io/acmeejemplo/jobs/4012345', false],
    ['https://job-boards.greenhouse.io/acmeejemplo/jobs/4012345', false],
    ['https://boards.eu.greenhouse.io/acmeejemplo/jobs/4012345', true],
    ['https://job-boards.eu.greenhouse.io/acmeejemplo/jobs/4012345', true],
  ])('Greenhouse %s', (raw, eu) => {
    expect(match(raw)).toEqual({
      ok: true,
      value: { kind: 'GREENHOUSE', board: 'acmeejemplo', id: '4012345', eu },
    });
  });

  it('Greenhouse embebido', () => {
    expect(
      match('https://boards.greenhouse.io/embed/job_app?for=acmeejemplo&token=4012345'),
    ).toEqual({
      ok: true,
      value: { kind: 'GREENHOUSE', board: 'acmeejemplo', id: '4012345', eu: false },
    });
  });

  it('Greenhouse embebido con un token inválido se rechaza', () => {
    expect(match('https://boards.greenhouse.io/embed/job_app?for=acme&token=../x').ok).toBe(false);
    expect(match('https://boards.greenhouse.io/embed/job_app?for=acme').ok).toBe(false);
  });

  it.each([
    'https://jobs.lever.co/acmeejemplo/0b1c2d3e-aaaa-bbbb-cccc-1234567890ab',
    'https://jobs.lever.co/acmeejemplo/0b1c2d3e-aaaa-bbbb-cccc-1234567890ab/apply',
    'https://jobs.lever.co/acmeejemplo/0b1c2d3e-aaaa-bbbb-cccc-1234567890ab/',
  ])('Lever %s', (raw) => {
    expect(match(raw)).toEqual({
      ok: true,
      value: {
        kind: 'LEVER',
        site: 'acmeejemplo',
        id: '0b1c2d3e-aaaa-bbbb-cccc-1234567890ab',
        eu: false,
      },
    });
  });

  it('Lever EU', () => {
    expect(match('https://jobs.eu.lever.co/acmeejemplo/abc-123')).toEqual({
      ok: true,
      value: { kind: 'LEVER', site: 'acmeejemplo', id: 'abc-123', eu: true },
    });
  });

  it.each([
    'https://jobs.ashbyhq.com/acmeejemplo/9f8e7d6c-0000-1111-2222-333344445555',
    'https://jobs.ashbyhq.com/acmeejemplo/9f8e7d6c-0000-1111-2222-333344445555/application',
  ])('Ashby %s', (raw) => {
    expect(match(raw)).toEqual({
      ok: true,
      value: {
        kind: 'ASHBY',
        org: 'acmeejemplo',
        id: '9f8e7d6c-0000-1111-2222-333344445555',
      },
    });
  });

  it('un host de ATS con una ruta que no es de vacante cae al respaldo (null)', () => {
    expect(match('https://boards.greenhouse.io/acmeejemplo')).toEqual({ ok: true, value: null });
    expect(match('https://jobs.lever.co/acmeejemplo')).toEqual({ ok: true, value: null });
    expect(match('https://jobs.ashbyhq.com/acmeejemplo')).toEqual({ ok: true, value: null });
  });

  it('una URL de empresa no es de un ATS', () => {
    expect(match('https://careers.acme-ejemplo.com/job/1')).toEqual({ ok: true, value: null });
  });

  it.each([
    'https://jobs.ashbyhq.com/acmeejemplo/..%2Fadmin',
    'https://jobs.lever.co/acme%2Fx/abc',
    'https://boards.greenhouse.io/acme/jobs/12%203',
    'https://jobs.lever.co/acmeejemplo/' + 'a'.repeat(101),
    'https://boards.greenhouse.io/acme/jobs/1;2',
  ])('un segmento fuera de la forma permitida se rechaza (%s)', (raw) => {
    const result = match(raw);
    expect(result.ok).toBe(false);
  });

  it('un `../` literal lo resuelve WHATWG antes de llegar acá: nunca llega a la API', () => {
    // La ruta queda `/admin/x`: son segmentos válidos y el host de la API es fijo, así que
    // lo peor que puede pasar es pedir otra vacante del mismo ATS.
    const result = match('https://jobs.ashbyhq.com/acmeejemplo/../admin/x');
    expect(result).toEqual({ ok: true, value: { kind: 'ASHBY', org: 'admin', id: 'x' } });
  });

  it('un segmento `..` que sobrevive (codificado) se rechaza', () => {
    expect(match('https://jobs.lever.co/acmeejemplo/%2e%2e').ok).toBe(true); // WHATWG lo resuelve
    expect(match('https://jobs.lever.co/acmeejemplo/..%00').ok).toBe(false);
  });
});
