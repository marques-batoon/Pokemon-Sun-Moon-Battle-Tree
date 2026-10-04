import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { Root } from './Root';
import { SettingsStore } from './settings/settings-store';
import { localStore } from './storage/kv';
import { applyTheme } from './ui/theme';

// Apply the saved theme before anything renders (no light/dark flash).
applyTheme(new SettingsStore(localStore()).getSettings().theme);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
