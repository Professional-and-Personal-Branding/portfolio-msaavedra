import * as fs from 'fs';
import * as path from 'path';
import { computeYearsOfExperience, ExperienceInterval } from './compute-years-of-experience';

const closed = (startDate: string, endDate: string): ExperienceInterval => ({
  startDate,
  endDate,
  current: false,
});
const ongoing = (startDate: string): ExperienceInterval => ({
  startDate,
  endDate: null,
  current: true,
});

describe('computeYearsOfExperience', () => {
  it('fusiona solapados y contiguos: 35 meses = 2 años y 11 meses', () => {
    const result = computeYearsOfExperience(
      [closed('2018-02', '2019-04'), closed('2019-01', '2020-07'), closed('2020-08', '2020-12')],
      '2026-11',
    );
    expect(result).toEqual({ months: 35, years: 2, remainderMonths: 11 });
  });

  it('una experiencia actual termina en asOf: 23 meses', () => {
    expect(computeYearsOfExperience([ongoing('2025-01')], '2026-11').months).toBe(23);
  });

  it('un intervalo sin endDate también llega hasta asOf', () => {
    const open: ExperienceInterval = { startDate: '2026-01', endDate: null, current: false };
    expect(computeYearsOfExperience([open], '2026-03').months).toBe(3);
  });

  it('cuenta los dos extremos: un solo mes vale 1', () => {
    expect(computeYearsOfExperience([closed('2021-06', '2021-06')], '2026-11').months).toBe(1);
    expect(computeYearsOfExperience([closed('2018-02', '2019-04')], '2026-11').months).toBe(15);
  });

  it('un intervalo anidado en otro no suma', () => {
    const result = computeYearsOfExperience(
      [closed('2019-01', '2022-12'), closed('2020-03', '2021-02')],
      '2026-11',
    );
    expect(result.months).toBe(48);
  });

  it('dos tramos separados por un mes vacío suman por separado', () => {
    const result = computeYearsOfExperience(
      [closed('2020-01', '2020-03'), closed('2020-05', '2020-06')],
      '2026-11',
    );
    expect(result.months).toBe(5);
  });

  it('ignora una fecha inválida', () => {
    const withBadStart = [closed('2024-13', '2025-01'), closed('2020-01', '2020-12')];
    expect(computeYearsOfExperience(withBadStart, '2026-11').months).toBe(12);
    const withBadEnd = [closed('2020-01', 'dic-2020'), closed('2021-01', '2021-02')];
    expect(computeYearsOfExperience(withBadEnd, '2026-11').months).toBe(2);
  });

  it('ignora un fin anterior al inicio', () => {
    expect(computeYearsOfExperience([closed('2022-05', '2021-01')], '2026-11').months).toBe(0);
  });

  it('ignora lo que empieza después de asOf y recorta el fin futuro', () => {
    expect(computeYearsOfExperience([closed('2027-01', '2027-06')], '2026-11').months).toBe(0);
    expect(computeYearsOfExperience([closed('2026-09', '2027-06')], '2026-11').months).toBe(3);
  });

  it('current gana sobre un endDate cargado por error', () => {
    const odd: ExperienceInterval = { startDate: '2026-01', endDate: '2026-02', current: true };
    expect(computeYearsOfExperience([odd], '2026-11').months).toBe(11);
  });

  it('una lista vacía y un asOf inválido dan 0', () => {
    expect(computeYearsOfExperience([], '2026-11')).toEqual({
      months: 0,
      years: 0,
      remainderMonths: 0,
    });
    expect(computeYearsOfExperience([ongoing('2020-01')], 'ayer').months).toBe(0);
  });

  it('no muta la entrada', () => {
    const input = [closed('2019-01', '2019-12'), closed('2018-01', '2018-12')];
    const copy = JSON.stringify(input);
    computeYearsOfExperience(input, '2026-11');
    expect(JSON.stringify(input)).toBe(copy);
  });

  it('las experiencias de docs/cv-data.json suman 103 meses con asOf 2026-11', () => {
    const file = path.resolve(__dirname, '../../../../../../docs/cv-data.json');
    const seed = JSON.parse(fs.readFileSync(file, 'utf-8')) as {
      experiences: ExperienceInterval[];
    };
    expect(computeYearsOfExperience(seed.experiences, '2026-11')).toEqual({
      months: 103,
      years: 8,
      remainderMonths: 7,
    });
  });
});
