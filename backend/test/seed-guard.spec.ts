import {
  ContentCount,
  describePgDumpCommand,
  evaluateDefaultSeed,
  formatCountFailure,
  formatDefaultSeedRefusal,
  formatOverwriteWarning,
  SEED_CONTENT_TABLES,
  describeDatabaseTarget,
  evaluateContentLayer,
  evaluateEnvLayers,
  evaluateSeedGuard,
  formatGuardFailure,
} from '../scripts/lib/seed-guard';

/** Negativa en tres capas (change `add-learning-guide-and-example-data`, D6), sin base. */
describe('seed-guard', () => {
  const okEnv = { SEED_DISPOSABLE_DB: '1', NODE_ENV: 'development' };

  it('las tres capas en verde: base vacía', () => {
    expect(
      evaluateSeedGuard({ env: okEnv, existingProfileNames: [], incomingFullName: 'Ana Ejemplo' }),
    ).toEqual([]);
  });

  it('las tres capas en verde: recarga del mismo perfil', () => {
    expect(
      evaluateSeedGuard({
        env: okEnv,
        existingProfileNames: ['Ana Ejemplo'],
        incomingFullName: 'Ana Ejemplo',
      }),
    ).toEqual([]);
  });

  it('capa 1: falta SEED_DISPOSABLE_DB=1', () => {
    expect(evaluateEnvLayers({ NODE_ENV: 'development' }).map((x) => x.layer)).toEqual([1]);
    expect(evaluateEnvLayers({ SEED_DISPOSABLE_DB: '0' }).map((x) => x.layer)).toEqual([1]);
  });

  it('capa 2: NODE_ENV=production', () => {
    const f = evaluateEnvLayers({ SEED_DISPOSABLE_DB: '1', NODE_ENV: 'production' });
    expect(f.map((x) => x.layer)).toEqual([2]);
  });

  it('capa 3: la base tiene el perfil de otra persona', () => {
    const f = evaluateSeedGuard({
      env: okEnv,
      existingProfileNames: ['Otra Persona'],
      incomingFullName: 'Ana Ejemplo',
    });
    expect(f.map((x) => x.layer)).toEqual([3]);
  });

  it('capa 3: más de un perfil nunca es una recarga', () => {
    expect(evaluateContentLayer(['Ana Ejemplo', 'Ana Ejemplo'], 'Ana Ejemplo')?.layer).toBe(3);
  });

  it('sin consulta a la base no se evalúa la capa 3', () => {
    const f = evaluateSeedGuard({ env: {}, existingProfileNames: null, incomingFullName: 'x' });
    expect(f.map((x) => x.layer)).toEqual([1]);
  });

  it('el destino se muestra sin usuario ni contraseña', () => {
    const url = 'postgresql://portfolio:s3cr3t-pass@localhost:5434/portfolio?schema=public';
    expect(describeDatabaseTarget(url)).toBe('localhost:5434/portfolio');
    const message = formatGuardFailure(evaluateEnvLayers({}), describeDatabaseTarget(url));
    expect(message).not.toContain('s3cr3t-pass');
    expect(message).not.toContain('portfolio:');
    expect(message).toContain('localhost:5434/portfolio');
    expect(message).toContain('portfolio_example');
  });

  it('tolera una URL ausente o ilegible', () => {
    expect(describeDatabaseTarget(undefined)).toContain('sin definir');
    expect(describeDatabaseTarget('no es una url')).toContain('ilegible');
  });
});

