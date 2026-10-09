import { BackgroundTasks } from '../../application/background-tasks';
import { PrismaService } from './prisma.service';

describe('PrismaService.onModuleDestroy', () => {
  it('drena las tareas en segundo plano (tope 5 s) antes de desconectar', async () => {
    const order: string[] = [];
    const background: BackgroundTasks = {
      run: jest.fn(),
      whenIdle: jest.fn(),
      drain: jest.fn().mockImplementation(async () => {
        await Promise.resolve();
        order.push('drain');
      }),
    };
    const service = new PrismaService(background);
    jest.spyOn(service, '$disconnect').mockImplementation(() => {
      order.push('disconnect');
      return Promise.resolve();
    });

    await service.onModuleDestroy();

    expect(background.drain).toHaveBeenCalledWith(5000);
    expect(order).toEqual(['drain', 'disconnect']);
  });
});
