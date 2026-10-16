import { StrictMode, startTransition } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './themes/theme.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('No existe #root en index.html');

const root = createRoot(rootElement);
// El primer render de la app puede ceder el hilo (D2 de `improve-mobile-performance`).
startTransition(() => {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
