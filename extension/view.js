/* Presentation only: all order and timing decisions remain in content.js. */
(() => {
  const icon = (body, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  const arrow = icon('<path d="M5 12h14m-5-5 5 5-5 5"/>');
  const mealIcons = {
    breakfast: icon('<path d="M3 17h18M5 21h14M7 17a5 5 0 0 1 10 0M12 3v4M4 9l3 3m13-3-3 3"/>'),
    lunch: icon('<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>'),
    dinner: icon('<path d="M19.8 15.5A8.5 8.5 0 0 1 8.5 4.2 8.5 8.5 0 1 0 19.8 15.5Z"/><path d="M17 3v4m-2-2h4"/>')
  };
  globalThis.MealView = `
    <style>
      :host { all:initial;color-scheme:light; }
      *, *::before, *::after { box-sizing:border-box; }
      [hidden] { display:none!important; }
      button,input { font:inherit; } button,a,label { -webkit-tap-highlight-color:transparent; }
      button { cursor:pointer; } button:disabled { cursor:default; }
      button:focus-visible,a:focus-visible,input:focus-visible + .check-art { outline:2px solid #9c7950;outline-offset:4px; }
      svg { width:20px;height:20px;flex-shrink:0; }
      .shell {
        zoom:0.9;
        --panel-pad:25px;--ink:#272b2a;--muted:#7b7c75;--gold:#a5885e;--ease:cubic-bezier(.22,1,.36,1);
        position:relative;isolation:isolate;width:374px;max-width:calc(100vw - 24px);max-height:calc(100dvh - 24px);overflow:auto;overflow-x:hidden;
        padding:25px 25px 18px;border:1px solid #ffffffba;border-radius:26px;
        background:linear-gradient(138deg,#fffdf8f7,#f0eee7f5 65%,#f8f6f0f7);color:var(--ink);
        box-shadow:0 24px 70px #111b2030,0 4px 16px #111b2010,inset 0 1px #fff;
        backdrop-filter:blur(28px) saturate(1.3);font:13px/1.5 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;
        scrollbar-width:thin;scrollbar-color:#c6c0b4 transparent;animation:arrival .55s var(--ease) both;
      }
      .shell::before { content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:-1;
        background:radial-gradient(ellipse at 100% 0,#d6bf8d22,transparent 60%),repeating-linear-gradient(0deg,#39362802 0px,#39362802 1px,transparent 1px,transparent 3px); }
      header { display:flex;align-items:center;justify-content:space-between;cursor:grab;touch-action:none;user-select:none;padding-bottom:20px;border-bottom:1px solid #272b2a14; }
      header.dragging { cursor:grabbing; } .brand { display:flex;align-items:center;gap:10px; }
      .sigil { position:relative;width:27px;height:27px;border:1px solid #aa8c60;border-radius:50%; }
      .sigil::before { content:"";position:absolute;inset:4px;border:1px solid #aa8c6080;border-radius:50%; }
      .sigil::after { content:"";position:absolute;left:12px;top:-4px;width:1px;height:33px;background:linear-gradient(transparent,#aa8c60 20%,#aa8c60 80%,transparent);transform:rotate(33deg); }
      h2 { margin:0;font:23px/1.15 "Iowan Old Style","Songti SC",Georgia,serif;letter-spacing:3px;font-weight:500; }
      .brand-sub { display:block;margin-top:4px;font-size:8px;letter-spacing:2.4px;color:var(--muted); }
      .zone { display:flex;align-items:center;gap:6px;font-size:9px;letter-spacing:1.5px;color:var(--muted); }
      .zone i { width:4px;height:4px;border-radius:50%;background:#9c7950;box-shadow:0 0 0 3px #9c795010; }
      .view-stage { position:relative;display:grid;overflow:visible; }
      .shell[data-transitioning] .view-stage { overflow:clip; }
      .view { display:flow-root;grid-area:1 / 1;align-self:start;min-width:0;width:100%; }
      .eyebrow { font-size:9px;letter-spacing:2.6px;color:var(--muted);text-transform:uppercase; }
      .selection-heading { display:flex;justify-content:space-between;align-items:center;margin:21px 0 10px; }
      .selection-heading span:last-child { font-size:10px;color:var(--muted);letter-spacing:1px; }
      .segments { position:relative;display:grid;grid-template-columns:repeat(3,1fr);padding:4px;border-radius:16px;background:#dddcd64d;box-shadow:inset 0 1px 3px #37372b0b;border:1px solid #ffffff80; }
      .slider { position:absolute;left:4px;top:4px;bottom:4px;width:calc((100% - 8px)/3);border-radius:12px;pointer-events:none;
        background:linear-gradient(145deg,#ffffffed,#fffdf5b5);border:1px solid #fff;box-shadow:0 3px 9px #302f2310,inset 0 1px #fff;
        transform:translateX(200%);transition:transform .55s cubic-bezier(.2,1.35,.35,1); }
      .meal { position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:3px;border:0;background:none;border-radius:12px;padding:10px 2px 9px;color:#8a8b84;transition:color .3s,transform .3s var(--ease); }
      .meal svg { width:19px;height:19px;margin-bottom:3px;transition:transform .45s var(--ease); }
      .meal strong { font-size:12px;font-weight:550;letter-spacing:2px; }.meal small { font-size:8px;letter-spacing:1px;font-weight:400; }
      .meal[aria-checked="true"] { color:var(--ink); }.meal[aria-checked="true"] svg { color:#9b7c50;transform:translateY(-1px) rotate(-5deg); }
      .meal:hover:not(:disabled) svg { transform:translateY(-3px); }.meal:active:not(:disabled) { transform:scale(.95); }
      .hero { position:relative;text-align:center;padding:26px 0 22px;overflow:hidden; }
      .hero .eyebrow { position:relative;z-index:1; }
      .hero-time { position:relative;font:68px/1.13 "Iowan Old Style","Baskerville",Georgia,serif;font-variant-numeric:lining-nums tabular-nums;letter-spacing:-3px;margin:8px 0 5px; }
      .hero-time::after { content:"";position:absolute;bottom:-5px;left:calc(50% - 15px);width:30px;height:1px;background:#a5885e80; }
      .service { margin-top:17px;color:var(--muted);font-size:10px;letter-spacing:1px; }
      .hero-decor { position:absolute;inset:9px 0 auto;height:173px;pointer-events:none;opacity:.3; }
      .hero-decor::before,.hero-decor::after { content:"";position:absolute;width:170px;height:170px;border:1px solid #a5885e35;border-radius:50%;left:calc(50% - 85px);transform:scaleX(1.55) rotate(-26deg); }
      .hero-decor::after { transform:scaleX(1.8) rotate(26deg);border-color:#a5885e15; }
      .sync-row { position:relative;isolation:isolate;overflow:visible;display:flex;align-items:center;gap:10px;padding:13px 4px;border-top:1px solid #272b2a12;border-bottom:1px solid #272b2a12; }
      .clock-face { flex:0 0 28px;width:28px;height:28px;color:var(--gold); }
      .clock-face svg { width:28px;height:28px; }.clock-face .hand { transform-origin:12px 12px; }
      .clock-copy { flex:1;min-width:0; }.clock-title { font-size:11px;letter-spacing:.5px; }
      #clock { margin-top:3px;font-size:9px;color:var(--muted);letter-spacing:.2px; }
      #sync { border:1px solid #d5cec1;background:#fffcf680;color:var(--ink);font-size:10px;padding:7px 11px;border-radius:20px;transition:background .25s,box-shadow .25s,transform .25s; }
      #sync:hover:not(:disabled) { background:#fff;box-shadow:0 2px 10px #9c795015;transform:translateY(-1px); }#sync:active:not(:disabled) { transform:scale(.95); }
      #sync:disabled { opacity:.55; }.shell[data-sync="syncing"] .minute { animation:turn .8s linear infinite; }.shell[data-sync="syncing"] .hour { animation:turn 2.8s linear infinite; }
      .shell[data-sync="syncing"] .clock-face { color:#526c50;filter:drop-shadow(0 0 6px #76946b55);animation:sync-breathe 1s ease-in-out infinite alternate; }
      .sync-row::before,.sync-row::after { content:"";position:absolute;inset:0 calc(-1 * var(--panel-pad));z-index:-1;pointer-events:none;opacity:0;filter:blur(1.5px);mask-image:linear-gradient(to bottom,transparent,#000 3px,#000 calc(100% - 3px),transparent); }
      .sync-row::before { background:linear-gradient(100deg,transparent 15%,#a8bc9459 42%,#dfc59355 58%,transparent 85%);background-size:200% 100%;background-repeat:no-repeat; }
      .sync-row::after { background:linear-gradient(90deg,#a8b89324,#d1bd9720);transition:opacity .4s ease; }
      .shell[data-sync="syncing"] .sync-row::before { animation:sync-sweep 3.6s cubic-bezier(.2,.7,.3,1) both; }
      .shell[data-sync="syncing"] .sync-row::after { opacity:1; }
      .shell[data-sync-phase="leaving"] .sync-row::after { opacity:0; }
      .clock-copy { font-variant-numeric:tabular-nums; }
      .shell[data-sync-phase="details"] .clock-title { animation:sync-line-in .48s var(--ease) both; }
      .shell[data-sync-phase="details"] #clock { animation:sync-line-in .48s .28s var(--ease) both; }
      .shell[data-sync-phase="leaving"] .clock-copy { animation:sync-lines-out .4s ease both; }
      .shell[data-sync="synced"] .clock-copy { animation:sync-line-in .4s var(--ease) both; }
      .shell[data-sync="synced"] .clock-face { color:#647763;animation:sync-settle .65s var(--ease); }
      .consent { position:relative;display:flex;align-items:center;gap:10px;margin:20px 0 17px;cursor:pointer;font-size:11px;color:#676a63;width:fit-content; }
      .consent input { position:absolute;z-index:1;opacity:0;width:22px;height:22px;left:0;margin:0;cursor:pointer; }
      .check-art { position:relative;display:grid;place-items:center;width:21px;height:21px;border:1px solid #bcbeb3;border-radius:7px;background:#ffffff70;transition:background .25s,border-color .25s,transform .35s var(--ease); }
      .check-art svg { width:13px;height:13px;stroke-dasharray:20;stroke-dashoffset:20;transition:stroke-dashoffset .3s .08s; }
      input:checked + .check-art { background:#303f36;border-color:#303f36;color:#fff;transform:scale(1.04); }
      input:checked + .check-art svg { stroke-dashoffset:0; }
      input:checked + .check-art::after { content:"";position:absolute;inset:-5px;border:1px solid #64776360;border-radius:11px;animation:check-ring .55s var(--ease) both; }
      .consent:hover .check-art { border-color:#647763; }.consent:has(:disabled) { opacity:.5;cursor:default; }
      .primary { display:flex;align-items:center;justify-content:space-between;width:100%;border:1px solid #1e2727;background:linear-gradient(120deg,#394440,#222b2a);color:#f6f3e9;padding:15px 18px;border-radius:13px;font-size:12px;letter-spacing:2px;box-shadow:0 4px 10px #1c292212;transition:transform .3s var(--ease),box-shadow .3s,opacity .3s; }
      .primary svg { width:18px;height:18px;transition:transform .3s var(--ease); }.primary:hover:not(:disabled) { box-shadow:0 7px 18px #1c292225;transform:translateY(-2px); }.primary:hover:not(:disabled) svg { transform:translateX(4px); }.primary:active:not(:disabled) { transform:scale(.98); }.primary:disabled { opacity:.38;box-shadow:none; }
      .quiet { display:flex;gap:6px;align-items:center;justify-content:center;background:none;border:0;color:var(--muted);font-size:10px;padding:11px 8px;margin:4px auto 0;transition:color .2s; }
      .quiet svg { width:12px;height:12px;transition:transform .35s; }.quiet:hover:not(:disabled) { color:var(--ink); }.quiet:hover svg { transform:rotate(-25deg); }
      #warning { text-align:center;font-size:9px;color:#86867c;letter-spacing:.5px;margin:12px 0 0; }
      .colophon { margin-top:13px;display:flex;align-items:center;gap:10px;color:#a3a296;font-size:7px;letter-spacing:2px; }.colophon::before,.colophon::after { content:"";height:1px;background:#272b2a10;flex:1; }
      .active-heading { text-align:center;margin:26px 0 0; }.active-heading h3 { font-family:"Songti SC","Iowan Old Style",serif;font-size:25px;font-weight:500;letter-spacing:5px;margin:7px 0 0; }
      .dial { position:relative;width:276px;height:276px;max-width:100%;margin:12px auto 4px;display:flex;flex-direction:column;justify-content:center;align-items:center; }
      .progress-ring { position:absolute;inset:7px;width:calc(100% - 14px);height:calc(100% - 14px);overflow:visible;transform:rotate(-90deg); }
      .ring-track,.ring-progress { fill:none;stroke-width:1.5; }
      .ring-track { stroke:#a5885e24; }
      .ring-progress { stroke:#a18b66;stroke-linecap:round;stroke-dasharray:100;stroke-dashoffset:100; }
      #countdown { position:relative;z-index:1;display:flex;justify-content:center;align-items:baseline;font:45px/1.2 "Iowan Old Style",Georgia,serif;font-variant-numeric:lining-nums tabular-nums;letter-spacing:-1px;white-space:nowrap; }
      #countdown .pair { display:inline-block;min-width:51px;text-align:center; }.colon { color:#a0a091;margin:0 1px; }
      .count-label { position:relative;z-index:1;margin:10px 0 0;font-size:8px;letter-spacing:3px;color:#96968a; }
      #active-target { text-align:center;font-size:10px;letter-spacing:1px;color:#7d7e73;margin-bottom:22px; }
      .secondary { width:100%;border:1px solid #c8c8bc;background:#ffffff55;color:#697064;border-radius:12px;padding:11px;font-size:11px;letter-spacing:1px;transition:background .25s,transform .25s; }
      .secondary:hover:not(:disabled) { background:#fff;transform:translateY(-1px); }.secondary:active:not(:disabled) { transform:scale(.98); }.secondary:disabled { opacity:.4; }
      #status { white-space:pre-line;margin:16px 0 3px;padding:12px 14px;border:1px solid #ba9c6428;border-radius:12px;background:#b99c6010;color:#77603f;font-size:11px;line-height:1.8;overflow-wrap:anywhere;animation:page-in .3s var(--ease); }
      #cancel { margin-top:18px; }
      .loading-heading { text-align:center;padding-top:29px; }
      .loading-heading h3 { margin:8px 0 0;font:25px/1.4 "Songti SC",Georgia,serif;letter-spacing:4px;font-weight:500; }
      .loader { position:relative;width:190px;height:190px;margin:24px auto 22px;display:grid;place-items:center; }
      .loader::before { content:"";position:absolute;inset:25px;border:1px solid #a5885e20;border-radius:50%;animation:loader-breathe 2.6s ease-in-out infinite; }
      .loader svg { position:absolute;width:100%;height:100%;overflow:visible; }
      .loader-track { stroke:#a5885e1d;stroke-width:.7; }
      .loader-arc { transform-origin:100px 100px;stroke:#9c8157;stroke-width:1.7;stroke-linecap:round;stroke-dasharray:105 480;animation:loader-turn 1.6s linear infinite; }
      .loader-counter { stroke:#61755b85;stroke-width:.8;stroke-dasharray:28 460;transform-origin:100px 100px;animation:loader-turn 4s linear infinite reverse; }
      .loader-center { display:grid;place-items:center;width:66px;height:66px;border-radius:50%;background:#fdfcf8a0;box-shadow:0 0 40px #c3b08812; }
      .loader-center svg { position:static;width:28px;height:28px;color:#9c8157;animation:loader-center 2.4s ease-in-out infinite; }
      .loading-steps { display:flex;justify-content:center;gap:14px;margin:0 0 18px;font-size:9px;color:#a19e90;letter-spacing:.5px; }
      .loading-steps span { display:flex;align-items:center;gap:5px;transition:color .35s; }.loading-steps i { width:4px;height:4px;border-radius:50%;background:currentColor; }
      .shell[data-loading-phase="request"] .step-request,.shell[data-loading-phase="verify"] .step-verify,.shell[data-loading-phase="done"] .step-done { color:#5e7256; }
      #loading-copy #status { margin:0;text-align:center;background:none;border:0;padding:0 8px;color:#858475;min-height:39px;line-height:1.8; }
      #result-view { text-align:center;--result-color:#5a7254; }
      .shell[data-result="failed"] #result-view { --result-color:#a16d56; }
      .shell[data-result="unknown"] #result-view { --result-color:#9d814f; }
      .shell[data-result="demo"] #result-view { --result-color:#7a8474; }
      .result-mark { position:relative;display:grid;place-items:center;width:112px;height:112px;margin:27px auto 17px;color:var(--result-color); }
      .result-mark::before,.result-mark::after { content:"";position:absolute;inset:3px;border:1px solid currentColor;border-radius:50%;opacity:.17; }
      .result-mark::after { inset:14px;opacity:.1;background:currentColor; }
      .result-mark svg { width:42px;height:42px;stroke-width:1.35;position:relative;z-index:1; }
      .result-glyph { display:none; }.shell[data-result="success"] .glyph-success,.shell[data-result="failed"] .glyph-failed,.shell[data-result="unknown"] .glyph-unknown,.shell[data-result="demo"] .glyph-demo { display:block; }
      #result-title { margin:8px 0 0;font:29px/1.35 "Songti SC",Georgia,serif;letter-spacing:4px;font-weight:500; }
      #result-copy #status { border:0;background:none;text-align:center;padding:0 5px;margin:11px 0 21px;color:#858475;font-size:11px;line-height:1.85; }
      .metrics { display:grid;grid-template-columns:1fr 1fr;gap:10px;text-align:left; }
      .metric { padding:16px 12px 13px;border:1px solid #b9ae951f;border-radius:16px;background:linear-gradient(145deg,#fffdf8a6,#f0eee37d);box-shadow:inset 0 1px #fff9; }
      .metric-label { display:block;font-size:10px;color:#858477;letter-spacing:.4px;white-space:nowrap; }
      .metric-reading { display:flex;align-items:baseline;gap:5px;margin:9px 0 7px;min-height:34px; }
      .metric-reading strong { font:30px/1 "Iowan Old Style",Georgia,serif;font-variant-numeric:lining-nums tabular-nums;letter-spacing:-.5px;color:#343a32; }
      .metric-reading small { font-size:9px;color:#969384;letter-spacing:1px; }
      .metric-caption { display:block;font-size:8px;line-height:1.5;color:#a09c8d; }
      #metric-note { margin:13px 2px 21px;font-size:9px;line-height:1.7;color:#a19b8c; }
      .result-actions #orders { display:flex;text-decoration:none;margin:0;color:#f6f3e9;text-align:left;font-size:11px; }
      #back { margin-top:9px; }
      .shell[data-view="result"] .result-mark { animation:result-settle .7s var(--ease) both; }
      .shell[data-view="result"] .result-glyph path { stroke-dasharray:45;stroke-dashoffset:45;animation:result-draw .65s .12s var(--ease) forwards; }
      .shell[data-view="result"] .metric { animation:page-in .55s .13s var(--ease) both; }
      .shell[data-view="result"] .metric + .metric { animation-delay:.22s; }
      .shell[data-view="result"] .result-actions { animation:page-in .55s .26s var(--ease) both; }
      @keyframes loader-turn { to { transform:rotate(360deg); } }
      @keyframes loader-breathe { 50% { transform:scale(.96);opacity:.35; } }
      @keyframes loader-center { 50% { opacity:.55;transform:translateY(-2px); } }
      @keyframes result-settle { from { opacity:0;transform:scale(.82); } 65% { opacity:1;transform:scale(1.04); } to { opacity:1;transform:scale(1); } }
      @keyframes result-draw { to { stroke-dashoffset:0; } }
      @keyframes turn { to { transform:rotate(360deg); } }
      @keyframes arrival { from { opacity:0;transform:translateY(10px) scale(.98); } to { opacity:1;transform:none; } }
      @keyframes page-in { from { opacity:0;transform:translateY(9px);filter:blur(2px); } to { opacity:1;transform:none;filter:blur(0); } }
      @keyframes check-ring { from { opacity:.8;transform:scale(.75); } to { opacity:0;transform:scale(1.35); } }
      @keyframes sync-breathe { from { transform:scale(1.04);filter:drop-shadow(0 0 3px #76946b33); } to { transform:scale(1.17);filter:drop-shadow(0 0 8px #76946b66); } }
      @keyframes sync-sweep { 0% { opacity:0;background-position:180% 0; } 12% { opacity:1; } 85% { opacity:1; } 100% { opacity:0;background-position:-80% 0; } }
      @keyframes sync-line-in { from { opacity:0;transform:translateY(6px);filter:blur(2px); } to { opacity:1;transform:translateY(0);filter:blur(0); } }
      @keyframes sync-lines-out { to { opacity:0;transform:translateY(-4px);filter:blur(2px); } }
      @keyframes sync-settle { 0% { transform:scale(.85); } 55% { transform:scale(1.13); } 100% { transform:scale(1); } }
      @media (prefers-reduced-motion:reduce) { .result-glyph path { stroke-dashoffset:0!important; } *,*::before,*::after { animation:none!important;transition:none!important;scroll-behavior:auto!important; } }
      @media (max-width:390px) { .shell { --panel-pad:20px;padding:20px; }.hero-time { font-size:60px; }.dial { width:245px;height:245px; }#countdown { font-size:40px; } }
    </style>
    <section class="shell" data-view="setup" data-sync="idle" aria-label="食堂准点结账">
      <header title="按住这里拖动窗口"><div class="brand"><span class="sigil" aria-hidden="true"></span><div><h2>准点</h2><span class="brand-sub">THE DINING HOUR</span></div></div><span class="zone"><i></i>HONG KONG</span></header>
      <div id="view-stage" class="view-stage">
      <div id="setup-view" class="view">
        <div class="selection-heading"><span class="eyebrow">Choose your moment</span><span>选择餐次</span></div>
        <input id="meal" type="hidden" value="dinner">
        <div class="segments" role="radiogroup" aria-label="选择餐次"><span class="slider" aria-hidden="true"></span>
          ${Object.entries(MealClock.MEALS).map(([id,m]) => `<button type="button" class="meal" role="radio" aria-label="${m.label} ${m.start}–${m.end}" aria-checked="${id==='dinner'}" tabindex="${id==='dinner'?0:-1}" data-meal="${id}">${mealIcons[id]}<strong>${m.label.split(' ')[1]}</strong><small>${m.label.split(' ')[0].toUpperCase()}</small></button>`).join('')}
        </div>
        <div class="hero"><div class="hero-decor" aria-hidden="true"></div><span class="eyebrow">Opening time · 开餐</span><div id="hero-time" class="hero-time"></div><div id="service" class="service"></div></div>
        <div class="sync-row"><span class="clock-face">${icon('<circle cx="12" cy="12" r="9"/><path d="M12 4v1m8 7h-1M12 20v-1M4 12h1"/><path class="hand hour" d="M12 12V7"/><path class="hand minute" d="M12 12l4 2"/>')}</span><div class="clock-copy"><div id="clock-title" class="clock-title">香港标准时间</div><div id="clock">香港天文台 · 未同步</div></div><button id="sync" aria-label="校准时间">校准</button></div>
        <label class="consent"><input id="confirm" type="checkbox"><span class="check-art" aria-hidden="true">${icon('<path d="m5 12 4 4 10-10"/>')}</span><span id="confirmation">餐品就绪，同意自动结账</span></label>
        <button id="arm" class="primary" disabled><span>准备就绪</span>${arrow}</button>
        <button id="demo" class="quiet" aria-label="5 秒演练">${icon('<path d="M4 10a8 8 0 1 1 2 8M4 4v6h6"/><path d="m11 9 5 3-5 3Z"/>')}<span>演练 5 秒 · 不下单</span></button>
      </div>
      <div id="active-view" class="view" hidden>
        <div class="active-heading"><span id="stage-kicker" class="eyebrow">A moment, perfectly timed</span><h3 id="stage-title">静候开餐</h3></div>
        <div class="dial"><svg class="progress-ring" viewBox="0 0 260 260" aria-hidden="true"><circle class="ring-track" cx="130" cy="130" r="127"/><circle id="ring-progress" class="ring-progress" cx="130" cy="130" r="127" pathLength="100"/></svg><div id="countdown" role="timer" aria-label="剩余时间"></div><div id="count-label" class="count-label">HOURS : MINUTES : SECONDS</div></div>
        <div id="active-target"></div>
      </div>
      <div id="loading-view" class="view" hidden>
        <div class="loading-heading"><span class="eyebrow">A moment in motion</span><h3 id="loading-title">正在提交</h3></div>
        <div class="loader" aria-hidden="true"><svg viewBox="0 0 200 200" fill="none"><circle class="loader-track" cx="100" cy="100" r="86"/><circle class="loader-arc" cx="100" cy="100" r="86"/><circle class="loader-counter" cx="100" cy="100" r="72"/></svg><span class="loader-center">${icon('<path d="M7 4v6m-3-6v6m7-6v6M4 10c0 4 7 4 7 0M7.5 13v7M19 4v16m0-16c-4 3-4 8 0 8"/>')}</span></div>
        <div class="loading-steps" aria-hidden="true"><span class="step-request"><i></i>发送请求</span><span class="step-verify"><i></i>核对订单</span><span class="step-done"><i></i>展示结果</span></div>
        <div id="loading-copy"></div>
      </div>
      <div id="result-view" class="view" hidden>
        <div class="result-mark" aria-hidden="true">
          ${icon('<path d="m5 12 4 4L19 6"/>','result-glyph glyph-success')}
          ${icon('<path d="m6 6 12 12M18 6 6 18"/>','result-glyph glyph-failed')}
          ${icon('<path d="M9 8a3 3 0 1 1 5 2.2c-1.7.8-2 1.8-2 3.3M12 18h.01"/>','result-glyph glyph-unknown')}
          ${icon('<path d="m9 5 10 7-10 7Z"/>','result-glyph glyph-demo')}
        </div>
        <span id="result-kicker" class="eyebrow">Order confirmed</span><h3 id="result-title">下单成功</h3>
        <div id="result-copy"></div>
        <div class="metrics" aria-label="结账延迟">
          <div class="metric"><span class="metric-label">发送请求延迟</span><div class="metric-reading"><strong id="send-delay">—</strong><small id="send-unit"></small></div><span id="send-caption" class="metric-caption">开餐时刻 → 浏览器开始请求</span></div>
          <div class="metric"><span class="metric-label">成功确认延迟</span><div class="metric-reading"><strong id="confirm-delay">—</strong><small id="confirm-unit"></small></div><span id="confirm-caption" class="metric-caption">开餐时刻 → 核对成功订单</span></div>
        </div>
        <p id="metric-note">以本机读到订单证据的时刻为准，不是服务器落单时刻。</p>
        <div class="result-actions"><a id="orders" class="primary" href="/order_details/" hidden><span>查看网站订单</span>${arrow}</a><button id="back" class="secondary">返回设置</button></div>
      </div>
      </div>
      <button id="cancel" class="secondary" hidden disabled>取消</button>
      <small id="today" hidden></small><p id="connection" hidden></p>
      <div id="notice-area"><p id="status" role="status" aria-live="polite" hidden></p></div>
      <p id="warning">前台 · 开盖 · 勿刷新或离开</p>
      <div class="colophon">EVERY MOMENT MATTERS</div>
    </section>`;
})();
