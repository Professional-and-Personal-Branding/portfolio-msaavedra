import { Route, Routes } from 'react-router';
import { TooltipProvider } from '@/shared/components/ui/tooltip';
import { LoginPage } from './auth/LoginPage';
import { RequireSession } from './auth/RequireSession';
import { AccountPage } from './account/AccountPage';
import { ApplicationsPage } from './applications/ApplicationsPage';
import { DashboardPage } from './dashboard/DashboardPage';
import { ExperiencesPage } from './experiences/ExperiencesPage';
import { FormacionPage } from './formacion/FormacionPage';
import { IntegrationsPage } from './integrations/IntegrationsPage';
import { PortadaPage } from './portada/PortadaPage';
import { JobPostingIntakePage } from './job-postings/JobPostingIntakePage';
import { ProfileBuilderPage } from './curated-profiles/ProfileBuilderPage';
import { ProfilesPage } from './curated-profiles/ProfilesPage';
import { ProyectosPage } from './proyectos/ProyectosPage';
import { RevisionPage } from './revision/RevisionPage';
import { AdminLayout, AdminShell } from './shared/AdminShell';
import { SkillsPage } from './skills/SkillsPage';

/** Rutas del backoffice, montadas bajo `/admin/*` con carga diferida. */
export function BackofficeApp() {
  return (
    <TooltipProvider delayDuration={200}>
      <AdminShell>
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route
            path="*"
            element={
              <RequireSession>
                <AdminLayout>
                  <Routes>
                    <Route index element={<DashboardPage />} />
                    <Route path="cuenta" element={<AccountPage />} />
                    <Route path="portada" element={<PortadaPage />} />
                    <Route path="experiencias" element={<ExperiencesPage />} />
                    <Route path="skills" element={<SkillsPage />} />
                    <Route path="formacion" element={<FormacionPage />} />
                    <Route path="proyectos" element={<ProyectosPage />} />
                    <Route path="perfiles" element={<ProfilesPage />} />
                    <Route path="perfiles/desde-vacante" element={<JobPostingIntakePage />} />
                    <Route path="perfiles/:id" element={<ProfileBuilderPage />} />
                    <Route path="postulaciones" element={<ApplicationsPage />} />
                    <Route path="revision" element={<RevisionPage />} />
                    {/* Sin ítem en la barra (D25 de `add-integrations-foundation`): se llega desde Cuenta y desde el aviso del Dashboard. */}
                    <Route path="integraciones" element={<IntegrationsPage />} />
                  </Routes>
                </AdminLayout>
              </RequireSession>
            }
          />
        </Routes>
      </AdminShell>
    </TooltipProvider>
  );
}

export default BackofficeApp;
