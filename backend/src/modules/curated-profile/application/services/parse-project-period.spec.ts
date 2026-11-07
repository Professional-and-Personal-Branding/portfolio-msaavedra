import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseProjectPeriod } from './parse-project-period';

const ISO8601 = /^([1-2][0-9]{3}-[0-1][0-9]-[0-3][0-9]|[1-2][0-9]{3}-[0-1][0-9]|[1-2][0-9]{3})$/;

describe('parseProjectPeriod', () => {
  it.each([
    ['2026', { startDate: '2026' }],
    ['2024-05', { startDate: '2024-05' }],
    ['2019 – 2022', { startDate: '2019', endDate: '2022' }],
    ['2019-2022', { startDate: '2019', endDate: '2022' }],
    ['2019 - 2022', { startDate: '2019', endDate: '2022' }],
    ['2021-03 — 2022-11', { startDate: '2021-03', endDate: '2022-11' }],
    ['2020 – actualidad', { startDate: '2020' }],
    ['2020 – present', { startDate: '2020' }],
    ['2019-13', { startDate: '2019' }],
    ['  2018  ', { startDate: '2018' }],
  ])('%s', (period, expected) => {
    expect(parseProjectPeriod(period)).toEqual(expected);
  });

  it.each([
    'Proyecto personal',
    '',
    'actualidad – 2020',
    '2019/2022',
    '19 – 22',
    '3000',
    'ca. 2019',
  ])('sin fechas: "%s"', (period) => {
    expect(parseProjectPeriod(period)).toEqual({});
  });

  it('los period reales del seed y del ejemplo solo producen fechas iso8601', () => {
    const docs = join(__dirname, '..', '..', '..', '..', '..', '..', 'docs');
    const files = ['cv-data.json', join('examples', 'cv-data.example.json')];
    const periods: string[] = [];
    for (const file of files) {
      const data = JSON.parse(readFileSync(join(docs, file), 'utf8')) as {
        projects?: { period: string }[];
      };
      periods.push(...(data.projects ?? []).map((project) => project.period));
    }
    expect(periods.length).toBeGreaterThan(0);
    for (const period of periods) {
      const { startDate, endDate } = parseProjectPeriod(period);
      for (const date of [startDate, endDate]) {
        if (date !== undefined) expect(date).toMatch(ISO8601);
      }
    }
  });
});
