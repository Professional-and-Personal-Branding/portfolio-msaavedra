import { Global, Module } from '@nestjs/common';
import { BACKGROUND_TASKS } from '../../application/background-tasks';
import { InProcessBackgroundTasks } from './in-process-background-tasks';

@Global()
@Module({
  providers: [{ provide: BACKGROUND_TASKS, useClass: InProcessBackgroundTasks }],
  exports: [BACKGROUND_TASKS],
})
export class BackgroundTasksModule {}
