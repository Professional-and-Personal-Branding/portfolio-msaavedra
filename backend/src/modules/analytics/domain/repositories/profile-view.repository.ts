export const PROFILE_VIEW_REPOSITORY = Symbol('ProfileViewRepository');

/** Visita a registrar. Nunca contiene la IP en claro (solo `ipHash`). */
export interface NewProfileView {
  readonly curatedProfileId: string;
  readonly locale?: string;
  readonly referrer?: string;
  readonly userAgent?: string;
  readonly ipHash?: string;
}

/** Rango semiabierto: `from` inclusivo, `to` exclusivo. */
export interface DateRange {
  readonly from: Date;
  readonly to: Date;
}

export interface ProfileViewAggregate {
  readonly total: number;
  /** Ordenado por vistas descendente. */
  readonly byProfile: readonly { slug: string; views: number }[];
  readonly byLocale: readonly { locale: string; views: number }[];
  /** `day` en formato YYYY-MM-DD, ascendente. */
  readonly byDay: readonly { day: string; views: number }[];
}

export interface ProfileViewRepository {
  /** Crea la visita e incrementa `views` del perfil de forma atómica. */
  record(view: NewProfileView): Promise<void>;
  aggregate(range: DateRange): Promise<ProfileViewAggregate>;
}
