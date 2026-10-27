const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

// Run against local files or pass the deployed game URL as the first argument.
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const url = process.argv[2] || pathToFileURL(path.resolve(__dirname, '../dist/index.html')).href;
  let rounds = 0;
  async function start(mode, difficulty, target, fontSize = 'large') {
    await page.evaluate(({ mode, difficulty, target, fontSize }) => {
      const api = window.__BUS_GAME__;
      api.state.settings = { ...api.DEFAULTS, min: target, max: target, rounds: 1, reduceMotion: true, fontSize };
      api.beginGame(mode, difficulty);
    }, { mode, difficulty, target, fontSize });
    await page.waitForFunction(() => !window.__BUS_GAME__.input.locked);
  }
  async function layoutCheck() {
    return page.evaluate(() => {
      const buttons = [...document.querySelectorAll('#passengerGrid button')].filter(el => el.getClientRects().length);
      const boxes = buttons.map(el => { const r = el.getBoundingClientRect(); return { x:r.x, y:r.y, right:r.right, bottom:r.bottom, width:r.width, height:r.height }; });
      const collisions = [];
      boxes.forEach((a, i) => boxes.slice(i + 1).forEach((b, j) => {
        if (a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom) collisions.push([i, i + j + 1]);
      }));
      const labels = [...document.querySelectorAll('.ordinal-label')].filter(el => el.getClientRects().length);
      return { collisions, overflow: document.documentElement.scrollWidth > innerWidth + 1,
        boxes, labels: labels.map(el => ({ size:parseFloat(getComputedStyle(el).fontSize), color:getComputedStyle(el).color })),
        choices: buttons.map(el => Number(el.dataset.index)), bodySize: parseFloat(getComputedStyle(document.body).fontSize),
        questionColor: getComputedStyle(document.querySelector('#questionText')).color };
    });
  }
  try {
    await page.goto(url);
    await page.waitForFunction(() => window.__BUS_GAME__);
    const candidatePositions = await page.evaluate(() => {
      const api = window.__BUS_GAME__, positions = new Set();
      for (let total = 3; total <= 20; total++) for (let target = 1; target <= total; target++) {
        for (let attempt = 0; attempt < 60; attempt++) {
          const c = api.consecutiveOrdinalCandidates(target, total);
          if (c.length !== 3 || c[0] < 1 || c[2] > total || c[1] !== c[0]+1 || c[2] !== c[1]+1 || !c.includes(target)) throw new Error('Invalid consecutive candidates: '+c);
          if (target > 2 && target < total - 1) positions.add(c.indexOf(target));
        }
      }
      return [...positions].sort();
    });
    assert.deepEqual(candidatePositions, [0,1,2]);
    for (const mode of ['cardinal','ordinal']) for (const difficulty of ['easy','normal','hard']) {
      for (const target of [1,2,3,5,10,11,15,19,20]) {
        await start(mode, difficulty, target);
        const layout = await layoutCheck();
        assert.equal(layout.collisions.length, 0, `${mode}/${difficulty}/${target} overlapping buttons`);
        assert.equal(layout.overflow, false, `${mode}/${difficulty}/${target} horizontal overflow`);
        assert.equal(layout.bodySize, 30);
        assert(layout.boxes.every(b => b.height >= 165 && b.width >= 120), 'Selection areas must stay large');
        assert(layout.labels.every(l => l.size >= 30 && l.color === 'rgb(176, 0, 32)'), 'Ordinal label style');
        if (mode === 'ordinal') {
          assert.equal(layout.questionColor, 'rgb(176, 0, 32)');
          if (difficulty === 'easy') assert.equal(layout.choices.length, 2);
          if (difficulty === 'normal') {
            assert.equal(layout.choices.length, 3);
            assert.equal(layout.choices[2] - layout.choices[0], 2);
          }
          if (difficulty === 'hard') assert.equal(layout.choices.length, target <= 10 ? 10 : 20);
        }
        const correct = mode === 'ordinal' ? target : await page.evaluate(() => window.__BUS_GAME__.state.count + 1);
        if (mode === 'ordinal') {
          const wrong = layout.choices.find(n => n !== target);
          await page.locator(`#passengerGrid [data-index="${wrong}"]`).click();
          assert.equal(await page.evaluate(() => window.__BUS_GAME__.state.usedHint), true);
          assert.equal((await layoutCheck()).collisions.length, 0, 'Hint must not overlap its neighbours');
        }
        if (mode === 'cardinal') {
          for (let n = correct; n <= target; n++) {
            await page.locator(`#passengerGrid [data-index="${n}"]`).click();
            if (n < target) await page.waitForFunction(() => !window.__BUS_GAME__.input.locked);
          }
        } else await page.locator(`#passengerGrid [data-index="${target}"]`).click();
        await page.locator('#nextRoundPanel').waitFor({ state:'visible' });
        const record = await page.evaluate(() => window.__BUS_GAME__.state.records.at(-1));
        assert.equal(record.target, target);
        if (mode === 'ordinal') assert.equal(record.firstCorrect, false, 'Hinted completion must remain incorrect on first attempt');
        rounds++;
      }
    }
    for (const size of [{width:1024,height:768},{width:1180,height:820},{width:1366,height:768},{width:390,height:844}]) {
      await page.setViewportSize(size);
      for (const font of ['large','xlarge','xxlarge']) for (const difficulty of ['easy','normal','hard']) {
        await start('ordinal', difficulty, 20, font);
        const layout = await layoutCheck();
        assert.equal(layout.overflow, false, `${size.width}/${font}/${difficulty} overflow`);
        assert.equal(layout.collisions.length, 0, `${size.width}/${font}/${difficulty} overlap`);
        assert(layout.labels.every(l => l.size >= 30));
      }
    }
    await page.setViewportSize({width:1024,height:768});
    await start('ordinal','normal',20);
    await page.screenshot({path:'/tmp/mathgame-ordinal-1024.png', fullPage:true});
    const dwell = await page.evaluate(async () => {
      const api = window.__BUS_GAME__, b = document.createElement('button');
      document.body.appendChild(b); let hits = 0; api.input.bind(b, () => hits++);
      for (const seconds of [.2,1,3]) {
        api.input.configure('both',seconds);
        const before = hits;
        b.dispatchEvent(new PointerEvent('pointerenter',{pointerType:'mouse'}));
        await new Promise(r=>setTimeout(r,seconds*1000+80));
        b.click();
        if(hits!==before+1) throw new Error('Duplicate or missing dwell selection');
        b.dispatchEvent(new PointerEvent('pointerleave',{pointerType:'mouse'}));
      }
      api.input.configure('both',.2);const before=hits;
      b.dispatchEvent(new PointerEvent('pointerenter',{pointerType:'mouse'}));
      b.dispatchEvent(new PointerEvent('pointerleave',{pointerType:'mouse'}));
      await new Promise(r=>setTimeout(r,280));
      if(hits!==before) throw new Error('Dwell cancellation failed');
      b.remove();return hits;
    });
    assert.equal(dwell,3);
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({passed:true, completedRounds:rounds, consecutiveCandidates:'all targets/totals 1–20', layout:'4 viewports × 3 font sizes × 3 ordinal levels', dwellSeconds:[.2,1,3], screenshot:'/tmp/mathgame-ordinal-1024.png'}));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
