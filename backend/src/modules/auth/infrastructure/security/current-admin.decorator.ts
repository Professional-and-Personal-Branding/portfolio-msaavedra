import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { AdminOutput } from '../../application/dto/auth.output';

/** Administrador autenticado (lo deja `JwtStrategy.validate` en `req.user`). */
export const CurrentAdmin = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<Request & { user?: AdminOutput }>();
  return req.user;
});
