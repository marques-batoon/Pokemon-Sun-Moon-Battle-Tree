import { lazy, Suspense } from 'react';

// The app (and the ~1.7 MB Pokémon data it needs) loads as a separate chunk,
// so this shell paints immediately.
const App = lazy(() => import('./App'));

function Splash() {
  return (
    <div className="app">
      <header className="app-header"><div className="brand"><h1>Battle Tree Simulator</h1></div></header>
      <div className="splash" role="status">Loading Pokémon data…</div>
    </div>
  );
}

export function Root() {
  return (
    <Suspense fallback={<Splash />}>
      <App />
    </Suspense>
  );
}
