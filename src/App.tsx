import { useEffect, useSyncExternalStore } from 'react';
import { BuilderPage } from './ui/builder/BuilderPage';
import { TestBattlePage } from './ui/battle/TestBattlePage';
import { engine, getBattleClient, getRunController, getSettingsStore, getTeamStore } from './ui/services';
import { SettingsPage } from './ui/settings/SettingsPage';
import { applyTheme } from './ui/theme';
import { TreePage } from './ui/tree/TreePage';
import { useHashRoute } from './ui/useHashRoute';

const ROUTES = ['tree', 'builder', 'battle', 'settings'] as const;
const TITLES: Record<(typeof ROUTES)[number], string> = {
  tree: 'Battle Tree',
  builder: 'Team Builder',
  battle: 'Free Battle',
  settings: 'Settings',
};

export default function App() {
  const route = useHashRoute(ROUTES, 'tree');
  const settingsStore = getSettingsStore();
  const settings = useSyncExternalStore(settingsStore.subscribe, settingsStore.getSettings);

  useEffect(() => applyTheme(settings.theme), [settings.theme]);
  useEffect(() => { document.title = `${TITLES[route]} · Battle Tree Simulator`; }, [route]);
  // Start the battle worker (simulator + validator) early so the first battle doesn't wait for it.
  useEffect(() => {
    const warm = () => void engine();
    if ('requestIdleCallback' in window) window.requestIdleCallback(warm, { timeout: 2000 });
    else setTimeout(warm, 500);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <h1>Battle Tree Simulator</h1>
          <span className="muted small">Sun &amp; Moon · Single &amp; Double Battles</span>
        </div>
        <nav className="nav" aria-label="Main">
          {ROUTES.map(r => (
            <a key={r} href={`#/${r}`} aria-current={route === r ? 'page' : undefined}>{TITLES[r]}</a>
          ))}
        </nav>
      </header>
      <main>
        {route === 'tree' && <TreePage controller={getRunController()} teamStore={getTeamStore()} />}
        {route === 'builder' && <BuilderPage store={getTeamStore()} />}
        {route === 'battle' && <TestBattlePage client={getBattleClient()} store={getTeamStore()} />}
        {route === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}
