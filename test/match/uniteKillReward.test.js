import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeMatch } from './harness.js';

function settleReward({ enabled = true, kills = 0, credited, synthetic = false, helper = true, bot = false } = {}) {
  const h = makeMatch({ humans: bot ? 1 : 2, bots: bot ? 1 : 0, rules: enabled ? { uniteKillReward: 'per5' } : {} }).start();
  const m = h.m;
  h.toPrep(1);
  const [leaker, defender] = m.order;
  const plan = { helpers: helper ? [defender] : [leaker], leakers: [leaker], leaked: [], notReentered: [] };
  const before = defender.pendingFunds;
  const pp = { killed: 99, creditedKills: credited, coins: 3, leaked: [], unitStats: [{ kills }] };
  const result = { synthetic, perPlayer: { [defender.playerId]: pp } };
  m.settle(plan, result);
  return { h, m, defender, gain: defender.pendingFunds - before };
}

test('unite reward: credited kills belong to the defender, add to bounty and discard remainder', () => {
  for (const [kills, reward] of [[0, 0], [4, 0], [5, 1], [9, 1], [10, 2]]) {
    const { m, gain, defender } = settleReward({ kills, credited: kills });
    try { assert.equal(gain, 3 + reward); assert.ok(defender.stats.fundsGained >= gain); }
    finally { m.dispose(); }
  }
});

test('unite reward: old reports use unit kill stats; wave-owned killed is not the reward', () => {
  const { m, gain } = settleReward({ kills: 6 });
  try { assert.equal(gain, 4); } finally { m.dispose(); }
});

test('unite reward: disabled, synthetic, and non-helper results pay no reward', () => {
  for (const options of [{ enabled: false }, { synthetic: true }, { helper: false }]) {
    const { m, gain } = settleReward({ ...options, credited: 12 });
    try { assert.equal(gain, 3); } finally { m.dispose(); }
  }
});

test('unite reward: AI helper receives rewards through the same pending funds path', () => {
  const { m, gain } = settleReward({ bot: true, credited: 15 });
  try { assert.equal(gain, 6); } finally { m.dispose(); }
});

test('unite reward: toast carries translated parameters for the player', () => {
  const { h, m, defender } = settleReward({ credited: 10 });
  try {
    const notice = h.sent.find(([id, msg]) => id === defender.playerId && msg.msgid === '联防击倒{kills}名敌人，获得{coins}金币');
    assert.ok(notice);
    assert.deepEqual(notice[1].params, { kills: 10, coins: 2 });
  } finally { m.dispose(); }
});
