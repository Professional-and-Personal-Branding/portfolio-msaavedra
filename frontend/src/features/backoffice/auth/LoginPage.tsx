import { LogIn } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { isHttpError } from '@/shared/lib/api-client';
import { useLogin, useSession } from './use-session';

interface LocationState {
  from?: string;
}

/** Login del backoffice (spec `admin-backoffice-shell`). El token nunca toca el almacenamiento. */
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useSession();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const destination = (location.state as LocationState | null)?.from ?? '/admin';

  if (session.data) return <Navigate to={destination} replace />;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate(
      { email: email.trim(), password },
      {
        onSuccess: () => {
          setPassword('');
          void navigate(destination, { replace: true });
        },
      },
    );
  };

  const message = login.isError
    ? isHttpError(login.error, 401)
      ? 'Email o contraseña incorrectos'
      : 'No pudimos contactar al servidor. Intentá de nuevo.'
    : null;

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="mb-4 inline-grid size-12 place-items-center rounded-full bg-brand-gradient text-brand-foreground">
            <LogIn className="size-5" aria-hidden />
          </span>
          <h1 className="text-2xl font-bold">Backoffice</h1>
          <p className="text-sm text-text-muted">Administración del portafolio</p>
        </div>

        <form onSubmit={handleSubmit} className="surface flex flex-col gap-4 p-card" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {message && (
            <p role="alert" className="text-sm text-destructive">
              {message}
            </p>
          )}

          <Button type="submit" disabled={login.isPending}>
            {login.isPending ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  );
}
