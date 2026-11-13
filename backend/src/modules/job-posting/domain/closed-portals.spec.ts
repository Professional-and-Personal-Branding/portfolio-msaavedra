import { classifyClosedPortal, closedPortalMessage } from './closed-portals';

describe('classifyClosedPortal (D5)', () => {
  const closed: Array<[string, string]> = [
    ['www.linkedin.com', 'LinkedIn'],
    ['linkedin.com', 'LinkedIn'],
    ['ar.linkedin.com', 'LinkedIn'],
    ['lnkd.in', 'LinkedIn'],
    ['indeed.com', 'Indeed'],
    ['ar.indeed.com', 'Indeed'],
    ['indeed.com.mx', 'Indeed'],
    ['www.indeed.co.uk', 'Indeed'],
    ['glassdoor.com', 'Glassdoor'],
    ['www.glassdoor.co.uk', 'Glassdoor'],
    ['wellfound.com', 'Wellfound'],
    ['angel.co', 'Wellfound'],
    ['www.computrabajo.com.ar', 'Computrabajo'],
    ['bumeran.com.ar', 'Bumeran'],
    ['www.laborum.cl', 'Laborum'],
    ['www.zonajobs.com.ar', 'ZonaJobs'],
    ['www.workana.com', 'Workana'],
    ['www.upwork.com', 'Upwork'],
    ['torre.ai', 'Torre'],
    ['torre.co', 'Torre'],
    ['www.getonbrd.com', 'Get on Board'],
    ['getonbrd.cl', 'Get on Board'],
    ['himalayas.app', 'Himalayas'],
    ['remotive.com', 'Remotive'],
    ['remoteok.io', 'Remote OK'],
    ['www.adzuna.com.ar', 'Adzuna'],
    ['jooble.org', 'Jooble'],
    ['www.arbeitnow.com', 'Arbeitnow'],
    ['WWW.LinkedIn.COM.', 'LinkedIn'],
  ];

  it.each(closed)('%s es un portal cerrado (%s)', (host, label) => {
    expect(classifyClosedPortal(host)?.label).toBe(label);
  });

  const open = [
    'misindeedjobs.com',
    'linkedin.com.acme-ejemplo.com',
    'notlinkedin.com',
    'boards.greenhouse.io',
    'jobs.lever.co',
    'jobs.ashbyhq.com',
    'careers.acme-ejemplo.com',
    'indeed.acme.com',
    'workana.com.evil.example',
  ];

  it.each(open)('%s no es un portal cerrado', (host) => {
    expect(classifyClosedPortal(host)).toBeNull();
  });

  it('el mensaje nombra el portal e indica pegar el texto', () => {
    const rule = classifyClosedPortal('www.linkedin.com');
    expect(rule && closedPortalMessage(rule)).toBe(
      '«LinkedIn» no permite leer sus vacantes. Copiá el texto de la vacante y pegalo en «Texto».',
    );
  });
});
