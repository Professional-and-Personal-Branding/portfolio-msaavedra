import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { LocalizedListDto, LocalizedTextDto, toLocalizedText } from './localized.dto';

describe('LocalizedTextDto', () => {
  it('acepta es solo y es+en', () => {
    expect(validateSync(plainToInstance(LocalizedTextDto, { es: 'Hola' }))).toHaveLength(0);
    expect(
      validateSync(plainToInstance(LocalizedTextDto, { es: 'Hola', en: 'Hello' })),
    ).toHaveLength(0);
  });

  it('rechaza sin es o con tipos incorrectos', () => {
    expect(validateSync(plainToInstance(LocalizedTextDto, { en: 'Hello' }))).not.toHaveLength(0);
    expect(validateSync(plainToInstance(LocalizedTextDto, { es: 1 }))).not.toHaveLength(0);
  });

  it('toLocalizedText omite en cuando no viene', () => {
    expect(toLocalizedText(plainToInstance(LocalizedTextDto, { es: 'Hola' }))).toEqual({
      es: 'Hola',
    });
  });
});

describe('LocalizedListDto', () => {
  it('acepta arrays de strings y rechaza otros', () => {
    expect(validateSync(plainToInstance(LocalizedListDto, { es: ['a'] }))).toHaveLength(0);
    expect(validateSync(plainToInstance(LocalizedListDto, { es: 'a' }))).not.toHaveLength(0);
    expect(validateSync(plainToInstance(LocalizedListDto, { es: [1] }))).not.toHaveLength(0);
  });
});
