/* 在遊戲頁 DevTools Console 貼上或以自動化瀏覽器載入後執行。 */
(async()=>{
  const api=window.__BUS_GAME__,assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
  assert(api.NUMBERS.cardinal.length===21,'基數必須有 1–20');
  assert(api.NUMBERS.ordinal.length===21,'序數必須有第1–20');
  [1,2,3,5,10,11,15,20].forEach(n=>{assert(api.NUMBERS.cardinal[n],`欠基數 ${n}`);assert(api.NUMBERS.ordinal[n],`欠序數 ${n}`)});
  assert(api.hold.ms===3000,'教師及主選單保護時間必須為 3 秒');
  for(const mode of ['cardinal','ordinal'])for(const difficulty of ['easy','normal','hard']){api.state.settings={...api.DEFAULTS,mode,difficulty,min:1,max:20,rounds:5,reduceMotion:true};api.beginGame(mode,difficulty);await new Promise(r=>setTimeout(r,80));assert(document.querySelectorAll('[data-index]').length>0,`${mode}/${difficulty} 沒有選項`);}
  for(const dwellTime of [.2,1,3]){api.input.configure('gaze',dwellTime);assert(api.input.dwell===dwellTime,`注視時間 ${dwellTime} 錯誤`);}
  api.input.configure('both',.2);let hits=0;const b=document.createElement('button');document.body.appendChild(b);api.input.bind(b,()=>hits++);api.input.trigger(b,'dwell');api.input.suppressUntil=performance.now()+500;b.click();assert(hits===1,'dwell 後 click 重複觸發');b.remove();
  console.info('巴士站數學遊戲：核心瀏覽器測試全部通過');
})();
