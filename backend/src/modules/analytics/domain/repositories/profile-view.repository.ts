import { ViewKind } from '../view-kind';

export const PROFILE_VIEW_REPOSITORY = Symbol('ProfileViewRepository');

/** Visita a registrar. Nunca contiene la IP en claro (solo `ipHash`). */
export interface NewProfileView {
  readonly curatedProfileId: string;
  readonly locale?: string;
  readonly referrer?: string;
  readonly userAgent?: string;
  readonly ipHash?: string;
  /** Tipo de la visita (D1): solo `HUMAN` incrementa `views`. */
  readonly kind: ViewKind;
  /** Enlace de seguimiento atribuido (activo y del mismo perfil), o nulo (D7 de `add-share-links`). */
  readonly shareLinkId?: string | null;
  /** Portal efectivo: el del enlace atribuido o el `?src=` normalizado. */
  readonly source?: string | null;
}

export interface DateRange {
  readonly from: Date;
  readonly to: Date;
}

/** Cantidad de visitas de un tipo en un rango. */
export interface KindCount {
  readonly kind: ViewKind;
  readonly views: number;
}

/** Cuenta solo las visitas `HUMAN` (decisión P19 del owner). */
export interface ProfileViewAggregate {
  readonly total: number;
  /** Ordenado por vistas descendente. */
  readonly byProfile: readonly { slug: string; views: number }[];
  readonly byLocale: readonly { locale: string; views: number }[];
  /** `day` en formato YYYY-MM-DD, ascendente. */
  readonly byDay: readonly { day: string; views: number }[];
}

/** Conteo por `referrer` tal como se guardó (sin normalizar: eso es del dominio). */
export interface ReferrerCount {
  readonly referrer: string | null;
  readonly views: number;
}

/** Visitas `HUMAN` del rango atribuidas a un enlace de seguimiento. */
export interface ShareLinkCount {
  readonly shareLinkId: string;
  readonly code: string;
  readonly label: string;
  readonly slug: string;
  readonly portal: string | null;
  readonly revoked: boolean;
  readonly views: number;
}

/** Visitas `HUMAN` del rango con un portal (`source`). */
export interface SourceCount {
  readonly source: string;
  readonly views: number;
}

/** Aperturas `HUMAN` de un enlace en toda su historia. */
export interface ShareLinkOpens {
  readonly shareLinkId: string;
  readonly opens: number;
  /** Primera apertura `HUMAN` (D8 de `add-application-tracking`); `null` sin aperturas. */
  readonly firstOpenedAt: Date | null;
  readonly lastOpenedAt: Date | null;
}

export interface ProfileViewRepository {
  /** Crea la visita y, solo si es `HUMAN`, incrementa `views` del perfil de forma atómica. */
  record(view: NewProfileView): Promise<void>;
  /** Total y desgloses de las visitas `HUMAN` del rango. */
  aggregate(range: DateRange): Promise<ProfileViewAggregate>;
  /** Visitas `HUMAN` del rango agrupadas por `referrer` crudo. */
  countByReferrer(range: DateRange): Promise<ReferrerCount[]>;
  /** Todas las visitas del rango agrupadas por tipo; los tipos sin filas pueden faltar. */
  countByKind(range: DateRange): Promise<KindCount[]>;
  /**
   * Visitas `HUMAN` del rango con `shareLinkId`, por enlace (con su código, etiqueta, slug, portal y
   * si está revocado); visitas descendente y, a igualdad, por etiqueta.
   */
  countByShareLink(range: DateRange): Promise<ShareLinkCount[]>;
  /** Visitas `HUMAN` del rango con `source`, descendente. */
  countBySource(range: DateRange): Promise<SourceCount[]>;
  /**
   * Aperturas `HUMAN`, primera y última apertura de cada enlace pedido, en toda su historia. Los enlaces
   * sin aperturas pueden faltar en el resultado.
   */
  countOpensByShareLink(shareLinkIds: readonly string[]): Promise<ShareLinkOpens[]>;
}
