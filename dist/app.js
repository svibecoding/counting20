(() => {
  'use strict';

  const NUMBERS = Object.freeze({
    cardinal: ['', '一個','兩個','三個','四個','五個','六個','七個','八個','九個','十個','十一個','十二個','十三個','十四個','十五個','十六個','十七個','十八個','十九個','二十個'],
    ordinal: ['', '第一個','第二個','第三個','第四個','第五個','第六個','第七個','第八個','第九個','第十個','第十一個','第十二個','第十三個','第十四個','第十五個','第十六個','第十七個','第十八個','第十九個','第二十個']
  });

  const DEFAULTS = Object.freeze({mode:'cardinal',difficulty:'easy',min:1,max:10,inputMode:'touch',dwellTime:1,theme:'navy-white',fontSize:'large',speechRate:.8,animationSpeed:'normal',reduceMotion:false,ordinalLabels:'all',rounds:5});
  const $ = (q, root=document) => root.querySelector(q);
  const $$ = (q, root=document) => [...root.querySelectorAll(q)];
  const clamp = (n,a,b) => Math.min(b,Math.max(a,n));
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  class VoiceManager {
    constructor(){ this.last=''; this.rate=.8; this.enabled='speechSynthesis' in window; }
    setRate(rate){ this.rate=Number(rate); }
    cancel(){ if(this.enabled) speechSynthesis.cancel(); }
    say(text){
      this.last=text; this.cancel(); announce(text);
      if(!this.enabled) return;
      const utterance=new SpeechSynthesisUtterance(text);
      utterance.lang='zh-HK'; utterance.rate=this.rate; utterance.pitch=1;
      const voices=speechSynthesis.getVoices();
      utterance.voice=voices.find(v=>/zh[-_]HK/i.test(v.lang)) || voices.find(v=>/^zh/i.test(v.lang)) || null;
      speechSynthesis.speak(utterance);
    }
    repeat(){ if(this.last) this.say(this.last); }
    cardinal(n){ this.say(NUMBERS.cardinal[n]+'。'); }
    promptCardinal(n){ this.say(`${NUMBERS.cardinal[n]}。巴士可以上${NUMBERS.cardinal[n]}乘客，請幫手叫${NUMBERS.cardinal[n]}乘客上車。`); }
    promptOrdinal(n){ this.say(`${NUMBERS.ordinal[n]}。${NUMBERS.ordinal[n]}乘客要上車。`); }
    cardinalSuccess(n){ this.say(`啱喇！巴士可以上${NUMBERS.cardinal[n]}乘客，而家上咗${NUMBERS.cardinal[n]}，夠啦！`); }
    ordinalSuccess(n){ this.say(`啱喇！${NUMBERS.ordinal[n]}乘客上車，巴士開出啦！`); }
    ordinalWrong(y,x){ this.say(`哎呀，呢個係${NUMBERS.ordinal[y]}。要上車嘅係${NUMBERS.ordinal[x]}乘客喎。`); }
  }

  class InputManager {
    constructor(){
      this.mode='touch'; this.dwell=1; this.locked=false; this.active=null; this.timer=null; this.suppressUntil=0; this.handlers=new WeakMap();
      this.onOver=this.onOver.bind(this); this.onOut=this.onOut.bind(this); this.onClick=this.onClick.bind(this); this.onKey=this.onKey.bind(this);
    }
    configure(mode,dwell){ this.cancel(); this.mode=mode; this.dwell=clamp(Number(dwell),.2,3); document.documentElement.style.setProperty('--dwell-time',`${this.dwell}s`); }
    bind(el,handler){
      this.unbind(el); this.handlers.set(el,handler); el.classList.add('select-target');
      el.addEventListener('click',this.onClick); el.addEventListener('keydown',this.onKey);
      el.addEventListener('pointerenter',this.onOver); el.addEventListener('pointerleave',this.onOut);
    }
    unbind(el){ if(!this.handlers.has(el)) return; el.removeEventListener('click',this.onClick);el.removeEventListener('keydown',this.onKey);el.removeEventListener('pointerenter',this.onOver);el.removeEventListener('pointerleave',this.onOut);this.handlers.delete(el); }
    clear(root=document){ $$('.select-target',root).forEach(el=>this.unbind(el)); this.cancel(); }
    onClick(e){
      if(this.locked || performance.now()<this.suppressUntil) return;
      if(this.mode==='gaze' && e.detail!==0) return;
      e.preventDefault(); this.trigger(e.currentTarget,'direct');
    }
    onKey(e){ if((e.key==='Enter'||e.key===' ')&&!this.locked){ e.preventDefault(); this.trigger(e.currentTarget,'keyboard'); } }
    onOver(e){ if(this.locked || this.mode==='touch' || e.pointerType==='touch') return; this.startDwell(e.currentTarget); }
    onOut(e){ if(this.active===e.currentTarget) this.cancel(); }
    startDwell(el){
      this.cancel(); this.active=el; el.classList.add('gaze-active');
      const ring=$('#dwellRingTemplate').content.firstElementChild.cloneNode(true); el.appendChild(ring);
      this.timer=setTimeout(()=>{ const target=this.active; this.cancel(); if(target){ this.suppressUntil=performance.now()+700; this.trigger(target,'dwell'); } },this.dwell*1000);
    }
    cancel(){ if(this.timer) clearTimeout(this.timer); this.timer=null; if(this.active){this.active.classList.remove('gaze-active');$('.dwell-ring',this.active)?.remove();} this.active=null; }
    trigger(el,source){ if(this.locked) return; const fn=this.handlers.get(el); if(fn) fn({source,element:el}); }
    setLocked(value){ this.locked=Boolean(value); if(value)this.cancel(); }
  }

  class HoldManager {
    constructor(seconds=3){
      this.ms=seconds*1000;this.active=null;this.timer=null;this.handlers=new WeakMap();
      this.onDown=this.onDown.bind(this);this.onUp=this.onUp.bind(this);this.onEnter=this.onEnter.bind(this);this.onLeave=this.onLeave.bind(this);this.onClick=this.onClick.bind(this);this.onKeyDown=this.onKeyDown.bind(this);this.onKeyUp=this.onKeyUp.bind(this);
    }
    bind(el,handler){this.handlers.set(el,handler);el.addEventListener('pointerdown',this.onDown);el.addEventListener('pointerup',this.onUp);el.addEventListener('pointercancel',this.onUp);el.addEventListener('pointerenter',this.onEnter);el.addEventListener('pointerleave',this.onLeave);el.addEventListener('click',this.onClick);el.addEventListener('keydown',this.onKeyDown);el.addEventListener('keyup',this.onKeyUp);el.addEventListener('contextmenu',e=>e.preventDefault());}
    onDown(e){if(e.button!==undefined&&e.button!==0)return;e.preventDefault();this.start(e.currentTarget);}
    onUp(){this.cancel();}
    onEnter(e){if(input.mode!=='touch'&&e.pointerType!=='touch')this.start(e.currentTarget);}
    onLeave(){this.cancel();}
    onClick(e){e.preventDefault();}
    onKeyDown(e){if((e.key==='Enter'||e.key===' ')&&!e.repeat){e.preventDefault();this.start(e.currentTarget);}}
    onKeyUp(e){if(e.key==='Enter'||e.key===' ')this.cancel();}
    start(el){
      this.cancel();this.active=el;el.classList.add('hold-active');
      const ring=$('#dwellRingTemplate').content.firstElementChild.cloneNode(true);ring.classList.add('hold-ring');el.appendChild(ring);
      announce('繼續按住，三秒後開啟。');
      this.timer=setTimeout(()=>{const target=this.active;const fn=target&&this.handlers.get(target);this.cancel();if(fn)fn();},this.ms);
    }
    cancel(){if(this.timer)clearTimeout(this.timer);this.timer=null;if(this.active){this.active.classList.remove('hold-active');$('.hold-ring',this.active)?.remove();}this.active=null;}
  }

  const voice=new VoiceManager();
  const input=new InputManager();
  const hold=new HoldManager(3);
  const state={settings:loadSettings(),round:0,target:1,count:0,firstChoice:null,usedHint:false,firstCorrect:true,records:[],busy:false,ordinalCandidates:[]};
  let liveTimer=0;

  function loadSettings(){ try{return {...DEFAULTS,...JSON.parse(localStorage.getItem('busMathSettings')||'{}')}}catch{return {...DEFAULTS}} }
  function saveSettings(){ localStorage.setItem('busMathSettings',JSON.stringify(state.settings)); }
  function loadRecords(){ try{return JSON.parse(localStorage.getItem('busMathRecords')||'[]')}catch{return []} }
  function saveRecords(records){ localStorage.setItem('busMathRecords',JSON.stringify(records.slice(-500))); }
  function randInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
  function duration(base){ if(state.settings.reduceMotion)return 20; const scale={slow:1.45,normal:1,fast:.65}[state.settings.animationSpeed]||1; return base*scale; }
  function announce(text){ const live=$('#liveMessage'); if(!live)return; live.textContent=text;live.classList.add('show');clearTimeout(liveTimer);liveTimer=setTimeout(()=>live.classList.remove('show'),4200); }
  function showScreen(id){ hold.cancel();$$('.screen').forEach(s=>s.classList.toggle('active',s.id===id)); $('#homeBtn').classList.toggle('hidden',id==='menuScreen'); $('#teacherBtn').classList.toggle('hidden',id==='teacherScreen'||id==='resultsScreen'); window.scrollTo(0,0); $('#main').focus({preventScroll:true}); }
  function applyPreferences(){ document.body.dataset.theme=state.settings.theme;document.body.dataset.font=state.settings.fontSize;document.body.classList.toggle('reduced-motion',state.settings.reduceMotion);voice.setRate(state.settings.speechRate);input.configure(state.settings.inputMode,state.settings.dwellTime);document.documentElement.style.setProperty('--dur',`${duration(600)}ms`); }

  function beginGame(mode,difficulty){
    state.settings.mode=mode;state.settings.difficulty=difficulty;saveSettings();applyPreferences();state.round=0;state.records=[];showScreen('gameScreen');nextRound();
  }
  async function nextRound(){
    input.clear($('#gameScreen')); input.setLocked(true); state.busy=false;state.count=0;state.firstChoice=null;state.usedHint=false;state.firstCorrect=true;state.ordinalCandidates=[];
    state.target=randInt(state.settings.min,state.settings.max);state.round++;
    $('#roundProgress').textContent=`第 ${state.round} / ${state.settings.rounds} 題`;$('#nextRoundPanel').classList.add('hidden');$('#busWrap').className='bus-wrap door-open';
    input.bind($('#repeatBtn'),()=>repeatPrompt());
    if(state.settings.mode==='cardinal') await setupCardinal(); else await setupOrdinal();
    input.setLocked(false);
  }

  function makePassenger(index, options={}){
    const btn=document.createElement('button');btn.type='button';btn.className='passenger';btn.dataset.index=index;btn.setAttribute('aria-label',`由左開始第${index}個乘客`);
    if(options.label){const label=document.createElement('span');label.className='ordinal-label';label.textContent=`第${index}`;btn.appendChild(label);}
    const face=document.createElement('img');face.className='passenger-face';face.src=`assets/faces/face-${((index-1)%8)+1}.png`;face.alt='';face.draggable=false;btn.appendChild(face);return btn;
  }
  function shouldShowOrdinalLabel(i){ const pref=state.settings.ordinalLabels; return pref==='all'||(pref==='anchors'&&(i===1||i===5||i===10||i===15||i===20)); }

  async function setupCardinal(){
    $('#directionLabel').classList.add('hidden');$('#currentCount').classList.remove('hidden');$('#questionText').textContent=`要上車：${state.target}個`;$('#currentCount').textContent='已上車：0個';
    const grid=$('#passengerGrid');grid.className='passenger-grid';grid.innerHTML='';
    const displayCount=Math.max(state.target,Math.min(20,state.settings.max));
    for(let i=1;i<=displayCount;i++){const p=makePassenger(i);grid.appendChild(p);input.bind(p,()=>selectCardinal(i,p));}
    voice.promptCardinal(state.target);
    let auto=0;if(state.settings.difficulty==='easy')auto=Math.max(0,state.target-3);else if(state.settings.difficulty==='normal'&&state.target>10)auto=10;
    if(auto){ state.busy=true;input.setLocked(true);for(let i=1;i<=auto;i++){await boardPassenger(i,true);}state.busy=false;input.setLocked(false);voice.promptCardinal(state.target); }
    markNext();
  }

  async function selectCardinal(index,el){
    if(state.busy||index<=state.count)return;
    if(index!==state.count+1){state.usedHint=true;state.firstCorrect=false;if(state.firstChoice===null)state.firstChoice=index;voice.say('由左邊開始，下一個係呢一位。');markNext(true);return;}
    if(state.firstChoice===null)state.firstChoice=index;
    await boardPassenger(index,false); if(state.count>=state.target)completeRound(true); else markNext();
  }
  async function boardPassenger(index,automatic){
    const el=$(`.passenger[data-index="${index}"]`);if(!el)return;state.busy=true;input.setLocked(true);el.classList.add('boarding');await wait(duration(230));el.classList.remove('boarding');el.classList.add('boarded');state.count=index;$('#currentCount').textContent=`已上車：${state.count}個`;if(!automatic)voice.cardinal(state.count);await wait(duration(190));state.busy=false;input.setLocked(false);
  }
  function markNext(withHint=false){$$('.passenger').forEach(p=>p.classList.remove('next-hint'));const next=$(`.passenger[data-index="${state.count+1}"]`);if(next&&withHint)next.classList.add('next-hint');}

  async function setupOrdinal(){
    $('#directionLabel').classList.remove('hidden');$('#currentCount').classList.add('hidden');$('#questionText').textContent=`第 ${state.target} 個`;const grid=$('#passengerGrid');grid.innerHTML='';
    voice.promptOrdinal(state.target);if(state.settings.difficulty==='hard')setupOrdinalHard();else await setupOrdinalPeople();
  }
  function setupOrdinalHard(){
    const grid=$('#passengerGrid');grid.className='passenger-grid dot-grid';const total=state.target<=10?10:20;
    for(let i=1;i<=total;i++){const b=document.createElement('button');b.type='button';b.className='dot-target';b.dataset.index=i;b.setAttribute('aria-label',`由左開始，位置${i}`);b.innerHTML='<span class="dot" aria-hidden="true"></span>';grid.appendChild(b);input.bind(b,()=>selectOrdinal(i,b));}
  }
  async function setupOrdinalPeople(){
    const grid=$('#passengerGrid');grid.className=`passenger-grid ordinal-${state.settings.difficulty} ordinal-tour`;const cue=$('#cameraCue');cue.classList.remove('hidden');
    const total=Math.min(20,Math.max(state.settings.max,state.settings.difficulty==='easy'?2:3));
    const all=[];for(let i=1;i<=total;i++){const p=makePassenger(i, {label:shouldShowOrdinalLabel(i)||state.settings.difficulty==='easy'});p.tabIndex=-1;p.setAttribute('aria-disabled','true');all.push(p);grid.appendChild(p);}
    const before=Math.max(0,state.target-(state.settings.difficulty==='easy'?2:3));
    await wait(state.settings.reduceMotion?20:80);
    const viewport=Math.max(320,$('#playArea').clientWidth-36),track=grid.scrollWidth,cell=track/total,focus=Math.max(1,before||state.target),focusCenter=(focus-.5)*cell,maxShift=Math.max(0,track-viewport),shift=-Math.min(maxShift,Math.max(0,focusCenter-viewport*.55));
    const tourMs=state.settings.reduceMotion?20:duration(Math.min(7600,Math.max(3200,Math.max(before,2)*520))),zoomMs=state.settings.reduceMotion?20:duration(1250);
    grid.style.setProperty('--tour-shift',`${shift}px`);grid.style.setProperty('--tour-origin',`${focusCenter}px 50%`);grid.style.setProperty('--tour-duration',`${tourMs}ms`);grid.style.setProperty('--zoom-duration',`${zoomMs}ms`);
    await wait(state.settings.reduceMotion?5:40);grid.classList.add('tour-moving');
    if(before){const step=tourMs/before;for(let i=1;i<=before;i++){all[i-1].classList.add('counting-demo');announce(`${NUMBERS.ordinal[i]}。`);await wait(step*.78);all[i-1].classList.remove('counting-demo');await wait(step*.22);}}else await wait(tourMs);
    cue.innerHTML='<span aria-hidden="true">◎</span> 接近目標，鏡頭拉近';grid.classList.add('tour-zoom');await wait(zoomMs);
    let candidates;
    if(state.settings.difficulty==='easy'){
      const neighbor=state.target===1?2:state.target===total?state.target-1:(Math.random()<.5?state.target-1:state.target+1);candidates=[state.target,neighbor].sort((a,b)=>a-b);
    }else{
      const pool=[];for(let i=Math.max(1,state.target-2);i<=Math.min(total,state.target+2);i++)if(i!==state.target)pool.push(i);
      while(pool.length<2){const n=randInt(1,total);if(n!==state.target&&!pool.includes(n))pool.push(n);}
      candidates=[state.target,...pool.sort(()=>Math.random()-.5).slice(0,2)].sort((a,b)=>a-b);
    }
    grid.classList.add('tour-fade');await wait(state.settings.reduceMotion?10:300);cue.classList.add('hidden');grid.className=`passenger-grid ordinal-${state.settings.difficulty} ordinal-final`;grid.style.cssText=`--candidate-count:${candidates.length}`;
    state.ordinalCandidates=candidates;all.forEach((p,i)=>{p.classList.toggle('inactive',!candidates.includes(i+1));if(candidates.includes(i+1)){p.tabIndex=0;p.removeAttribute('aria-disabled');input.bind(p,()=>selectOrdinal(i+1,p));}});
  }
  async function selectOrdinal(index,el){
    if(state.busy)return;if(state.firstChoice===null)state.firstChoice=index;
    if(index===state.target){await boardOrdinal(el);completeRound(true);return;}
    if(!state.usedHint){state.firstCorrect=false;state.usedHint=true;}el.classList.add('wrong');el.setAttribute('aria-label',el.getAttribute('aria-label')+'，錯誤位置');voice.ordinalWrong(index,state.target);const correct=$(`[data-index="${state.target}"]`,$('#passengerGrid'));if(correct){correct.classList.add('correct-hint');correct.classList.remove('inactive');if(!input.handlers.has(correct))input.bind(correct,()=>selectOrdinal(state.target,correct));}
  }
  async function boardOrdinal(el){state.busy=true;input.setLocked(true);el.classList.add('boarding','correct-hint');await wait(duration(430));el.classList.add('boarded');state.busy=false;}

  function repeatPrompt(){if(state.settings.mode==='cardinal')voice.promptCardinal(state.target);else voice.promptOrdinal(state.target);}
  async function completeRound(){
    input.setLocked(true);recordRound();$('#busWrap').classList.remove('door-open');await wait(duration(350));playHorn();$('#busWrap').classList.add('depart');
    const msg=state.settings.mode==='cardinal'?`啱喇！而家上咗 ${state.target} 個，夠啦！`:`啱喇！第 ${state.target} 個乘客上車！`;
    $('#successMessage').textContent=msg;if(state.settings.mode==='cardinal')voice.cardinalSuccess(state.target);else voice.ordinalSuccess(state.target);
    await wait(duration(850));$('#nextRoundPanel').classList.remove('hidden');const btn=$('#nextRoundBtn');btn.textContent=state.round>=state.settings.rounds?'查看結果':'下一題 →';input.setLocked(false);input.bind(btn,()=>{if(state.round>=state.settings.rounds){renderResults();showScreen('resultsScreen');}else nextRound();});
  }
  function recordRound(){
    const record={date:new Date().toISOString(),mode:state.settings.mode,difficulty:state.settings.difficulty,target:state.target,band:state.target<=10?'1–10':'11–20',firstChoice:state.firstChoice,firstCorrect:state.firstCorrect&&!state.usedHint,completedAfterHint:state.usedHint,usedHint:state.usedHint};state.records.push(record);const all=loadRecords();all.push(record);saveRecords(all);
  }
  function playHorn(){
    try{const Ctx=window.AudioContext||window.webkitAudioContext;const c=new Ctx();const o=c.createOscillator(),g=c.createGain();o.type='square';o.frequency.value=185;g.gain.setValueAtTime(.0001,c.currentTime);g.gain.exponentialRampToValueAtTime(.15,c.currentTime+.02);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+.6);o.connect(g).connect(c.destination);o.start();o.stop(c.currentTime+.62);}catch{}
  }

  function readSettingsForm(){
    const f=$('#settingsForm');const range=f.elements.range.value;let min=1,max=Number(range);if(range==='custom'){min=clamp(Number($('#minNumber').value)||1,1,20);max=clamp(Number($('#maxNumber').value)||20,min,20);}
    let rounds=f.elements.rounds.value==='custom'?clamp(Number($('#customRounds').value)||5,1,20):Number(f.elements.rounds.value);
    return {mode:f.elements.mode.value,difficulty:f.elements.difficulty.value,min,max,inputMode:f.elements.inputMode.value,dwellTime:Number($('#dwellTime').value),theme:$('#themeSelect').value,fontSize:$('#fontSize').value,speechRate:Number($('#speechRate').value),animationSpeed:$('#animationSpeed').value,reduceMotion:$('#reduceMotion').checked,ordinalLabels:$('#ordinalLabels').value,rounds};
  }
  function fillSettingsForm(){
    const s=state.settings,f=$('#settingsForm');f.elements.mode.value=s.mode;f.elements.difficulty.value=s.difficulty;const standard=s.min===1&&[5,10,15,20].includes(s.max)?String(s.max):'custom';f.elements.range.value=standard;$('#minNumber').value=s.min;$('#maxNumber').value=s.max;f.elements.inputMode.value=s.inputMode;$('#dwellTime').value=s.dwellTime;$('#dwellOutput').value=`${Number(s.dwellTime).toFixed(1)} 秒`;$('#themeSelect').value=s.theme;$('#fontSize').value=s.fontSize;$('#speechRate').value=s.speechRate;updateSpeechOutput();$('#animationSpeed').value=s.animationSpeed;$('#reduceMotion').checked=s.reduceMotion;$('#ordinalLabels').value=s.ordinalLabels;f.elements.rounds.value=[5,10].includes(s.rounds)?String(s.rounds):'custom';$('#customRounds').value=s.rounds;
  }
  function updateSpeechOutput(){const v=Number($('#speechRate').value);$('#speechOutput').value=v<.75?'慢':v>.9?'較快':'正常';}
  function openTeacher(){input.clear($('#gameScreen'));voice.cancel();fillSettingsForm();showScreen('teacherScreen');input.configure($('#settingsForm').elements.inputMode.value,Number($('#dwellTime').value));input.bind($('#dwellTest'),()=>{announce('注視成功！');voice.say('注視成功！');});}

  function renderResults(){
    const all=loadRecords();const cats=[['按數取量 1–10','cardinal','1–10'],['按數取量 11–20','cardinal','11–20'],['序數 1–10','ordinal','1–10'],['序數 11–20','ordinal','11–20']];
    $('#summaryCards').innerHTML=cats.map(([label,mode,band])=>{const rows=all.filter(r=>r.mode===mode&&r.band===band);const independent=rows.filter(r=>r.firstCorrect).length;const hinted=rows.filter(r=>r.completedAfterHint).length;return `<div class="summary-card"><span>${label}</span><strong>${independent} / ${rows.length}</strong><small>首次獨立正確 · 提示後完成 ${hinted}</small></div>`}).join('');
    $('#resultsBody').innerHTML=all.length?all.slice().reverse().map(r=>`<tr><td>${new Date(r.date).toLocaleString('zh-HK')}</td><td>${r.mode==='cardinal'?'按數取量':'序數'}／${{easy:'簡單',normal:'普通',hard:'困難'}[r.difficulty]}</td><td>${r.band}</td><td>${r.target}</td><td>${r.firstChoice??'—'}</td><td>${r.firstCorrect?'首次正確':'提示後完成'}</td><td>${r.usedHint?'是':'否'}</td></tr>`).join(''):'<tr><td colspan="7">未有學習紀錄</td></tr>';
  }
  function exportCsv(){const rows=loadRecords();const head=['日期','模式','難度','範圍','目標','首次選擇','首次獨立正確','提示後完成','使用提示'];const body=rows.map(r=>[r.date,r.mode,r.difficulty,r.band,r.target,r.firstChoice??'',r.firstCorrect?'是':'否',r.completedAfterHint?'是':'否',r.usedHint?'是':'否']);const csv='\ufeff'+[head,...body].map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=`巴士站數學紀錄-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href);}

  function bindStaticUI(){
    $$('.start-btn').forEach(b=>b.addEventListener('click',()=>beginGame(b.dataset.mode,b.dataset.difficulty)));hold.bind($('#teacherBtn'),openTeacher);hold.bind($('#homeBtn'),()=>{input.clear($('#gameScreen'));voice.cancel();showScreen('menuScreen');});
    $('#cancelSettings').addEventListener('click',()=>showScreen('menuScreen'));$('#settingsForm').addEventListener('submit',e=>{e.preventDefault();state.settings=readSettingsForm();saveSettings();applyPreferences();beginGame(state.settings.mode,state.settings.difficulty);});
    $('#dwellTime').addEventListener('input',e=>{$('#dwellOutput').value=`${Number(e.target.value).toFixed(1)} 秒`;input.configure($('#settingsForm').elements.inputMode.value,Number(e.target.value));input.bind($('#dwellTest'),()=>{announce('注視成功！');voice.say('注視成功！');});});
    $('#settingsForm').elements.inputMode.forEach(r=>r.addEventListener('change',()=>{input.configure(r.form.elements.inputMode.value,Number($('#dwellTime').value));input.bind($('#dwellTest'),()=>{announce('注視成功！');voice.say('注視成功！');});}));
    $('#speechRate').addEventListener('input',updateSpeechOutput);$('#themeSelect').addEventListener('change',e=>document.body.dataset.theme=e.target.value);$('#fontSize').addEventListener('change',e=>document.body.dataset.font=e.target.value);
    $('#viewResultsBtn').addEventListener('click',()=>{renderResults();showScreen('resultsScreen');});$('#resultsBackBtn').addEventListener('click',openTeacher);$('#exportBtn').addEventListener('click',exportCsv);$('#clearBtn').addEventListener('click',()=>{if(confirm('確定清除所有學習紀錄？')){localStorage.removeItem('busMathRecords');renderResults();}});
  }

  window.__BUS_GAME__={NUMBERS,DEFAULTS,input,hold,state,beginGame,nextRound,setTarget(n){state.target=clamp(Number(n),1,20);},getRecords:loadRecords,duration};
  bindStaticUI();applyPreferences();showScreen('menuScreen');
})();
