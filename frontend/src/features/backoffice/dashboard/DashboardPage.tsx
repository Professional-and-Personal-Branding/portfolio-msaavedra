import { Eye, Globe, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Badge } from '@/shared/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { profilePath } from '@/shared/lib/profile-link';
import { PageHeader } from '../shared/PageHeader';
import { EmptyState, ErrorPanel, LoadingRows } from '../shared/states';
import { useAnalytics, useCuratedProfilesAdmin } from '../shared/use-admin-api';
import type { ProfileViews } from '../shared/admin-types';
import { DEFAULT_RANGE_DAYS, formatDay, RANGE_OPTIONS, rangeOfDays } from './ranges';

/** Dashboard de visitas (spec `admin-analytics-dashboard`). Gráficos propios, sin librería. */
export function DashboardPage() {
  const [days, setDays] = useState<string>(DEFAULT_RANGE_DAYS);
  const range = useMemo(() => rangeOfDays(Number(days)), [days]);
  const analytics = useAnalytics(range.from, range.to);
  const profiles = useCuratedProfilesAdmin();

  const profileBySlug = useMemo(() => {
    const map = new Map<string, { id: string; archived: boolean }>();
    for (const profile of profiles.data ?? []) {
      map.set(profile.slug, { id: profile.id, archived: profile.archivedAt !== null });
    }
    return map;
  }, [profiles.data]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Visitas de personas en las vistas públicas de los perfiles curados. Las tuyas y las de bots se cuentan aparte, en «Por tipo»."
        actions={
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-48" aria-label="Rango de fechas">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {analytics.isPending && <LoadingRows rows={3} />}
      {analytics.isError && (
        <ErrorPanel message={analytics.error.message} onRetry={() => void analytics.refetch()} />
      )}

      {analytics.data && (
        <div className="flex flex-col gap-6">
          <section aria-label="Totales" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard icon={Eye} label="Visitas en el rango" value={analytics.data.total} />
            <StatCard
              icon={Users}
              label="Perfiles vistos"
              value={analytics.data.byProfile.length}
            />
            <StatCard icon={Globe} label="Idiomas" value={analytics.data.byLocale.length} />
          </section>

          {analytics.data.total === 0 ? (
            <>
              <EmptyState
                title="Todavía no hay visitas"
                description="Cuando alguien abra un perfil curado en el rango elegido, aparecerá acá."
              />
              {/* Con visitas propias o de bots el desglose igual explica por qué el total es 0. */}
              {hasAnyKind(analytics.data.byKind) && <KindTable byKind={analytics.data.byKind} />}
            </>
          ) : (
            <>
              <section aria-labelledby="por-dia" className="surface p-card">
                <h2 id="por-dia" className="mb-4 font-semibold">
                  Visitas por día
                </h2>
                <DayBars data={analytics.data.byDay} />
              </section>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <section aria-labelledby="por-perfil" className="surface p-card">
                  <h2 id="por-perfil" className="mb-4 font-semibold">
                    Por perfil
                  </h2>
                  <ol className="flex flex-col gap-2">
                    {[...analytics.data.byProfile]
                      .sort((a, b) => b.views - a.views)
                      .map((row) => {
                        // Un archivado conserva sus visitas y sigue en la tabla, marcado
                        // (add-curated-profile-lifecycle, D8). Su link público ya no resuelve.
                        const known = profileBySlug.get(row.slug);
                        const id = known?.id;
                        return (
                          <li key={row.slug} className="flex items-center gap-3">
                            <span className="min-w-0 flex-1 truncate text-sm">
                              {id ? (
                                <Link
                                  to={`/admin/perfiles/${id}`}
                                  className="hover:text-brand-ink hover:underline"
                                >
                                  {row.slug}
                                </Link>
                              ) : (
                                row.slug
                              )}
                              {known?.archived && (
                                <Badge variant="outline" className="ml-2 text-text-muted">
                                  archivado
                                </Badge>
                              )}
                            </span>
                            {!known?.archived && (
                              <Link
                                to={profilePath(row.slug)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-text-dim hover:text-brand-ink"
                              >
                                ver
                              </Link>
                            )}
                            <span className="w-10 text-right text-sm font-semibold tabular-nums">
                              {row.views}
                            </span>
                          </li>
                        );
                      })}
                  </ol>
                </section>

                <section aria-labelledby="por-idioma" className="surface p-card">
                  <h2 id="por-idioma" className="mb-4 font-semibold">
                    Por idioma
                  </h2>
                  <ul className="flex flex-col gap-2">
                    {analytics.data.byLocale.map((row) => (
                      <li key={row.locale} className="flex items-center gap-3">
                        <span className="flex-1 text-sm uppercase">{row.locale}</span>
                        <span className="text-sm font-semibold tabular-nums">{row.views}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>

              {/* add-profile-content-admin, D5: el host del referrer, o directo / interno. */}
              <section aria-labelledby="por-origen" className="surface p-card">
                <h2 id="por-origen" className="mb-1 font-semibold">
                  Por origen
                </h2>
                <p className="mb-4 text-xs text-text-dim">
                  De dónde llegó cada visita. «directo» es sin referencia (un link pegado, un
                  correo); «interno» es navegación dentro del propio sitio.
                </p>
                <ol className="flex flex-col gap-2">
                  {[...analytics.data.byReferrer]
                    .sort((a, b) => b.views - a.views)
                    .map((row) => (
                      <li key={row.referrer} className="flex items-center gap-3">
                        <span className="min-w-0 flex-1 truncate text-sm">{row.referrer}</span>
                        <span className="w-10 text-right text-sm font-semibold tabular-nums">
                          {row.views}
                        </span>
                      </li>
                    ))}
                </ol>
              </section>

              <KindTable byKind={analytics.data.byKind} />
            </>
          )}
        </div>
      )}
    </>
  );
}

/** Etiqueta de cada tipo de visita; el `Record` obliga a cubrir los tres (change classify-profile-views). */
const KIND_LABELS: Record<ProfileViews['byKind'][number]['kind'], string> = {
  HUMAN: 'Personas',
  OWNER: 'Tus visitas',
  BOT: 'Bots',
};

const hasAnyKind = (byKind: ProfileViews['byKind']): boolean => byKind.some((row) => row.views > 0);

/** classify-profile-views, D8: cuántas visitas hubo de cada tipo y cuáles suman en el total. */
function KindTable({ byKind }: { byKind: ProfileViews['byKind'] }) {
  return (
    <section aria-labelledby="por-tipo" className="surface p-card">
      <h2 id="por-tipo" className="mb-1 font-semibold">
        Por tipo
      </h2>
      <p className="mb-4 text-xs text-text-dim">
        Solo las visitas de personas suman en el total y en las visitas de cada perfil. Las tuyas se
        reconocen por la sesión del panel; los bots, por su navegador.
      </p>
      <ul className="flex flex-col gap-2">
        {byKind.map((row) => (
          <li key={row.kind} className="flex items-center gap-3">
            <span className="min-w-0 flex-1 truncate text-sm">{KIND_LABELS[row.kind]}</span>
            <span className="w-10 text-right text-sm font-semibold tabular-nums">{row.views}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: number;
}) {
  return (
    <div className="surface flex items-center gap-4 p-card">
      <span className="grid size-10 shrink-0 place-items-center rounded-theme-sm bg-bg-soft text-brand-ink">
        <Icon className="size-5" aria-hidden />
      </span>
      <div>
        <p className="text-2xl font-extrabold text-gradient">{value}</p>
        <p className="text-xs text-text-dim">{label}</p>
      </div>
    </div>
  );
}

/** Alto proporcional de la barra; mínimo visible (4 %) si hay visitas, 0 si no. */
function barPercent(views: number, max: number): number {
  return views > 0 ? Math.max(4, (views / max) * 100) : 0;
}

/** Barras verticales con la cifra siempre disponible como texto (accesibilidad). */
function DayBars({ data }: { data: { day: string; views: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.views));
  return (
    <ol className="flex h-40 items-stretch gap-1 overflow-x-auto pb-1">
      {data.map((row) => (
        <li
          key={row.day}
          className="flex h-full min-w-4 flex-1 flex-col items-center gap-1"
          title={`${formatDay(row.day)}: ${row.views}`}
        >
          <span className="text-[10px] text-text-dim tabular-nums">{row.views}</span>
          {/* El alto de la barra es un % de este contenedor (definido por flex-1). */}
          <div className="relative min-h-0 w-full flex-1" data-testid="day-bar-track">
            <div
              role="img"
              aria-label={`${formatDay(row.day)}: ${row.views} visitas`}
              className="absolute inset-x-0 bottom-0 rounded-t-sm bg-brand-gradient"
              style={{ height: `${barPercent(row.views, max)}%` }}
            />
          </div>
          <span className="text-[10px] whitespace-nowrap text-text-dim">{formatDay(row.day)}</span>
        </li>
      ))}
    </ol>
  );
}
