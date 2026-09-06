/** Design tokens: objeto JSON plano y anidado (colors, typography, layout, effects…). */
export type ThemeTokens = Record<string, unknown>;

export interface ThemeProps {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly isPreset: boolean;
  readonly tokens: ThemeTokens;
}

export class Theme {
  private constructor(private readonly props: ThemeProps) {}

  static create(props: ThemeProps): Theme {
    return new Theme({ ...props, tokens: structuredClone(props.tokens) });
  }

  get id(): string {
    return this.props.id;
  }
  get name(): string {
    return this.props.name;
  }
  get slug(): string {
    return this.props.slug;
  }
  get isPreset(): boolean {
    return this.props.isPreset;
  }
  /** Copia defensiva: los tokens del tema nunca se mutan desde afuera. */
  get tokens(): ThemeTokens {
    return structuredClone(this.props.tokens);
  }
}
