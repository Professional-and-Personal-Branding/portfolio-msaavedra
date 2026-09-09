import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';

/**
 * Helmet ajustado a una API JSON (spec `api-security-headers`, decisión D4):
 * - sin CSP, porque esta app no sirve HTML (la del sitio la pone el hosting del frontend);
 * - `cross-origin` en la política de recursos, porque el frontend vive en otro origen;
 * - `no-referrer`, porque los perfiles PROTECTED llevan el token en la URL;
 * - HSTS solo en producción, donde efectivamente hay HTTPS.
 */
export function buildHelmet(isProduction: boolean) {
  return helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'no-referrer' },
    frameguard: { action: 'deny' },
    hsts: isProduction ? { maxAge: 31_536_000, includeSubDomains: true, preload: false } : false,
  });
}

/**
 * Redirección a HTTPS detrás del proxy del proveedor
 * (spec `api-security-headers` § HTTPS en producción). Fuera de producción no hace nada.
 */
export function httpsRedirect(isProduction: boolean) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!isProduction) return next();

    const forwarded = req.headers['x-forwarded-proto'];
    const protocol = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
    // Sin la cabecera se asume que el proxy ya resolvió el TLS.
    if (!protocol || protocol === 'https') return next();

    res.redirect(301, `https://${req.headers.host ?? ''}${req.originalUrl}`);
  };
}
