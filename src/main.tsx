import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root-Element fehlt');
createRoot(root).render(<App />);

// The production build is a self-contained PWA. Vite's BASE_URL keeps the
// registration inside the repository path on GitHub Pages as well as at root.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  });
}
