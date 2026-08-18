import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/main.scss';
// Registers the service worker as a side effect. See the module for when an update may take over.
import './pwa/updates';

const container = document.getElementById('root');
if (container === null) throw new Error('Root element #root not found');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
