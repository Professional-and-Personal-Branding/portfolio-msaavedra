// La función vive en `shared/domain` (decisión D15 de `add-application-tracking`) porque la usan
// dos módulos; se re-exporta aquí para no tocar las importaciones de `curated-profile`.
export { normalizeSource } from '../../../../shared/domain/normalize-source';
