// One disposable worker per unanimous Unite request. No match state crosses back until success.
import { Worker } from 'node:worker_threads';
import { exportOfficialBounds } from '../../shared/plugins/officialBounds.js';

export function startUniteFastJob(input, { timeoutMs = 15000 } = {}) {
  let worker;
  let timer;
  let finish;
  const promise = new Promise((resolve, reject) => {
    let ended = false;
    finish = (error, result) => {
      if (ended) return;
      ended = true;
      clearTimeout(timer);
      if (worker) void worker.terminate();
      if (error) reject(error); else resolve(result);
    };
    // Includes worker startup and data transfer; independent of game speed / virtual time.
    timer = setTimeout(() => finish(new Error('unite fast-forward timeout')), timeoutMs);
    try {
      worker = new Worker(new URL('./uniteFastWorker.js', import.meta.url), {
        workerData: { ...input, bounds: exportOfficialBounds() }, resourceLimits: { maxOldGenerationSizeMb: 256 },
      });
      worker.once('message', (m) => m.error ? finish(new Error(m.error)) : finish(null, m.result));
      worker.once('error', (e) => finish(e));
      worker.once('exit', (code) => finish(new Error(`unite worker exited (${code})`)));
    } catch (e) { finish(e); }
  });
  return { promise, cancel: () => finish(new Error('unite fast-forward cancelled')) };
}
