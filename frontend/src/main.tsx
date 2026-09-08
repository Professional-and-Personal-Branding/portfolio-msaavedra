import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './themes/theme.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('No existe #root en index.html');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