/** Negativa del seed por defecto (change `protect-default-seed`), sin base. */
describe('seed-guard · seed por defecto', () => {
  const zero: ContentCount[] = SEED_CONTENT_TABLES.map((t) => ({ label: t.label, rows: 0 }));
  const withRows = (label: string, rows: number): ContentCount[] =>
    zero.map((c) => (c.label === label ? { ...c, rows } : c));
  const prod = { NODE_ENV: 'production' };
  const prodAllowed = { NODE_ENV: 'production', SEED_ALLOW_PRODUCTION: '1' };

  it('la lista cubre las 13 tablas, sin AdminUser', () => {
    expect(SEED_CONTENT_TABLES).toHaveLength(13);
    expect(SEED_CONTENT_TABLES.map((t) => t.label)).not.toContain('AdminUser');
  });

  describe('evaluateDefaultSeed', () => {
    it('base vacía carga, con o sin --overwrite y en producción', () => {
      for (const env of [{}, prod, prodAllowed]) {
        for (const overwrite of [false, true]) {
          expect(evaluateDefaultSeed({ counts: zero, overwrite, env })).toEqual({ action: 'load' });
        }
      }
    });

    it('una sola tabla con filas alcanza para negarse (Experience)', () => {
      expect(
        evaluateDefaultSeed({ counts: withRows('Experience', 1), overwrite: false, env: {} }),
      ).toEqual({ action: 'refuse', reason: 'content' });
    });

    it('--overwrite local carga', () => {
      expect(
        evaluateDefaultSeed({ counts: withRows('Profile', 1), overwrite: true, env: {} }),
      ).toEqual({ action: 'load-overwrite', production: false });
    });

    it('tabla de D4: producción con contenido', () => {
      const counts = withRows('Profile', 1);
      expect(evaluateDefaultSeed({ counts, overwrite: false, env: prod })).toEqual({
        action: 'refuse',
        reason: 'production-needs-overwrite',
      });
      expect(evaluateDefaultSeed({ counts, overwrite: false, env: prodAllowed })).toEqual({
        action: 'refuse',
        reason: 'production-needs-overwrite',
      });
      expect(evaluateDefaultSeed({ counts, overwrite: true, env: prod })).toEqual({
        action: 'refuse',
        reason: 'production-needs-allow',
      });
      expect(evaluateDefaultSeed({ counts, overwrite: true, env: prodAllowed })).toEqual({
        action: 'load-overwrite',
        production: true,
      });
    });

    it('SEED_ALLOW_PRODUCTION se ignora fuera de producción y debe valer exactamente 1', () => {
      const counts = withRows('Profile', 1);
      expect(
        evaluateDefaultSeed({ counts, overwrite: false, env: { SEED_ALLOW_PRODUCTION: '1' } }),
      ).toEqual({ action: 'refuse', reason: 'content' });
      expect(
        evaluateDefaultSeed({
          counts,
          overwrite: true,
          env: { NODE_ENV: 'production', SEED_ALLOW_PRODUCTION: 'true' },
        }),
      ).toEqual({ action: 'refuse', reason: 'production-needs-allow' });
    });
  });

  describe('describePgDumpCommand', () => {
    const now = new Date(2026, 9, 27, 23, 59);

    it('URI sin contraseña ni schema, con el archivo del día', () => {
      const lines = describePgDumpCommand(
        'postgresql://portfolio:s3cr3t-pass@localhost:5434/portfolio?schema=public',
        now,
      );
      expect(lines).toEqual([
        '  pg_dump "postgresql://portfolio@localhost:5434/portfolio" -Fc -f portfolio-2026-10-27.dump',
      ]);
    });

    it('conserva sslmode y descarta los demás parámetros de Prisma', () => {
      const [line] = describePgDumpCommand(
        'postgresql://u:p@db.example.com:6543/app?schema=public&sslmode=require&connection_limit=5',
        now,
      );
      expect(line).toContain('"postgresql://u@db.example.com:6543/app?sslmode=require"');
      expect(line).not.toContain('schema');
      expect(line).not.toContain('connection_limit');
    });

    it('puerto por defecto 5432 y sin usuario si la URL no lo trae', () => {
      const [line] = describePgDumpCommand('postgresql://db.example.com/app', now);
      expect(line).toContain('"postgresql://db.example.com:5432/app"');
    });

    it('host de la red privada de Railway: agrega la pista de DATABASE_PUBLIC_URL', () => {
      const lines = describePgDumpCommand(
        'postgresql://postgres:p@postgres.railway.internal:5432/railway',
        now,
      );
      expect(lines).toHaveLength(2);
      expect(lines[1]).toContain('DATABASE_PUBLIC_URL');
    });

    it('URL ausente o ilegible: indicación genérica', () => {
      for (const bad of [undefined, 'no es una url']) {
        const lines = describePgDumpCommand(bad, now);
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain('docs/DEPLOY.md § 7');
      }
    });
  });

  describe('textos (D8, D3, D4, D6)', () => {
    const url = 'postgresql://portfolio:s3cr3t-pass@localhost:5434/portfolio?schema=public';
    const target = 'localhost:5434/portfolio';
    const now = new Date(2026, 9, 27, 10);
    const counts = zero.map((c) =>
      c.label === 'ProfileView'
        ? { ...c, rows: 230 }
        : c.label === 'Profile'
          ? { ...c, rows: 1 }
          : c,
    );

    it('negativa local: texto completo, sin listar las tablas en cero', () => {
      expect(
        formatDefaultSeedRefusal({ reason: 'content', target, counts, databaseUrl: url, now }),
      ).toBe(
        [
          'Negativa: no se recarga docs/cv-data.json en localhost:5434/portfolio: la base ya tiene contenido.',
          '  - ProfileView: 230',
          '  - Profile: 1',
          'Si querés conservarlo, respaldalo antes (pg_dump pide la contraseña):',
          '  pg_dump "postgresql://portfolio@localhost:5434/portfolio" -Fc -f portfolio-2026-10-27.dump',
          'Para borrarlo y recargar desde docs/cv-data.json: npm run seed -- --overwrite',
          'No se escribió nada.',
        ].join('\n'),
      );
    });

    it('negativa en producción sin --overwrite: las dos llaves', () => {
      const text = formatDefaultSeedRefusal({
        reason: 'production-needs-overwrite',
        target,
        counts,
        databaseUrl: url,
        now,
      });
      expect(text.split('\n')[0]).toBe(
        'Negativa: no se recarga docs/cv-data.json en localhost:5434/portfolio: la base ya tiene contenido (NODE_ENV=production).',
      );
      expect(text).toContain(
        'Para borrarlo y recargar en producción hacen falta las dos llaves: SEED_ALLOW_PRODUCTION=1, definida solo para este comando, y npm run seed -- --overwrite',
      );
    });

    it('negativa en producción con --overwrite y sin la variable', () => {
      const text = formatDefaultSeedRefusal({
        reason: 'production-needs-allow',
        target,
        counts,
        databaseUrl: url,
        now,
      });
      expect(text).toContain(
        '--overwrite no alcanza con NODE_ENV=production: falta SEED_ALLOW_PRODUCTION=1, definida solo para este comando (nunca como variable del servicio).',
      );
    });

    it('avisos de --overwrite', () => {
      expect(formatOverwriteWarning(target, counts, false)).toBe(
        '⚠️  --overwrite: se borra el contenido de localhost:5434/portfolio (ProfileView: 230, Profile: 1).',
      );
      expect(formatOverwriteWarning(target, counts, true)).toBe(
        '⚠️  --overwrite en producción (SEED_ALLOW_PRODUCTION=1): se borra el contenido de localhost:5434/portfolio (ProfileView: 230, Profile: 1).',
      );
    });

    it('falla al contar', () => {
      expect(formatCountFailure(target, new Error('boom'), url)).toBe(
        [
          '❌ No se pudo comprobar si localhost:5434/portfolio tiene contenido: boom',
          '¿Aplicaste las migraciones? (npm run prisma:deploy)',
          'No se escribió nada.',
        ].join('\n'),
      );
    });

    it('ningún mensaje contiene la contraseña', () => {
      const all = [
        formatDefaultSeedRefusal({ reason: 'content', target, counts, databaseUrl: url, now }),
        formatDefaultSeedRefusal({
          reason: 'production-needs-allow',
          target,
          counts,
          databaseUrl: url,
          now,
        }),
        formatOverwriteWarning(target, counts, true),
        formatCountFailure(target, new Error(`fallo en ${url}`), url),
      ].join('\n');
      expect(all).not.toContain('s3cr3t-pass');
    });

    it('falla al contar: quita la contraseña codificada y la decodificada', () => {
      const encodedUrl = 'postgresql://portfolio:p%40ss%2Fw0rd%25@localhost:5434/portfolio';
      const message = formatCountFailure(
        target,
        new Error('auth failed for p@ss/w0rd% (url: p%40ss%2Fw0rd%25)'),
        encodedUrl,
      );
      expect(message).toContain('auth failed for *** (url: ***)');
      expect(message).not.toContain('p@ss/w0rd%');
      expect(message).not.toContain('p%40ss%2Fw0rd%25');
    });

    it('falla al contar: una codificación inválida no rompe el mensaje', () => {
      const badUrl = 'postgresql://portfolio:bad%zz@localhost:5434/portfolio';
      expect(formatCountFailure(target, new Error('fallo con bad%zz'), badUrl)).toContain(
        'fallo con ***',
      );
    });
  });
});
