import { ApplicationOutput } from '../dto/application.output';
import {
  APPLICATION_CSV_HEADER,
  APPLICATION_STATUS_LABELS,
  applicationCsvFilename,
  csvCell,
  toApplicationCsv,
} from './to-application-csv';

function output(over: Partial<ApplicationOutput> = {}): ApplicationOutput {
  return {
    id: 'a1',
    company: 'Globex',
    role: 'Backend Senior',
    jobUrl: 'https://globex.example/jobs/1',
    portal: 'linkedin',
    notes: null,
    status: 'INTERVIEWING',
    appliedAt: '2026-11-01',
    statusChangedAt: '2026-11-05T10:00:00.000Z',
    curatedProfileId: 'cp1',
    profileSlug: 'ejemplo-backend',
    shareLink: {
      id: 'sl1',
      label: 'Globex — RR. HH.',
      code: 'abcdefghjk',
      revoked: false,
      opens: 2,
      firstOpenedAt: '2026-11-03T09:00:00.000Z',
      lastOpenedAt: '2026-11-05T09:00:00.000Z',
    },
    nextStatuses: ['OFFER', 'REJECTED', 'WITHDRAWN'],
    createdAt: '2026-11-01T08:00:00.000Z',
    updatedAt: '2026-11-05T10:00:00.000Z',
    ...over,
  };
}

