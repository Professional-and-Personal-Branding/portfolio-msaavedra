import { Logger } from '@nestjs/common';
import type { Theme as ThemeRecord } from '@prisma/client';
import { Theme, ThemeTokens } from '../../domain/entities/theme.entity';
import { isPlainObject } from '../../domain/services/merge-theme-tokens';

export type { ThemeRecord };

const logger = new Logger('ThemePrismaMapper');

export function toThemeEntity(record: ThemeRecord): Theme {
  let tokens: ThemeTokens = {};
  if (isPlainObject(record.tokens)) {
    tokens = record.tokens;
  } else {
    logger.warn(`Theme "${record.slug}" con tokens de forma inesperada; se usa {}`);
  }
  return Theme.create({
    id: record.id,
    name: record.name,
    slug: record.slug,
    isPreset: record.isPreset,
    tokens,
  });
}
