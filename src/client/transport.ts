import type { FromEngine, ToEngine } from '../engine/protocol';

/** How the UI talks to the battle engine. The app uses a Web Worker; tests run the engine in-process. */
export interface EngineTransport {
  send(msg: ToEngine): void;
  listen(handler: (msg: FromEngine) => void): () => void;
  dispose(): void;
}

export function createWorkerTransport(): EngineTransport {
  const worker = new Worker(new URL('../engine/battle.worker.ts', import.meta.url), { type: 'module' });
  const handlers = new Set<(msg: FromEngine) => void>();
  worker.onmessage = (e: MessageEvent<FromEngine>) => handlers.forEach(h => h(e.data));
  worker.onerror = e => handlers.forEach(h => h({ type: 'error', battleId: '*', message: e.message || 'Battle worker crashed' }));
  return {
    send: msg => worker.postMessage(msg),
    listen: handler => { handlers.add(handler); return () => handlers.delete(handler); },
    dispose: () => { handlers.clear(); worker.terminate(); },
  };
}
