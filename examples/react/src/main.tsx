import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FennecProvider } from '@fennecdb/react';
import { db } from './db.js';
import { App } from './App.js';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FennecProvider db={db}>
      <App />
    </FennecProvider>
  </StrictMode>,
);
