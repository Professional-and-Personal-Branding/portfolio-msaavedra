import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';
import { isSectionId, SECTION_IDS } from '../../../domain/services/resolve-sections';

function unknownIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === 'string' && !isSectionId(id));
}

/**
 * Array de ids del catálogo canónico de secciones. Un id desconocido se rechaza
 * y el mensaje lo nombra: nunca se descarta en silencio (spec
 * `admin-curated-profile-crud`, decisión D4 de `unify-section-catalog`).
 */
export function IsSectionIdList(options?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isSectionIdList',
      target: target.constructor,
      propertyName: propertyName.toString(),
      options,
      validator: {
        validate(value: unknown): boolean {
          return (
            Array.isArray(value) &&
            value.every((id) => typeof id === 'string') &&
            unknownIds(value).length === 0
          );
        },
        defaultMessage(args: ValidationArguments): string {
          if (!Array.isArray(args.value)) return `${args.property} must be an array`;
          const unknown = unknownIds(args.value);
          if (unknown.length === 0) return `${args.property} must contain only strings`;
          return (
            `${args.property} has unknown section ids: ${unknown.join(', ')}. ` +
            `Valid ids: ${SECTION_IDS.join(', ')}`
          );
        },
      },
    });
  };
}
