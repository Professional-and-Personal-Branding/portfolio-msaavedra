/**
 * Registro de visitas fuera del camino crítico (change polish-builder-and-edge):
 * espera determinista, todo o nada y apagado ordenado.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { GLOBAL_PREFIX, PREFIX_EXCLUDED_ROUTES } from '../src/app.constants';
import { AppModule } from '../src/app.module';
import {
  PROFILE_VIEW_REPOSITORY,
  ProfileViewRepository,
} from '../src/modules/analytics/domain/repositories/profile-view.repository';
import { PrismaProfileViewRepository } from '../src/modules/analytics/infrastructure/persistence/prisma-profile-view.repository';
import { PrismaService } from '../src/shared/infrastructure/persistence/prisma.service';
import { createTestApp, settleBackgroundTasks } from './e2e-helpers';

const MARK = 'BackgroundViewsE2E';

describe('Visitas en segundo plano (e2e)', () => {
  describe('con la app de pruebas estándar', () => {
    let app: INestApplication;
    let prisma: PrismaService;

    beforeAll(async () => {
      ({ app, prisma } = await createTestApp());
    });

    afterAll(async () => {
      await settleBackgroundTasks(app);
      await prisma.profileView.deleteMany({ where: { userAgent: MARK } });
      await app.close();
    });

    it('esperar varias visitas: las tres están en la base tras whenIdle()', async () => {
      const all = await prisma.curatedProfile.findUniqueOrThrow({ where: { slug: 'all' } });
      const before = await prisma.profileView.count({ where: { userAgent: MARK } });
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .get('/api/curated-profiles/all')
          .set('User-Agent', MARK)
          .expect(200);
      }
      await settleBackgroundTasks(app);
      expect(await prisma.profileView.count({ where: { userAgent: MARK } })).toBe(before + 3);
      const after = await prisma.curatedProfile.findUniqueOrThrow({ where: { id: all.id } });
      expect(after.views).toBeGreaterThanOrEqual(all.views + 3);
    });

    it('un 404 no registra, comprobado después de esperar', async () => {
      const before = await prisma.profileView.count();
      await request(app.getHttpServer()).get('/api/curated-profiles/no-existe-bg').expect(404);
      await settleBackgroundTasks(app);
      expect(await prisma.profileView.count()).toBe(before);
    });

    it('todo o nada: un perfil inexistente rechaza y no deja ProfileView ni cambia views', async () => {
      const repo = app.get<ProfileViewRepository>(PROFILE_VIEW_REPOSITORY);
      const total = await prisma.profileView.count();
      const views = await prisma.curatedProfile.aggregate({ _sum: { views: true } });

      await expect(
        repo.record({ curatedProfileId: 'no-existe-bg', locale: 'es', userAgent: MARK }),
      ).rejects.toBeDefined();

      expect(await prisma.profileView.count()).toBe(total);
      expect((await prisma.curatedProfile.aggregate({ _sum: { views: true } }))._sum.views).toBe(
        views._sum.views,
      );
    });
  });

  describe('apagado ordenado', () => {
    const independent = new PrismaClient();

    afterAll(async () => {
      await independent.profileView.deleteMany({ where: { userAgent: `${MARK}-close` } });
      await independent.$disconnect();
    });

    it('cerrar con una visita escribiéndose: el cierre espera y la visita está', async () => {
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(PROFILE_VIEW_REPOSITORY)
        .useFactory({
          factory: (prisma: PrismaService) => {
            const real = new PrismaProfileViewRepository(prisma);
            return {
              record: async (view: Parameters<ProfileViewRepository['record']>[0]) => {
                await new Promise((resolve) => setTimeout(resolve, 600));
                return real.record(view);
              },
              aggregate: real.aggregate.bind(real),
              countByReferrer: real.countByReferrer.bind(real),
            } satisfies ProfileViewRepository;
          },
          inject: [PrismaService],
        })
        .compile();
      const app = moduleRef.createNestApplication();
      app.setGlobalPrefix(GLOBAL_PREFIX, { exclude: PREFIX_EXCLUDED_ROUTES });
      app.useGlobalPipes(new ValidationPipe({ transform: true }));
      await app.init();

      const before = await independent.profileView.count({
        where: { userAgent: `${MARK}-close` },
      });
      await request(app.getHttpServer())
        .get('/api/curated-profiles/all')
        .set('User-Agent', `${MARK}-close`)
        .expect(200);
      // La respuesta ya salió y la escritura sigue en vuelo: no se llama a settle.
      expect(await independent.profileView.count({ where: { userAgent: `${MARK}-close` } })).toBe(
        before,
      );

      await app.close();

      expect(await independent.profileView.count({ where: { userAgent: `${MARK}-close` } })).toBe(
        before + 1,
      );
    });
  });
});
