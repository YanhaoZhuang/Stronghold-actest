import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const chrome = process.env.CHROME_PATH;
const enabled = process.env.SP_UNITE_UI === '1' && chrome && existsSync(chrome);

test('native Unite control: desktop/mobile layout, vote, withdraw, running and observer', { skip: !enabled }, async () => {
  const { startServer } = await import('../../server/index.js');
  const puppeteer = (await import('puppeteer-core')).default;
  const srv = await startServer({ host: '127.0.0.1', port: 0, quiet: true });
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-first-run'] });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request', r => {
      if (r.isNavigationRequest()) void r.respond({ contentType: 'text/html', body: '<!doctype html><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/theme.css"><link rel="stylesheet" href="/css/components.css"><link rel="stylesheet" href="/css/screens/game.css"><div id="root"></div>' });
      else void r.continue();
    });
    await page.goto(`http://127.0.0.1:${srv.port}/unite-test`);
    await page.evaluate(async () => {
      const { html } = await import('/js/ui/components.js');
      const { render } = await import('/vendor/preact.module.js');
      const { TopBar } = await import('/js/ui/hud.js');
      const state = { phaseId: '1.1.u', round: 1, status: 'waiting', eligible: ['p1', 'p2'], votes: [] };
      window.uniteTest = {
        state, myId: 'p1', requests: [],
        draw() {
          render(html`<div class="gm"><div class="gm__hud"><${TopBar}
            pub=${{ phase: 'UNITE', round: 1, players: [], unite: { fastForward: state } }}
            priv=${{ lp: 100 }} conn=${{ online: true }} hud=${{ killed: 3, total: 28 }}
            myId=${this.myId} onUniteFast=${async msg => {
              this.requests.push(msg); state.votes = msg.agree ? ['p1'] : []; this.draw();
            }} /></div></div>`, document.getElementById('root'));
        },
      };
      window.uniteTest.draw();
    });
    const out = path.join(ROOT, 'test/e2e/out');
    mkdirSync(out, { recursive: true });
    for (const [name, width, height] of [['desktop', 1920, 1080], ['mobile', 844, 390], ['portrait', 390, 844]]) {
      await page.setViewport({ width, height });
      await page.waitForSelector('.unite-fast button');
      const bounds = await page.$eval('.unite-fast', el => {
        const r = el.getBoundingClientRect();
        const b = el.querySelector('button').getBoundingClientRect();
        return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, height: b.height };
      });
      assert.ok(bounds.x >= 0 && bounds.right <= width && bounds.bottom <= height, JSON.stringify(bounds));
      assert.ok(bounds.height >= 32);
      await page.screenshot({ path: path.join(out, `unite-fast-${name}.png`) });
    }
    await page.click('.unite-fast button');
    await page.waitForFunction(() => document.querySelector('.unite-fast').textContent.includes('1/2'));
    await page.click('.unite-fast button');
    await page.waitForFunction(() => document.querySelector('.unite-fast').textContent.includes('0/2'));
    assert.deepEqual(await page.evaluate(() => window.uniteTest.requests.map(m => m.agree)), [true, false]);
    await page.evaluate(() => { window.uniteTest.state.status = 'running'; window.uniteTest.draw(); });
    await page.waitForFunction(() => document.querySelector('.unite-fast').textContent.includes('正在快速结算'));
    assert.equal(await page.$('.unite-fast button'), null);
    await page.evaluate(() => { window.uniteTest.state.status = 'waiting'; window.uniteTest.myId = 'observer'; window.uniteTest.draw(); });
    assert.equal(await page.$('.unite-fast button'), null);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await srv.close();
  }
});
