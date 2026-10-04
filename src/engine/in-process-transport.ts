import type { EngineTransport } from '../client/transport';
import { EngineHost } from './host';
import type { FromEngine } from './protocol';

/**
 * Runs the engine on the current thread with worker-like async, cloned
 * messages. For tests and headless tools; the app uses createWorkerTransport.
 */
export function createInProcessTransport(): EngineTransport {
  const handlers = new Set<(msg: FromEngine) => void>();
  const host = new EngineHost(msg => {
    const copy = structuredClone(msg);
    setTimeout(() => handlers.forEach(h => h(copy)), 0);
  });
  return {
    send: msg => { const copy = structuredClone(msg); setTimeout(() => host.handle(copy), 0); },
    listen: handler => { handlers.add(handler); return () => handlers.delete(handler); },
    dispose: () => handlers.clear(),
  };
}
