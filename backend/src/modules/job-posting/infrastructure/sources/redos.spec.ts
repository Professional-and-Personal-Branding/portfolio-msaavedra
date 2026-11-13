import { htmlToText, MAX_HTML_INPUT_LENGTH } from '../../domain/services/html-to-text';
import { FakeSafeHttpClient } from './job-posting-source.contract.fixture';
import { extractLdJsonBlocks, JsonLdJobPostingSource } from './json-ld-job-posting.source';

/**
 * Tiempo, no solo resultado: el HTML remoto llega hasta 2 MiB y el código síncrono no se corta
 * con el AbortSignal. Con las regex anteriores, 100 KB de `<a ` tardaban unos 4 s (cuadrático).
 * El umbral es holgado para el CI; lo medido es de unos pocos ms.
 */
const TWO_MIB = 2 * 1024 * 1024;
const LIMIT_MS = 500;
const repeat = (unit: string): string => unit.repeat(Math.ceil(TWO_MIB / unit.length));

const PATHOLOGICAL: Array<[string, string]> = [
  ['<a  repetido', repeat('<a ')],
  ['<script sin cierre', repeat('<script ')],
  ['<!-- sin cierre', repeat('<!-- ')],
  ['<style sin cierre', repeat('<style ')],
  ['<script> sin cierre', repeat('<script>x')],
  ['<ul><li> sin cerrar', repeat('<li>')],
  ['saltos de bloque', repeat('</p>')],
];

function elapsed(fn: () => unknown): number {
  const started = performance.now();
  fn();
  return performance.now() - started;
}

describe('htmlToText y JSON-LD con entradas patológicas de 2 MiB', () => {
  it.each(PATHOLOGICAL)('htmlToText: %s', (_name, input) => {
    expect(input.length).toBeGreaterThanOrEqual(TWO_MIB);
    expect(elapsed(() => htmlToText(input))).toBeLessThan(LIMIT_MS);
  });

  it.each(PATHOLOGICAL)('extractLdJsonBlocks: %s', (_name, input) => {
    expect(elapsed(() => extractLdJsonBlocks(input))).toBeLessThan(LIMIT_MS);
  });

  it.each(PATHOLOGICAL)('JsonLdJobPostingSource.fetch: %s', async (_name, input) => {
    const url = 'https://careers.acme-ejemplo.com/jobs/1';
    const source = new JsonLdJobPostingSource(new FakeSafeHttpClient({ [url]: input }));
    const started = performance.now();
    const result = await source.fetch(new URL(url), AbortSignal.timeout(5000));
    expect(performance.now() - started).toBeLessThan(LIMIT_MS);
    expect(!result.ok && result.error.reason).toBe('no-posting-found');
  });

  it('un JobPosting válido al final de 2 MiB de relleno se encuentra', () => {
    const block = '<script type="application/ld+json">{"@type":"JobPosting","title":"T"}</script>';
    const html = `${'<p>x</p>'.repeat(10_000)}${block}`;
    expect(extractLdJsonBlocks(html)).toEqual(['{"@type":"JobPosting","title":"T"}']);
  });

  it('la descripción de una vacante enorme se corta a la entrada máxima y sale en tiempo', () => {
    const description = `<p>${'palabra '.repeat(400_000)}</p>`;
    let text = '';
    expect(elapsed(() => (text = htmlToText(description)))).toBeLessThan(LIMIT_MS);
    expect(text.length).toBeLessThanOrEqual(MAX_HTML_INPUT_LENGTH);
  });

  it('el resultado funcional no cambia: script sin cierre descarta el resto, etiquetas y texto se conservan', () => {
    expect(htmlToText('Hola <script>alert(1)')).toBe('Hola');
    expect(htmlToText('a<!-- sin cierre')).toBe('a');
    expect(htmlToText('<p>x</p><style>.a{}')).toBe('x');
    expect(htmlToText('si a < b y c > d')).toBe('si a < b y c > d');
    expect(htmlToText('<a href="x">uno</a> <b>dos</b>')).toBe('uno dos');
    expect(htmlToText('<SCRIPT>x</SCRIPT >fin')).toBe('fin');
  });

  it('un <script> con una etiqueta rota por un `<` no traga el resto', () => {
    expect(htmlToText('<a <b>texto</b>')).toBe('<a texto');
  });
});
