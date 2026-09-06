import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { resolveRequestLocale } from './request-locale.decorator';

/**
 * Informa en `Content-Language` el locale efectivamente servido
 * (spec `content-localization`). Se registra como interceptor global.
 */
@Injectable()
export class ContentLanguageInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const locale = resolveRequestLocale(req);

    return next.handle().pipe(
      tap(() => {
        if (!res.headersSent) res.setHeader('Content-Language', locale);
      }),
    );
  }
}