/** Parser RFC 4180 mínimo (campos entre comillas, `""`, CRLF dentro de una celda); solo para el test. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\r' && text[i + 1] === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i += 1;
    } else {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

const BODY = (csv: string) => csv.slice(1);

describe('toApplicationCsv (D10)', () => {
  it('empieza con BOM UTF-8 y la cabecera exacta, en orden', () => {
    const csv = toApplicationCsv([]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(BODY(csv)).toBe(
      '"Empresa","Puesto","Estado","Portal","URL de la vacante","Fecha de postulación",' +
        '"Último cambio de estado","Perfil","Enlace","Abierto el","Aperturas","Notas","Creada","Actualizada"',
    );
    expect(APPLICATION_CSV_HEADER).toHaveLength(14);
  });

  it('sin filas devuelve solo la cabecera', () => {
    expect(parseCsv(BODY(toApplicationCsv([])))).toHaveLength(1);
  });

  it('separa las filas con CRLF y entrecomilla todas las celdas', () => {
    const csv = toApplicationCsv([output(), output({ id: 'a2' })]);
    const lines = BODY(csv).split('\r\n');
    expect(lines).toHaveLength(3);
    for (const line of lines) {
      expect(line.startsWith('"')).toBe(true);
      expect(line.endsWith('"')).toBe(true);
    }
    expect(lines[1]).toBe(
      '"Globex","Backend Senior","En entrevistas","linkedin","https://globex.example/jobs/1",' +
        '"2026-11-01","2026-11-05T10:00:00.000Z","ejemplo-backend","Globex — RR. HH.",' +
        '"2026-11-03T09:00:00.000Z","2","","2026-11-01T08:00:00.000Z","2026-11-05T10:00:00.000Z"',
    );
  });

  it('no incluye ids ni el código del enlace', () => {
    const csv = toApplicationCsv([output()]);
    expect(csv).not.toContain('abcdefghjk');
    expect(csv).not.toContain('"a1"');
    expect(csv).not.toContain('cp1');
  });

  it('las etiquetas de estado salen en español', () => {
    expect(APPLICATION_STATUS_LABELS).toEqual({
      DRAFT: 'Por postular',
      APPLIED: 'Postulada',
      INTERVIEWING: 'En entrevistas',
      OFFER: 'Oferta',
      ACCEPTED: 'Aceptada',
      REJECTED: 'Rechazada',
      WITHDRAWN: 'Retirada',
    });
    const csv = toApplicationCsv([output({ status: 'WITHDRAWN' })]);
    expect(parseCsv(BODY(csv))[1][2]).toBe('Retirada');
  });

  it('sin enlace ni perfil las celdas quedan vacías', () => {
    const csv = toApplicationCsv([
      output({ shareLink: null, profileSlug: null, jobUrl: null, portal: null, appliedAt: null }),
    ]);
    const row = parseCsv(BODY(csv))[1];
    expect([row[3], row[4], row[5], row[7], row[8], row[9], row[10]]).toEqual([
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ]);
  });

  it('duplica las comillas y conserva el salto de línea dentro de la celda', () => {
    const notes = 'dijo "ok"\nfin';
    const csv = toApplicationCsv([output({ notes })]);
    expect(csv).toContain('"dijo ""ok""\nfin"');
    const rows = parseCsv(BODY(csv));
    expect(rows).toHaveLength(2);
    expect(rows[1][11]).toBe(notes);
  });

  it('un CRLF dentro de una celda también deja una fila por postulación', () => {
    const rows = parseCsv(BODY(toApplicationCsv([output({ notes: 'a\r\nb' }), output()])));
    expect(rows).toHaveLength(3);
    expect(rows[1][11]).toBe('a\r\nb');
  });

  it('ida y vuelta: recupera los valores originales salvo el apóstrofo de las fórmulas', () => {
    const source = output({
      company: '=HYPERLINK("http://x","clic")',
      role: 'Dev, Senior; "Lead"',
      notes: '-30 % de sueldo',
    });
    const rows = parseCsv(BODY(toApplicationCsv([source])));
    expect(rows[1][0]).toBe(`'${source.company}`);
    expect(rows[1][1]).toBe(source.role);
    expect(rows[1][11]).toBe(`'${source.notes}`);
  });
});

describe('neutralización de fórmulas (OWASP CSV Injection)', () => {
  it.each([
    ['=', '=1+1'],
    ['+', '+54911'],
    ['-', '-30 % de sueldo'],
    ['@', '@usuario'],
    ['tabulación', '\tcelda'],
    ['retorno de carro', '\rcelda'],
  ])('antepone un apóstrofo si empieza con %s', (_name, value) => {
    expect(csvCell(value)).toBe(`"'${value}"`);
  });

  it('la celda de la empresa del caso del spec', () => {
    const csv = toApplicationCsv([output({ company: '=HYPERLINK("http://x","clic")' })]);
    expect(csv).toContain(`"'=HYPERLINK(""http://x"",""clic"")"`);
  });

  it('el texto normal, un número o una fecha no cambian', () => {
    expect(csvCell('Backend Senior')).toBe('"Backend Senior"');
    expect(csvCell('2026-11-20')).toBe('"2026-11-20"');
    expect(csvCell('3')).toBe('"3"');
    expect(csvCell('')).toBe('""');
  });

  it('solo cuenta el primer carácter: un disparador en el medio no se toca', () => {
    expect(csvCell('a=1')).toBe('"a=1"');
    expect(csvCell('Dev - Senior')).toBe('"Dev - Senior"');
  });

  it('se aplica a todas las columnas, también a las que no vienen del usuario', () => {
    const csv = toApplicationCsv([
      output({ profileSlug: '=slug', portal: '+p', jobUrl: '@u', shareLink: null }),
    ]);
    const row = parseCsv(BODY(csv))[1];
    expect(row[3]).toBe("'+p");
    expect(row[4]).toBe("'@u");
    expect(row[7]).toBe("'=slug");
  });
});

describe('applicationCsvFilename', () => {
  it('usa la fecha UTC del reloj', () => {
    expect(applicationCsvFilename(new Date('2026-11-20T23:59:59Z'))).toBe(
      'postulaciones-2026-11-20.csv',
    );
    expect(applicationCsvFilename(new Date('2026-11-21T00:00:00Z'))).toBe(
      'postulaciones-2026-11-21.csv',
    );
  });
});
