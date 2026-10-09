import { LocalizedText } from '../../../../shared/domain/i18n';
import { resolvability } from '../services/resolvability';
import { AccessToken } from '../value-objects/access-token.vo';

export const CURATED_VISIBILITIES = ['PUBLIC', 'PRIVATE', 'PROTECTED'] as const;
export type CuratedVisibility = (typeof CURATED_VISIBILITIES)[number];

export function isCuratedVisibility(value: unknown): value is CuratedVisibility {
  return typeof value === 'string' && (CURATED_VISIBILITIES as readonly string[]).includes(value);
}

export interface CuratedProfileProps {
  readonly id: string;
  readonly slug: string;
  readonly title: LocalizedText | string;
  readonly headline: LocalizedText | string;
  readonly description: LocalizedText | string | null;
  readonly roleType: LocalizedText | string | null;
  readonly techFocus: string | null;
  readonly filterTags: readonly string[];
  readonly includeIds: readonly string[];
  readonly excludeIds: readonly string[];
  readonly themeId: string | null;
  /** Override parcial de tokens (JSON libre, validado al mergear). */
  readonly themeOverrides: unknown;
  readonly layout: string;
  readonly sectionsOrder: readonly string[];
  readonly sectionsHidden: readonly string[];
  readonly visibility: CuratedVisibility;
  readonly accessToken: AccessToken;
  /**
   * Ciclo de vida (add-curated-profile-lifecycle). Tres ejes disjuntos:
   * `visibility` decide quién puede abrirlo, `archivedAt` si sigue vivo y
   * `listed` si se enumera. Opcionales al construir: `create()` los normaliza.
   */
  readonly archivedAt?: Date | null;
  readonly listed?: boolean;
  readonly views: number;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}

/**
 * Datos para crear un perfil curado (id, vistas y metadatos los pone la
 * persistencia). `archivedAt` no está: solo lo escriben archivar y desarchivar.
 */
export type NewCuratedProfileProps = Omit<
  CuratedProfileProps,
  'id' | 'views' | 'createdAt' | 'updatedAt' | 'archivedAt'
>;

/** Cambios aplicables con `with()`: lo editable más `archivedAt`, que fijan los casos de uso. */
export type CuratedProfileChanges = Partial<NewCuratedProfileProps> & {
  readonly archivedAt?: Date | null;
};

/** Perfil curado: vista filtrada y personalizada del perfil profesional (núcleo del producto). */
export class CuratedProfile {
  private constructor(private readonly props: CuratedProfileProps) {}

  static create(props: CuratedProfileProps): CuratedProfile {
    return new CuratedProfile({
      ...props,
      archivedAt: props.archivedAt ?? null,
      listed: props.listed ?? true,
      filterTags: [...props.filterTags],
      includeIds: [...props.includeIds],
      excludeIds: [...props.excludeIds],
      sectionsOrder: [...props.sectionsOrder],
      sectionsHidden: [...props.sectionsHidden],
    });
  }

  /** Copia con cambios parciales (edición desde el backoffice, archivar, duplicar). */
  with(changes: CuratedProfileChanges): CuratedProfile {
    return CuratedProfile.create({ ...this.props, ...changes });
  }

  toProps(): CuratedProfileProps {
    return {
      ...this.props,
      filterTags: [...this.props.filterTags],
      includeIds: [...this.props.includeIds],
      excludeIds: [...this.props.excludeIds],
      sectionsOrder: [...this.props.sectionsOrder],
      sectionsHidden: [...this.props.sectionsHidden],
    };
  }

  get id(): string {
    return this.props.id;
  }
  get slug(): string {
    return this.props.slug;
  }
  get title(): LocalizedText | string {
    return this.props.title;
  }
  get headline(): LocalizedText | string {
    return this.props.headline;
  }
  get description(): LocalizedText | string | null {
    return this.props.description;
  }
  get roleType(): LocalizedText | string | null {
    return this.props.roleType;
  }
  get techFocus(): string | null {
    return this.props.techFocus;
  }
  get filterTags(): readonly string[] {
    return this.props.filterTags;
  }
  get includeIds(): readonly string[] {
    return this.props.includeIds;
  }
  get excludeIds(): readonly string[] {
    return this.props.excludeIds;
  }
  get themeId(): string | null {
    return this.props.themeId;
  }
  get themeOverrides(): unknown {
    return this.props.themeOverrides;
  }
  get layout(): string {
    return this.props.layout;
  }
  get sectionsOrder(): readonly string[] {
    return this.props.sectionsOrder;
  }
  get sectionsHidden(): readonly string[] {
    return this.props.sectionsHidden;
  }
  get visibility(): CuratedVisibility {
    return this.props.visibility;
  }
  get accessToken(): AccessToken {
    return this.props.accessToken;
  }
  get archivedAt(): Date | null {
    return this.props.archivedAt ?? null;
  }
  get listed(): boolean {
    return this.props.listed ?? true;
  }
  get isArchived(): boolean {
    return this.archivedAt !== null;
  }
  get views(): number {
    return this.props.views;
  }
  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }
  get updatedAt(): Date | undefined {
    return this.props.updatedAt;
  }

  get isPublic(): boolean {
    return this.props.visibility === 'PUBLIC';
  }
  get isPrivate(): boolean {
    return this.props.visibility === 'PRIVATE';
  }
  get isProtected(): boolean {
    return this.props.visibility === 'PROTECTED';
  }

  /**
   * Regla de acceso, delegada en la tabla de verdad de `resolvability`: un
   * archivado nunca es accesible, PUBLIC siempre, PROTECTED con token coincidente
   * y PRIVATE nunca.
   */
  canAccess(candidateToken: string | null | undefined): boolean {
    return (
      resolvability(
        this.props.visibility,
        this.archivedAt,
        this.props.accessToken.matches(candidateToken),
      ) === 'ok'
    );
  }
}
