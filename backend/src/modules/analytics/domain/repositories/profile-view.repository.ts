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

export interface ProfileViewRepository {
  /** Crea la visita y, solo si es `HUMAN`, incrementa `views` del perfil de forma atómica. */
  record(view: NewProfileView): Promise<void>;
  /** Total y desgloses de las visitas `HUMAN` del rango. */
  aggregate(range: DateRange): Promise<ProfileViewAggregate>;
  /** Visitas `HUMAN` del rango agrupadas por `referrer` crudo. */
  countByReferrer(range: DateRange): Promise<ReferrerCount[]>;
  /** Todas las visitas del rango agrupadas por tipo; los tipos sin filas pueden faltar. */
  countByKind(range: DateRange): Promise<KindCount[]>;
}
