export interface AdminOutput {
  id: string;
  email: string;
  name: string;
}

/**
 * Administrador autenticado tal como lo deja `JwtStrategy` en `req.user`: suma la versión de
 * sesión para el cambio de contraseña. Nunca sale por HTTP (`/me` devuelve `AdminOutput`).
 */
export interface AuthenticatedAdmin extends AdminOutput {
  sessionVersion: number;
}

export interface LoginOutput {
  accessToken: string;
  tokenType: 'Bearer';
  /** Segundos hasta la expiración. */
  expiresIn: number;
  user: AdminOutput;
}
