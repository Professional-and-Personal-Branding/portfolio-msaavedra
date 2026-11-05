export interface AdminUserProps {
  readonly id: string;
  readonly email: string;
  /** Hash argon2id; nunca la contraseña. */
  readonly passwordHash: string;
  readonly name: string;
  readonly createdAt: Date;
  readonly lastLoginAt: Date | null;
  /** Versión de sesión: los JWT con otra versión quedan revocados (change `add-admin-password-change`). */
  readonly sessionVersion: number;
}

/** Administrador del backoffice (único usuario con permisos de escritura). */
export class AdminUser {
  private constructor(private readonly props: AdminUserProps) {}

  static create(props: AdminUserProps): AdminUser {
    return new AdminUser({ ...props, email: props.email.trim().toLowerCase() });
  }

  get id(): string {
    return this.props.id;
  }
  get email(): string {
    return this.props.email;
  }
  get passwordHash(): string {
    return this.props.passwordHash;
  }
  get name(): string {
    return this.props.name;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get lastLoginAt(): Date | null {
    return this.props.lastLoginAt;
  }
  get sessionVersion(): number {
    return this.props.sessionVersion;
  }

  /**
   * ¿Vale un token emitido con la versión `sv`? Un token sin `sv` (emitido antes de que existiera
   * la versión) cuenta como 0. Un valor que no es un entero ≥ 0 nunca vale.
   */
  acceptsSession(sv: unknown): boolean {
    const presented = sv === undefined ? 0 : sv;
    return typeof presented === 'number' && Number.isInteger(presented) && presented >= 0
      ? presented === this.props.sessionVersion
      : false;
  }
}
