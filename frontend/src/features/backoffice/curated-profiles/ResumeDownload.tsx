import { Download } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { API_BASE_URL } from '@/shared/lib/api-client';

const LOCALES = [
  { locale: 'es', label: 'ES', name: 'español' },
  { locale: 'en', label: 'EN', name: 'inglés' },
] as const;

interface ResumeDownloadProps {
  /** `undefined` = perfil sin guardar. */
  profile: { id: string; slug: string } | undefined;
  /** Hay cambios sin guardar en el borrador: la exportación usa la última versión guardada. */
  dirty: boolean;
}

/**
 * «Descargar JSON Resume» (D8 de `add-json-resume-export`): dos enlaces, uno por idioma, a la
 * exportación del panel por id. Funciona para cualquier visibilidad (también un perfil privado,
 * sin token en la URL) porque la sesión viaja en la cookie del mismo origen. La vista pública no
 * ofrece este botón.
 */
export function ResumeDownload({ profile, dirty }: ResumeDownloadProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label id="descargar-json-resume">Descargar JSON Resume</Label>
      <div
        role="group"
        aria-labelledby="descargar-json-resume"
        className="flex flex-wrap items-center gap-2"
      >
        {LOCALES.map(({ locale, label, name }) =>
          profile ? (
            <Button key={locale} asChild variant="outline" size="sm">
              <a
                href={`${API_BASE_URL}/api/admin/curated-profiles/${encodeURIComponent(profile.id)}/resume.json?locale=${locale}`}
                download={`${profile.slug}.${locale}.resume.json`}
                aria-label={`Descargar JSON Resume en ${name}`}
              >
                <Download aria-hidden />
                {label}
              </a>
            </Button>
          ) : (
            <Button
              key={locale}
              type="button"
              variant="outline"
              size="sm"
              disabled
              aria-label={`Descargar JSON Resume en ${name}`}
            >
              <Download aria-hidden />
              {label}
            </Button>
          ),
        )}
      </div>
      <p role="status" className="text-xs text-text-dim">
        {profile
          ? dirty
            ? 'Se exporta la última versión guardada'
            : 'Un archivo por idioma, con lo que muestra la página del perfil.'
          : 'Guardá el perfil para exportarlo'}
      </p>
    </div>
  );
}
