const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');

(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage();
 const failures=[];
 async function settle(){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
 async function check(name){
  await settle();
  const info=await page.evaluate(()=>{
   const active=document.querySelector('.screen.active');
   const boxes=[...active.querySelectorAll('button:not(:disabled),h1,.question-block,.summary-card,.record-detail dd,.record-pagination output,.feedback-panel')]
    .filter(el=>el.getClientRects().length).map(el=>{const r=el.getBoundingClientRect();return {name:el.id||el.textContent.slice(0,30),x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height};});
   return {outside:boxes.filter(r=>r.x<-.5||r.y<-.5||r.right>innerWidth+.5||r.bottom>innerHeight+.5),
    scale:getComputedStyle(active).transform,screen:active.id,
    escapedIcons:[...active.querySelectorAll('.dot,.passenger:not(.boarded) .passenger-face')].filter(el=>el.getClientRects().length).filter(el=>{const r=el.getBoundingClientRect(),b=el.closest('button').getBoundingClientRect();return r.x<b.x-.5||r.y<b.y-.5||r.right>b.right+.5||r.bottom>b.bottom+.5}).map(el=>el.closest('button').dataset.index),
    rootScroll:document.documentElement.scrollHeight>innerHeight+1||document.documentElement.scrollWidth>innerWidth+1,
    badFeedback:[...document.querySelectorAll('.live-message.show,.camera-cue:not(.hidden)')].filter(el=>el.getClientRects().length&&(el.scrollHeight>el.clientHeight+1||el.scrollWidth>el.clientWidth+1)).map(el=>el.textContent)};
  });
  if(info.outside.length||info.rootScroll||info.badFeedback.length||info.escapedIcons.length)failures.push({name,...info});
 }
 try{
  await page.goto(process.argv[2]||pathToFileURL(path.resolve(__dirname,'../dist/index.html')).href);
  await page.waitForFunction(()=>window.__BUS_GAME__);
  for(const viewport of [{width:1024,height:768},{width:1024,height:650},{width:1180,height:700},{width:1366,height:768},{width:834,height:1112},{width:390,height:844},{width:844,height:390}]){
   await page.setViewportSize(viewport);
   for(const font of ['large','xlarge','xxlarge']){
    const label=`${viewport.width}x${viewport.height}/${font}`;
    await page.evaluate(font=>{
     localStorage.setItem('busMathSettings',JSON.stringify({...window.__BUS_GAME__.DEFAULTS,fontSize:font,reduceMotion:true}));
    },font);
    await page.reload();await check(label+'/menu');
    for(const mode of ['cardinal','ordinal'])for(const difficulty of ['easy','normal','hard']){
     await page.evaluate(({mode,difficulty})=>{const api=window.__BUS_GAME__;api.state.settings.min=20;api.state.settings.max=20;api.beginGame(mode,difficulty)},{mode,difficulty});
     await page.waitForFunction(()=>!window.__BUS_GAME__.input.locked);
     await check(label+'/'+mode+'/'+difficulty);
     if(mode==='cardinal'){
      const wrong=await page.evaluate(()=>window.__BUS_GAME__.state.count+2);
      if(wrong<=20){await page.locator(`#passengerGrid [data-index="${wrong}"]`).click();await check(label+'/cardinal/'+difficulty+'/hint');}
     }
     if(mode==='ordinal'){
      const wrong=await page.locator('#passengerGrid button:visible').first().getAttribute('data-index');
      if(wrong!=='20'){await page.locator(`#passengerGrid [data-index="${wrong}"]`).click();await check(label+'/'+difficulty+'/hint');}
     }
    }
    await page.evaluate(()=>{
     const api=window.__BUS_GAME__;api.input.setLocked(false);
     api.hold.handlers.get(document.querySelector('#teacherBtn'))();
    });
    const settings=await page.evaluate(()=>({scrollable:document.body.scrollHeight>document.body.clientHeight,overflow:getComputedStyle(document.body).overflowY}));
    assert.equal(settings.overflow,'auto');assert(settings.scrollable,'Settings must remain scrollable');
    await page.evaluate(()=>{
     localStorage.setItem('busMathRecords',JSON.stringify(Array.from({length:500},(_,i)=>({date:new Date(Date.UTC(2026,9,28,3,i)).toISOString(),mode:i%2?'ordinal':'cardinal',difficulty:'normal',target:i%20+1,band:i%20<10?'1–10':'11–20',firstChoice:1,firstCorrect:i%3===0,completedAfterHint:i%3!==0,usedHint:i%3!==0}))));
    });
    await page.locator('#viewResultsBtn').click();await check(label+'/results');
    await page.locator('#recordNextBtn').click();
    assert.equal(await page.locator('#recordPageStatus').textContent(),'2 / 500');
    await check(label+'/results-page2');
    await page.locator('#recordPrevBtn').click();
    assert.equal(await page.locator('#recordPageStatus').textContent(),'1 / 500');
    if(viewport.width===1024&&viewport.height===650&&font==='xxlarge')await page.screenshot({path:'/tmp/mathgame-results-fit.png'});
    console.log('Checked '+label);
   }
  }
  await page.setViewportSize({width:1024,height:650});
  await page.reload();
  await page.screenshot({path:'/tmp/mathgame-menu-fit.png'});
  await page.evaluate(()=>{const api=window.__BUS_GAME__;api.state.settings.min=20;api.state.settings.max=20;api.beginGame('cardinal','hard')});
  await page.waitForFunction(()=>!window.__BUS_GAME__.input.locked);await settle();
  await page.screenshot({path:'/tmp/mathgame-cardinal-fit.png'});
  await page.evaluate(()=>window.__BUS_GAME__.beginGame('ordinal','hard'));
  await page.waitForFunction(()=>!window.__BUS_GAME__.input.locked);await settle();
  await page.screenshot({path:'/tmp/mathgame-dots-fit.png'});
  if(failures.length){console.error(JSON.stringify(failures,null,2));process.exitCode=1;}
  else console.log('PASS: all six games, menu, 500-record pagination, three font sizes, seven viewports, settings scrolling; every control stays in the viewport.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
