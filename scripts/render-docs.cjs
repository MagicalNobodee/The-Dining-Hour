'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { chromium, executablePath } = require(path.join(root, 'tests/runtime.cjs'));

const outDir = path.join(root, 'docs/assets');
fs.mkdirSync(outDir, { recursive: true });

const uri = rel => 'data:image/png;base64,' + fs.readFileSync(path.join(root, rel)).toString('base64');
const imgs = {
  setup: uri('artifacts/results/design/setup.png'),
  calib: uri('artifacts/results/design/calibration-details.png'),
  count: uri('artifacts/results/design/countdown.png'),
  success: uri('artifacts/results/success.png'),
  popup: uri('artifacts/results/design/popup.png'),
  net: uri('artifacts/network/expanded.png')
};

const sans = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", sans-serif';
const serif = '"Iowan Old Style", "Songti SC", "STSong", Georgia, serif';
const commonCSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: transparent; font-family: ${sans}; color: #272b2a; padding: 6px; }
  .card { width: 100%; height: 100%; border-radius: 26px; overflow: hidden; border: 1px solid #dfd7c7;
    background: linear-gradient(138deg, #fffdf9 0%, #f3f0e8 58%, #eae5d9 100%);
    box-shadow: 0 10px 28px rgba(34,39,36,0.08), inset 0 1px 0 #fff; }
  .kicker { font-size: 11px; letter-spacing: 2.5px; color: #8c7858; font-weight: 600; text-transform: uppercase; }
`;

const heroHTML = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>${commonCSS}
  body { width: 1280px; height: 490px; }
  .card { position: relative; display: grid; grid-template-columns: 1.15fr 0.85fr; align-items: center; padding: 42px 50px; }
  .card::before { content:""; position:absolute; right:-100px; top:-120px; width:520px; height:520px; border-radius:50%; background:radial-gradient(circle, rgba(196,167,117,0.22), transparent 68%); }
  .brand { display:flex; align-items:center; gap:12px; margin-bottom:18px; }
  .sigil { position:relative; width:30px; height:30px; border:1.4px solid #a5885e; border-radius:50%; display:grid; place-items:center; background:#fffdf8; }
  .sigil::before { content:""; width:18px; height:18px; border:1px solid rgba(165,136,94,0.55); border-radius:50%; }
  .sigil::after { content:""; position:absolute; width:1.3px; height:36px; background:linear-gradient(transparent,#a5885e 20%,#a5885e 80%,transparent); transform:rotate(33deg); }
  .badge { padding:4px 11px; border-radius:999px; background:rgba(90,114,84,0.12); border:1px solid rgba(90,114,84,0.28); color:#486043; font-size:11px; font-weight:600; }
  h1 { font-family:${serif}; font-size:42px; line-height:1.18; color:#222725; letter-spacing:1px; margin-bottom:8px; }
  .sub { font-family:${serif}; font-size:15.5px; color:#8c7858; font-style:italic; margin-bottom:18px; }
  .desc { font-size:14.8px; line-height:1.75; color:#525752; max-width:600px; margin-bottom:24px; }
  .desc b { color:#242927; }
  .pills { display:flex; flex-wrap:wrap; gap:9px; }
  .pill { display:inline-flex; align-items:center; gap:7px; padding:7px 13px; border-radius:11px; background:rgba(255,253,248,0.9); border:1px solid #dcd4c4; font-size:12.2px; color:#3a403c; font-weight:500; }
  .dot { width:6px; height:6px; border-radius:50%; background:#9c7950; } .dot.g { background:#5a7254; }
  .stage { position:relative; height:100%; z-index:2; }
  .shot { position:absolute; border-radius:18px; box-shadow:0 20px 46px rgba(24,30,28,0.18); border:1px solid rgba(255,255,255,0.88); background:#fffdf8; }
  .s1 { width:218px; left:6px; top:8px; z-index:2; transform:rotate(-2deg); }
  .s2 { width:198px; right:10px; top:-4px; z-index:1; transform:rotate(2.5deg); }
  .s3 { width:214px; right:22px; bottom:-2px; z-index:3; box-shadow:0 24px 52px rgba(24,30,28,0.24); }
</style><body><div class="card">
  <div style="position:relative;z-index:2;padding-right:24px">
    <div class="brand"><span class="sigil"></span><span class="kicker" style="color:#6e6759">准点 · THE DINING HOUR</span><span class="badge">v0.5.0 · Chrome MV3</span></div>
    <h1>食堂准点结账</h1>
    <div class="sub">HKO-Calibrated Punctual Meal Checkout for St. John's College</div>
    <p class="desc">沿用本机浏览器登录态与已选购物车，在<b>香港天文台标准时间</b>开餐瞬间于页面内直接发起结账。提前预热连接并锁定购物车基线，仅在明确未开放时有限重试，<b>核实新增匹配订单证据后</b>才确认成交。</p>
    <div class="pills">
      <span class="pill"><i class="dot"></i>香港天文台三次采样校时</span>
      <span class="pill"><i class="dot g"></i>同源页面直发 · 零跳转损耗</span>
      <span class="pill"><i class="dot"></i>购物车与订单双向核验</span>
      <span class="pill"><i class="dot g"></i>零第三方依赖 · 不存密码与凭据</span>
    </div>
  </div>
  <div class="stage">
    <img class="shot s2" src="${imgs.count}" /><img class="shot s1" src="${imgs.setup}" /><img class="shot s3" src="${imgs.success}" />
  </div>
</div></body></html>`;

const steps = [
  ['01', '开餐前 30 分钟内', '天文台校时与基线快照', '向香港天文台连续请求 3 次取最快往返修正时钟偏差；准备时只读核对登录状态、购物车餐品指纹与现有订单列表。', '拦截未登录、空车与过期校时'],
  ['02', 'T - 45s / 15s / 8s', '二次复校与静默预热', '前 45 秒自动复校并重算进度环；前 15 秒跨标签页暂停网络测速让出连接；前 8 秒读取购物车预热并确认远端未变。', '发现购物车或余额变动立即停机提醒'],
  ['03', '07:40 / 12:20 / 18:50', '准点直发与克制重试', '单调计时器归零瞬间直接发起同源结账；仅当明确收到「食堂未开放」且购物车与余额未变时，按 100/200/400 ms 串行重试。', '最多 4 次 · 严格限制在开餐后 4 秒内'],
  ['04', '最多 3 轮只读复查', '订单真凭实据核验', '绝不凭 HTTP 200 或空购物车盲判成功；必须核对新增有效订单的餐品与数量完全一致，才展示「下单成功」与双延迟指标。', '同餐次会话防重 · 刷新不重复提交']
];
const flowHTML = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>${commonCSS}
  body { width: 1280px; height: 400px; }
  .card { padding: 32px 38px; display:flex; flex-direction:column; justify-content:space-between; }
  .top { display:flex; justify-content:space-between; align-items:baseline; border-bottom:1px solid rgba(39,43,42,0.09); padding-bottom:14px; }
  .title { font-family:${serif}; font-size:24px; font-weight:600; color:#222725; margin-top:4px; }
  .grid { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-top:18px; flex:1; }
  .step { background:rgba(255,253,248,0.9); border:1px solid #e2dacb; border-radius:18px; padding:18px 17px 15px; display:flex; flex-direction:column; justify-content:space-between; }
  .head { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
  .num { font-family:${serif}; font-size:21px; font-weight:600; color:#9c7950; background:rgba(165,136,94,0.12); width:34px; height:34px; border-radius:9px; display:grid; place-items:center; }
  .step:last-child .num { color:#4d6748; background:rgba(90,114,84,0.14); }
  .when { font-size:10.8px; padding:3px 9px; border-radius:999px; background:#f0ece1; color:#6d685c; font-weight:500; }
  h3 { font-size:15.5px; color:#232826; margin-bottom:7px; }
  p { font-size:12.5px; line-height:1.65; color:#5a5f58; }
  .tag { margin-top:10px; padding-top:9px; border-top:1px dashed #e3dccf; font-size:11.3px; color:#7e735f; font-weight:500; }
  .step:last-child .tag { color:#4d6748; }
</style><body><div class="card">
  <div class="top"><div><div class="kicker">HOW IT WORKS · TIMELINE</div><div class="title">四步看懂一次准点结账</div></div><div style="font-size:12.5px;color:#75776e">全程运行于已登录的购物车标签页内 · 关键发送路径零后台消息等待</div></div>
  <div class="grid">${steps.map(([n,w,t,d,g]) => `<div class="step"><div><div class="head"><span class="num">${n}</span><span class="when">${w}</span></div><h3>${t}</h3><p>${d}</p></div><div class="tag">${g}</div></div>`).join('')}</div>
</div></body></html>`;

const galleryHTML = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>${commonCSS}
  body { width: 1280px; height: 640px; }
  .card { padding: 30px 36px; display:flex; flex-direction:column; }
  .top { display:flex; justify-content:space-between; align-items:baseline; border-bottom:1px solid rgba(39,43,42,0.09); padding-bottom:13px; margin-bottom:18px; }
  .title { font-family:${serif}; font-size:24px; font-weight:600; color:#222725; margin-top:4px; }
  .grid { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; flex:1; min-height:0; }
  .col { background:rgba(255,253,248,0.88); border:1px solid #e2dacb; border-radius:18px; padding:14px 13px 13px; display:flex; flex-direction:column; justify-content:space-between; align-items:center; }
  .box { width:100%; flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; overflow:hidden; }
  .panel { max-width:100%; max-height:418px; border-radius:15px; box-shadow:0 12px 26px rgba(25,31,29,0.14); border:1px solid #fff; }
  .net-crop { width:234px; height:234px; overflow:hidden; border-radius:13px; box-shadow:0 10px 22px rgba(25,31,29,0.12); border:1px solid #dfd9ce; position:relative; background:#faf8f2; flex-shrink:0; }
  .net-crop img { position:absolute; left:-15px; bottom:-15px; width:895px; height:auto; }
  .pop-crop { width:234px; height:172px; border-radius:13px; overflow:hidden; box-shadow:0 10px 22px rgba(25,31,29,0.11); border:1px solid #e2dacb; position:relative; background:#f5f3ec; flex-shrink:0; }
  .pop-crop img { position:absolute; left:0; top:0; width:276px; height:auto; display:block; }
  .cap { width:100%; text-align:center; padding-top:9px; border-top:1px solid rgba(39,43,42,0.07); }
  .cap b { display:block; font-size:13.2px; color:#242927; margin-bottom:2px; }
  .cap span { font-size:11.3px; color:#73756c; }
</style><body><div class="card">
  <div class="top"><div><div class="kicker">INTERFACE GALLERY · ISOLATED SIMULATION</div><div class="title">真实插件界面全览</div></div><div style="font-size:12.5px;color:#75776e">全部截图均由本地隔离模拟环境自动生成 · 不含任何真实账户信息</div></div>
  <div class="grid">
    <div class="col"><div class="box"><img class="panel" src="${imgs.calib}"/></div><div class="cap"><b>1. 餐次选择与校时揭晓</b><span>三段式滑块 · 扫光展示真实偏差与误差</span></div></div>
    <div class="col"><div class="box"><img class="panel" src="${imgs.count}"/></div><div class="cap"><b>2. 单周期金色进度环</b><span>与校准截止时刻绑定 · 归零刚好走完一圈</span></div></div>
    <div class="col"><div class="box"><img class="panel" src="${imgs.success}"/></div><div class="cap"><b>3. 订单核验与双延迟指标</b><span>区分发送请求延迟与读到匹配订单延迟</span></div></div>
    <div class="col"><div class="box"><div class="net-crop"><img src="${imgs.net}"/></div><div class="pop-crop"><img src="${imgs.popup}"/></div></div><div class="cap"><b>4. 本站响应与工具栏日志</b><span>左下角可拖动测速卡片 · 临近开餐自动暂停</span></div></div>
  </div>
</div></body></html>`;

(async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    for (const [name, html, width, height] of [
      ['hero-banner.png', heroHTML, 1280, 490],
      ['how-it-works.png', flowHTML, 1280, 400],
      ['ui-gallery.png', galleryHTML, 1280, 640]
    ]) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
      await page.setContent(html, { waitUntil: 'load' });
      const target = path.join(outDir, name);
      await page.screenshot({ path: target, omitBackground: true });
      await page.close();
      console.log(name, fs.statSync(target).size);
    }
  } finally {
    await browser.close();
  }
})();
