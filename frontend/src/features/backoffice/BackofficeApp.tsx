import { Route, Routes } from 'react-router';
import { TooltipProvider } from '@/shared/components/ui/tooltip';
import { LoginPage } from './auth/LoginPage';
import { RequireSession } from './auth/RequireSession';
import { DashboardPage } from './dashboard/DashboardPage';
import { ExperiencesPage } from './experiences/ExperiencesPage';
import { FormacionPage } from './formacion/FormacionPage';
import { PortadaPage } from './portada/PortadaPage';
import { ProfileBuilderPage } from './curated-profiles/ProfileBuilderPage';
import { ProfilesPage } from './curated-profiles/ProfilesPage';
import { ProyectosPage } from './proyectos/ProyectosPage';
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
                    <Route path="portada" element={<PortadaPage />} />
                    <Route path="experiencias" element={<ExperiencesPage />} />
                    <Route path="skills" element={<SkillsPage />} />
                    <Route path="formacion" element={<FormacionPage />} />
                    <Route path="proyectos" element={<ProyectosPage />} />
                    <Route path="perfiles" element={<ProfilesPage />} />
                    <Route path="perfiles/:id" element={<ProfileBuilderPage />} />
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
