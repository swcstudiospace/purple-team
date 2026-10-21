import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyStoredTheme } from './components/ThemeToggle';
import './styles.css';

applyStoredTheme();

const container = document.getElementById('root');
if (!container) {
  throw new Error('Purple Team UI: missing #root element in index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
