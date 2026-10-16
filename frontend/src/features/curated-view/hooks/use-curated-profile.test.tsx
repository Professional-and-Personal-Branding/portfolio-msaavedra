import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { makeCuratedProfile } from '@/test/fixtures/curated-profile';
import { API, http, HttpResponse, server } from '@/test/msw';
import { useCuratedProfile, type CuratedProfileState } from './use-curated-profile';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: Infinity } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function serve() {
  server.use(
    http.get(`${API}/curated-profiles/:slug`, ({ params, request }) =>
      HttpResponse.json(
        makeCuratedProfile({
          slug: String(params.slug),
          title: new URL(request.url).searchParams.get('locale') ?? '',
        }),
      ),
    ),
  );
}

// D2 de `improve-mobile-performance`: el render que depende de los datos va con valor diferido.
describe('useCuratedProfile — valor diferido', () => {
  it('mientras la consulta tiene datos y el diferido no llegó, sigue en loading (nunca error)', async () => {
    serve();
    const states: CuratedProfileState[] = [];
    const { result } = renderHook(
      (props: { slug: string }) => {
        const state = useCuratedProfile(props.slug, { locale: 'es', token: null });
        states.push(state);
        return state;
      },
      { wrapper: wrapper(), initialProps: { slug: 'demo' } },
    );

    await waitFor(() => expect(result.current.status).toBe('success'));

    expect(states[0]?.status).toBe('loading');
    expect(states.map((s) => s.status).every((s) => s === 'loading' || s === 'success')).toBe(true);
  });

  it('al cambiar de slug no devuelve el perfil del anterior mientras se pone al día', async () => {
    serve();
    const states: CuratedProfileState[] = [];
    const { result, rerender } = renderHook(
      (props: { slug: string }) => {
        const state = useCuratedProfile(props.slug, { locale: 'es', token: null });
        states.push(state);
        return state;
      },
      { wrapper: wrapper(), initialProps: { slug: 'a' } },
    );
    await waitFor(() => expect(result.current.status).toBe('success'));
    states.length = 0;

    rerender({ slug: 'b' });
    await waitFor(() => {
      expect(result.current.status).toBe('success');
      expect(result.current.status === 'success' && result.current.data.slug).toBe('b');
    });

    for (const state of states) {
      if (state.status === 'success') expect(state.data.slug).toBe('b');
    }
  });

  it('al cambiar el idioma del mismo slug conserva el perfil anterior (placeholderData)', async () => {
    serve();
    const states: CuratedProfileState[] = [];
    const { result, rerender } = renderHook(
      (props: { locale: 'es' | 'en' }) => {
        const state = useCuratedProfile('demo', { locale: props.locale, token: null });
        states.push(state);
        return state;
      },
      { wrapper: wrapper(), initialProps: { locale: 'es' as 'es' | 'en' } },
    );
    await waitFor(() => expect(result.current.status).toBe('success'));
    states.length = 0;

    rerender({ locale: 'en' });
    await waitFor(() => {
      expect(result.current.status === 'success' && result.current.data.title).toBe('en');
    });

    expect(states.every((state) => state.status === 'success')).toBe(true);
  });
});
