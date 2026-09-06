import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/**
 * CORS restringido al origen del frontend (spec `api-platform`).
 * Se usa una función en lugar de un string para que un origen NO permitido no
 * reciba `Access-Control-Allow-Origin` (con string, el middleware siempre lo emite).
 */
export function buildCorsOptions(allowedOrigin: string): CorsOptions {
  return {
    origin: (requestOrigin, callback) => {
      // Sin header Origin (curl, same-origin) no hay CORS que negociar.
      if (!requestOrigin) return callback(null, false);
      callback(null, requestOrigin === allowedOrigin);
    },
    methods: ['GET', 'HEAD', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Accept-Language'],
    exposedHeaders: ['Content-Language'],
  };
}
