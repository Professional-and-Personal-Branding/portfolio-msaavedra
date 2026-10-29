/**
 * Puerto de verificación de la sesión de administrador (change
 * `classify-profile-views`, D2). Lo usa el registro de visitas para reconocer las
 * propias sin pasar por un guard: la ruta pública sigue siendo anónima. Sin Nest
 * ni Prisma: lo implementa `auth/infrastructure`.
 */
export interface AdminSessionVerifier {
  /**
   * `true` solo si el token es un JWT del panel con firma y expiración válidas
   * de un administrador que todavía existe. Cualquier otro caso devuelve `false`;
   * no debe incluir el token en ningún mensaje.
   */
  isAdminSession(token: string): Promise<boolean>;
}

export const ADMIN_SESSION_VERIFIER = Symbol('ADMIN_SESSION_VERIFIER');
