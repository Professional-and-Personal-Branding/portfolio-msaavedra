export interface AdminUserProps {
  readonly id: string;
  readonly email: string;
  /** Hash argon2id; nunca la contraseña. */
  readonly passwordHash: string;
  readonly name: string;
  readonly createdAt: Date;
  readonly lastLoginAt: Date | null;
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
}
