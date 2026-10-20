// Replay the server-owned initial input. This version has no mid-combat player intents:
// the accepted combat operation history is empty; changing that contract requires replay support here.
import { parentPort, workerData } from 'node:worker_threads';
import { setData } from '../data.js';
import { installOfficialBounds } from '../../shared/plugins/officialBounds.js';

try {
  const { spec, data } = workerData;
  if (spec.kind !== 'unite') throw new Error('only Unite can fast-forward');
  setData(data);
  installOfficialBounds(workerData.bounds);
  if (Object.values(data.garrisons ?? {}).some(g => g.operatorTrait)) {
    const { installServerOperatorTraits } = await import('../plugins/operatorTraits.js');
    await installServerOperatorTraits(data);
  }
  const { createBattleFromSpec } = await import('../sim/spec.js');
  const { DataSource } = await import('../sim/simdata.js');
  const battle = createBattleFromSpec(spec, new DataSource(data, null), { recordEvents: false });
  const result = battle.runToEnd(3700);
  if (!result || result.synthetic || result.errors?.length || battle.errorCount > 0) throw new Error('incomplete or failed Unite simulation');
  parentPort.postMessage({ result });
} catch (e) {
  parentPort.postMessage({ error: String(e?.message ?? e) });
}
