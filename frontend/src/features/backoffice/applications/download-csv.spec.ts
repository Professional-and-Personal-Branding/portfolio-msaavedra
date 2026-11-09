import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isHttpError } from '@/shared/lib/api-client';
import { downloadApplicationsCsv, exportUrl, filenameFromDisposition } from './download-csv';

function csvResponse(disposition: string | null, status = 200): Response {
  return new Response('﻿"Empresa"', {
    status,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      ...(disposition ? { 'Content-Disposition': disposition } : {}),
    },
  });
}

describe('download-csv (D11)', () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createObjectURL = vi.fn(() => 'blob:fake');
    revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('toma el nombre del archivo de Content-Disposition y libera el objeto URL', async () => {
    fetchMock.mockResolvedValue(csvResponse('attachment; filename="postulaciones-2026-11-20.csv"'));
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    let downloaded = '';
    const original = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const element = original(tag);
      if (tag === 'a') {
        Object.defineProperty(element, 'download', {
          set: (value: string) => {
            downloaded = value;
          },
          get: () => downloaded,
        });
      }
      return element;
    });

    const name = await downloadApplicationsCsv(['APPLIED', 'INTERVIEWING']);

    expect(name).toBe('postulaciones-2026-11-20.csv');
    expect(downloaded).toBe('postulaciones-2026-11-20.csv');
    expect(click).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/applications/export?status=APPLIED,INTERVIEWING'),
      { credentials: 'include' },
    );
  });

  it('un error 500 rechaza sin crear el objeto URL ni descargar nada', async () => {
    fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    const failure = await downloadApplicationsCsv(undefined).catch((error: unknown) => error);

    expect(isHttpError(failure, 500)).toBe(true);
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  });

  it('un 401 rechaza con HttpError 401 (la página invalida la sesión)', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 401 }));
    const failure = await downloadApplicationsCsv(undefined).catch((error: unknown) => error);
    expect(isHttpError(failure, 401)).toBe(true);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('sin Content-Disposition usa un nombre por omisión', () => {
    expect(filenameFromDisposition(null)).toBe('postulaciones.csv');
    expect(filenameFromDisposition('attachment')).toBe('postulaciones.csv');
  });

  it('la URL del export lleva el filtro, y «todas» no lleva parámetro', () => {
    expect(exportUrl(['DRAFT', 'APPLIED', 'INTERVIEWING', 'OFFER'])).toMatch(
      /\/api\/admin\/applications\/export\?status=DRAFT,APPLIED,INTERVIEWING,OFFER$/,
    );
    expect(exportUrl(undefined)).toMatch(/\/api\/admin\/applications\/export$/);
  });
});
