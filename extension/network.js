/* A small same-origin read measures responsiveness; it never visits a checkout URL. */
(() => {
  const WINDOW = 5, INTERVAL = 15000, TIMEOUT = 4000, FRESH = 60000;
  function summary(samples) {
    const good = samples.filter(s => s.ok).map(s => s.ms).sort((a,b) => a-b);
    return { count:good.length, failures:samples.length-good.length,
      median:good.length ? Math.round((good[Math.floor((good.length-1)/2)]+good[Math.floor(good.length/2)])/2) : null,
      min:good[0] ?? null, max:good.at(-1) ?? null };
  }
  function comparison(current, previous) {
    if (!previous) return '切换网络后，可点重新测速对比';
    if (current.count < 3 || current.failures) return '样本不足或存在失败，暂不比较';
    if (current.max < previous.min) return `比上次快 ${previous.median-current.median} ms`;
    if (current.min > previous.max) return `比上次慢 ${current.median-previous.median} ms`;
    return '与上次差异不明显';
  }
  function validSaved(value) {
    return value && Number.isFinite(value.at) && value.at <= Date.now()+1000 && Date.now()-value.at < 86400000 &&
      value.count >= 3 && value.count <= WINDOW && value.failures === 0 &&
      [value.min,value.median,value.max].every(n => Number.isFinite(n) && n > 0 && n < 60000) &&
      value.min <= value.median && value.median <= value.max;
  }
  function mount() {
    const host = document.createElement('div'); host.id = 'meal-network-indicator';
    host.style.cssText = 'position:fixed;left:20px;bottom:20px;z-index:2147483647;';
    const root = host.attachShadow({mode:'open'});
    root.innerHTML = `<style>
      :host{all:initial;color-scheme:light}*{box-sizing:border-box}[hidden]{display:none!important}
      .card{width:224px;max-width:calc(100vw - 24px);max-height:calc(100dvh - 24px);overflow:auto;padding:13px 15px;border:1px solid #ded9cf;border-radius:17px;background:#faf8f2f5;color:#303530;box-shadow:0 8px 28px #25302a19;backdrop-filter:blur(16px);font:12px/1.55 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}
      .card.expanded{width:298px}.top{display:flex;align-items:center;gap:8px}button{font:inherit;color:inherit;cursor:pointer}button:disabled{cursor:default;opacity:.55}button:focus-visible{outline:2px solid #9c7950;outline-offset:3px}
      #drag{border:0;background:none;padding:0;color:#898577;cursor:grab;touch-action:none;font-size:18px;line-height:24px}#toggle{flex:1;border:0;background:none;text-align:left;padding:0;display:flex;align-items:center;justify-content:space-between;gap:8px}#value{font-size:19px;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-.5px}#unit{font-size:11px;font-weight:400;margin-left:3px;color:#817765}.label{font-weight:500}#subtitle{margin-top:4px;color:#79776e;font-size:11px}.card[data-tone="error"] #value{color:#ad5143}.card[data-tone="muted"] #value{color:#88857b}
      #details{border-top:1px solid #e5dfd4;margin-top:11px;padding-top:10px}dl{margin:0}dl>div{display:flex;justify-content:space-between;gap:10px;margin:4px 0}dt{color:#77766d}dd{margin:0;text-align:right;font-variant-numeric:tabular-nums}#compare{margin:9px 0;color:#846e4e}#note{margin:9px 0;color:#838078;font-size:11px}#retest{width:100%;padding:7px;border:1px solid #d6cbb9;background:#f0eadd;border-radius:9px}#recent{overflow-wrap:anywhere;font-size:11px;color:#77766d;margin:7px 0 0}
      @media(max-width:600px){.card{width:190px;padding:10px 12px}.card.expanded{width:280px}}
    </style><section class="card" aria-label="本站网络响应">
      <div class="top"><button id="drag" aria-label="拖动网络标签，方向键移动" title="拖动位置，或用方向键移动">⠿</button><button id="toggle" aria-expanded="false" aria-controls="details"><span class="label">本站响应</span><span><span id="value">—</span><span id="unit"></span></span></button></div>
      <div id="subtitle">准备测量…</div>
      <div id="details" hidden><dl><div><dt>近期范围</dt><dd id="range">—</dd></div><div><dt>最近失败</dt><dd id="failures">—</dd></div><div><dt>首次请求</dt><dd id="first">—</dd></div><div><dt>上次测速</dt><dd id="previous">—</dd></div></dl><div id="recent"></div><p id="compare"></p><button id="retest">重新测速</button><p id="note">越低通常越快。测本站小文件的完整往返，含网站响应时间，不等于下单延迟。首次请求单列；切换网络后重新测速。</p></div>
    </section>`;
    document.documentElement.append(host);
    const $ = id => root.getElementById(id), card = root.querySelector('.card');
    let samples=[], first=null, previous=null, lastAt=0, active=null, ready=false, round=true, remaining=WINDOW;
    let nextAt=performance.now()+1500, localReason='', deadline=null, shared=null, guardTimer, destroyed=false;
    const store = values => { try { chrome.storage.local.set(values).catch(()=>{}); } catch {} };
    function reason() {
      if (document.visibilityState !== 'visible') return '页面在后台，已暂停';
      if (!navigator.onLine) return '网络已离线';
      if (localReason) return localReason;
      if (deadline !== null && deadline-performance.now() <= 15000) return '临近下单，测速暂停';
      if (shared && Date.now() >= shared.from && Date.now() < shared.until) return '抢饭进行中，测速暂停';
      return '';
    }
    function render() {
      const s=summary(samples), paused=reason(), age=lastAt ? Math.max(0,Math.floor((Date.now()-lastAt)/1000)) : null;
      const latest=samples.at(-1), stale=age !== null && age*1000 > FRESH;
      $('value').textContent = !navigator.onLine ? '离线' : latest && !latest.ok ? latest.error : s.median !== null ? String(s.median) : '—';
      $('unit').textContent = navigator.onLine && latest?.ok && s.median !== null ? 'ms' : '';
      card.dataset.tone = !navigator.onLine || (latest && !latest.ok) ? 'error' : paused || stale ? 'muted' : 'normal';
      $('subtitle').textContent = (paused ? `${paused}${age !== null ? ` · ${age} 秒前` : ''}` : '') || (active ? `测量中 · ${samples.length}/${WINDOW}` : stale ? `结果已过期 · ${age} 秒前` :
        s.median !== null ? `${s.min}–${s.max} ms · ${age} 秒前${s.count < 3 ? ' · 样本较少' : ''}` : latest ? `上次测量失败 · ${age} 秒前` : '准备测量…');
      $('range').textContent = s.count ? `${s.min}–${s.max} ms（${s.count} 次成功）` : '暂无成功样本';
      $('failures').textContent = `${s.failures} / ${samples.length} 次`;
      $('first').textContent = first ? first.ok ? `${first.ms} ms（不计入近期值）` : first.error : '测量中';
      $('previous').textContent = previous ? `${previous.median} ms · ${new Date(previous.at).toLocaleTimeString('zh-CN',{hour12:false,hour:'2-digit',minute:'2-digit'})}` : '暂无';
      $('recent').textContent = samples.length ? `近期：${samples.map(s=>s.ok ? s.ms : s.error).join(' / ')}` : '';
      $('compare').textContent = stale ? '结果已过期，请重新测速' : comparison(s,previous);
      $('retest').disabled = !ready || !!paused || round || !!active;
      $('retest').textContent = round && !paused ? '正在采样…' : '重新测速';
    }
    function hold() {
      if (reason() && active) active.abort();
      render();
    }
    function scheduleGuard() {
      clearTimeout(guardTimer);
      const waits=[];
      if (deadline !== null && deadline-performance.now() > 15000) waits.push(deadline-performance.now()-15000);
      if (shared && shared.from > Date.now()) waits.push(shared.from-Date.now());
      if (waits.length) guardTimer=setTimeout(hold,Math.min(...waits));
      hold();
    }
    async function probe() {
      if (!ready || active || destroyed || reason()) return;
      const controller=new AbortController(); active=controller;
      const timeout=setTimeout(()=>controller.abort('timeout'),TIMEOUT), started=performance.now();
      // A unique URL plus no-store prevents a browser cache hit looking like a fast network.
      const url=new URL('/static/main/styles.css',location.origin);
      url.searchParams.set('meal_probe',crypto.randomUUID());
      let result, observed;
      const observer=new PerformanceObserver(list=>{for(const entry of list.getEntries())if(entry.name===url.href)observed=entry;});
      observer.observe({type:'resource'});
      render();
      try {
        const response=await fetch(url.href,{credentials:'same-origin',cache:'no-store',redirect:'error',signal:controller.signal});
        const body=await response.arrayBuffer(), elapsed=performance.now()-started;
        if (response.status!==200 || response.url!==url.href || !/^text\/css(?:;|$)/i.test(response.headers.get('content-type')||'') || !body.byteLength || body.byteLength>65536)
          throw new Error('回复异常');
        // Resource Timing entries can arrive on the next task; do not include that wait in the measurement.
        await new Promise(resolve=>setTimeout(resolve,0));
        const timing=observed || performance.getEntriesByName(url.href).at(-1);
        // Isolated extension requests may not appear in the page's timing buffer.
        // Fresh URLs and no-store are mandatory; reject known cache/service-worker replies.
        if (timing?.deliveryType==='cache' || timing?.workerStart>0 || navigator.serviceWorker?.controller) throw new Error('缓存未验证');
        result={ok:true,ms:Math.max(1,Math.round(elapsed)),at:Date.now()};
      } catch(error) {
        if (controller.signal.aborted && controller.signal.reason!=='timeout') return;
        result={ok:false,error:controller.signal.reason==='timeout' ? '超时' : ['回复异常','缓存未验证'].includes(error.message) ? error.message : '连接失败',at:Date.now()};
      } finally {clearTimeout(timeout);observer.disconnect();active=null;}
      if (!result || destroyed || reason()) { render(); return; }
      if (!first) first=result;
      else {
        samples.push(result); samples=samples.slice(-WINDOW); lastAt=result.at;
        if (round && --remaining<=0) round=false;
        const s=summary(samples);
        if (s.count>=3 && !s.failures) store({networkLastSummary:{...s,at:lastAt}});
      }
      nextAt=performance.now()+(round ? 1000 : INTERVAL);
      render();
    }
    function step() { if (reason() && active) active.abort(); if (!active && performance.now()>=nextAt) void probe(); render(); }
    let interval=setInterval(step,1000);
    $('toggle').addEventListener('click',()=>{
      const expanded=$('details').hidden; $('details').hidden=!expanded; card.classList.toggle('expanded',expanded);
      $('toggle').setAttribute('aria-expanded',String(expanded)); clamp();
    });
    $('retest').addEventListener('click',()=>{
      if ($('retest').disabled) return;
      const s=summary(samples);
      if (s.count>=3 && !s.failures && Date.now()-lastAt<FRESH) previous={...s,at:lastAt};
      samples=[];first=null;lastAt=0;round=true;remaining=WINDOW;nextAt=performance.now();step();
    });
    let drag=null;
    function position(x,y) {
      const b=host.getBoundingClientRect();
      host.style.left=`${Math.max(12,Math.min(x,innerWidth-b.width-12))}px`;
      host.style.top=`${Math.max(12,Math.min(y,innerHeight-b.height-12))}px`;
      host.style.right='auto';host.style.bottom='auto';
    }
    function clamp() { const b=host.getBoundingClientRect();position(b.left,b.top); }
    function savePosition() {const b=host.getBoundingClientRect();store({networkPosition:{x:b.left,y:b.top}});}
    $('drag').addEventListener('pointerdown',e=>{
      if(e.button!==0)return;const b=host.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX-b.left,y:e.clientY-b.top};
      $('drag').setPointerCapture(e.pointerId);e.preventDefault();
    });
    $('drag').addEventListener('pointermove',e=>{if(drag?.id===e.pointerId)position(e.clientX-drag.x,e.clientY-drag.y);});
    function endDrag(e){if(drag?.id!==e.pointerId)return;drag=null;savePosition();}
    $('drag').addEventListener('pointerup',endDrag);$('drag').addEventListener('pointercancel',endDrag);$('drag').addEventListener('lostpointercapture',endDrag);
    $('drag').addEventListener('keydown',e=>{
      const delta={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[e.key];
      if(!delta)return;e.preventDefault();const b=host.getBoundingClientRect();position(b.left+delta[0],b.top+delta[1]);savePosition();
    });
    const resize=new ResizeObserver(clamp);resize.observe(host);window.addEventListener('resize',clamp);
    document.addEventListener('visibilitychange',hold);window.addEventListener('offline',hold);window.addEventListener('online',step);
    function storageChanged(changes,area){if(area==='local' && changes.networkGuard){shared=changes.networkGuard.newValue;scheduleGuard();}}
    chrome.storage.onChanged.addListener(storageChanged);
    chrome.storage.local.get(['networkLastSummary','networkPosition','networkGuard']).then(saved=>{
      if(validSaved(saved.networkLastSummary))previous=saved.networkLastSummary;
      const p=saved.networkPosition;if(p && Number.isFinite(p.x) && Number.isFinite(p.y))position(p.x,p.y);
      shared=saved.networkGuard;ready=true;scheduleGuard();
    }).catch(()=>{ready=true;render();});
    window.addEventListener('pagehide',()=>{destroyed=true;active?.abort();clearInterval(interval);clearTimeout(guardTimer);resize.disconnect();try {chrome.storage.onChanged.removeListener(storageChanged);} catch {}});
    window.addEventListener('pageshow',event=>{if(event.persisted){destroyed=false;interval=setInterval(step,1000);chrome.storage.onChanged.addListener(storageChanged);resize.observe(host);scheduleGuard();}});
    render();
    return {setActivity(reasonText,until=null){localReason=reasonText;deadline=until;scheduleGuard();}};
  }
  const api={summary,comparison,validSaved,mount};
  if(typeof module!=='undefined' && module.exports)module.exports=api;
  else globalThis.MealNetwork=api;
})();
