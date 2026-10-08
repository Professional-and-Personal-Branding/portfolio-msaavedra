import { ApiProperty } from '@nestjs/swagger';
import {
  MissingTranslation,
  MissingTranslationEntity,
} from '../../../application/services/detect-missing-translations';
import { PreviewCuratedProfileOutput } from '../../../application/use-cases/admin/preview-curated-profile.use-case';
import { CuratedProfileResponse } from './curated-profile.response';

const MISSING_TRANSLATION_ENTITIES: MissingTranslationEntity[] = [
  'curatedProfile',
  'profile',
  'experience',
  'skillCategory',
  'project',
  'education',
  'certification',
  'socialLink',
];

export class MissingTranslationResponse implements MissingTranslation {
  @ApiProperty({ enum: MISSING_TRANSLATION_ENTITIES, example: 'experience' })
  entity!: MissingTranslationEntity;

  @ApiProperty({ description: 'Id de la entidad (en el perfil curado en borrador: `preview`).' })
  id!: string;

  @ApiProperty({ description: 'Campo bilingüe; los anidados con punto.', example: 'highlights' })
  field!: string;
}

/** Cuerpo del preview: la vista resuelta de la ruta pública más el informe de faltantes. */
export class PreviewCuratedProfileResponse
  extends CuratedProfileResponse
  implements PreviewCuratedProfileOutput
{
  @ApiProperty({
    type: [MissingTranslationResponse],
    description:
      'Campos bilingües vacíos en el idioma del preview que caen al fallback. ' +
      'Solo existe en el preview; la ruta pública no lo expone.',
  })
  missingTranslations!: MissingTranslationResponse[];
}
