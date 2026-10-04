/// <reference lib="webworker" />
import { EngineHost } from './host';
import type { FromEngine, ToEngine } from './protocol';

const host = new EngineHost((msg: FromEngine) => self.postMessage(msg));
self.onmessage = (event: MessageEvent<ToEngine>) => host.handle(event.data);
