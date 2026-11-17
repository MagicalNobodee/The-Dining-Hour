'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { chromium, executablePath } = require(path.join(root, 'tests/runtime.cjs'));

const outDir = path.join(root, 'docs/assets');
fs.mkdirSync(outDir, { recursive: true });

const staleFlow = path.join(outDir, 'how-it-works.png');
if (fs.existsSync(staleFlow)) fs.unlinkSync(staleFlow);

const uri = rel => 'data:image/png;base64,' + fs.readFileSync(path.join(root, rel)).toString('base64');
const imgs = {
  calib: uri('artifacts/results/design/calibration-details.png'),
  count: uri('artifacts/results/design/countdown.png'),
  success: uri('artifacts/results/success.png')
};

const sans = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", sans-serif';
const serif = '"Iowan Old Style", "Palatino Linotype", "Songti SC", "STSong", Georgia, serif';

const ticks = Array.from({ length: 60 }, (_, i) => {
  const major = i % 5 === 0;
  const y1 = major ? 6 : 8;
  const y2 = major ? 13.5 : 11.5;
  const sw = major ? 1.35 : 0.8;
  const op = major ? 0.72 : 0.34;
  return `<line x1="50" y1="${y1}" x2="50" y2="${y2}" stroke="#9a7b4f" stroke-width="${sw}" stroke-opacity="${op}" stroke-linecap="round" transform="rotate(${i * 6} 50 50)"/>`;
}).join('');

const bgTicks = Array.from({ length: 72 }, (_, i) => {
  const major = i % 6 === 0;
  const y1 = major ? 8 : 12;
  const y2 = major ? 22 : 17;
  return `<line x1="200" y1="${y1}" x2="200" y2="${y2}" stroke="#a5885e" stroke-width="${major ? 1.1 : 0.65}" transform="rotate(${i * 5} 200 200)"/>`;
}).join('');

const heroHTML = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 840px;
    height: 256px;
    background: transparent;
    font-family: ${sans};
    padding: 4px;
  }
  .frame {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: 20px;
    overflow: hidden;
    border: 1px solid #d8cfc0;
    background:
      radial-gradient(ellipse 75% 95% at 50% 0%, rgba(255, 254, 250, 0.96) 0%, rgba(246, 242, 233, 0.4) 68%, transparent 100%),
      radial-gradient(circle at 14% 88%, rgba(168, 138, 93, 0.11) 0%, transparent 52%),
      radial-gradient(circle at 88% 18%, rgba(90, 114, 84, 0.08) 0%, transparent 48%),
      linear-gradient(165deg, #fdfbf6 0%, #f4efe4 56%, #ece5d6 100%);
    box-shadow: 0 8px 24px rgba(32, 37, 35, 0.07), inset 0 1px 0 rgba(255, 255, 255, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .frame::before {
    content: "";
    position: absolute;
    inset: 10px;
    border-radius: 13px;
    border: 1px solid rgba(165, 136, 94, 0.24);
    pointer-events: none;
  }
  .grain {
    position: absolute;
    inset: 0;
    opacity: 0.26;
    mix-blend-mode: multiply;
    pointer-events: none;
  }
  .watermark {
    position: absolute;
    right: -86px;
    top: -72px;
    width: 390px;
    height: 390px;
    opacity: 0.13;
    pointer-events: none;
  }
  .watermark-left {
    position: absolute;
    left: -115px;
    bottom: -135px;
    width: 320px;
    height: 320px;
    opacity: 0.08;
    pointer-events: none;
  }
  .content {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 0 36px;
  }
  .lockup {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 16px;
  }
  .emblem {
    width: 66px;
    height: 66px;
    flex-shrink: 0;
    filter: drop-shadow(0 6px 14px rgba(42, 36, 26, 0.11));
  }
  .titles {
    display: flex;
    align-items: baseline;
    gap: 15px;
  }
  .zh {
    font-family: ${serif};
    font-size: 46px;
    font-weight: 700;
    color: #1f2422;
    letter-spacing: 3px;
    line-height: 1;
  }
  .sep {
    width: 1.5px;
    height: 30px;
    background: linear-gradient(to bottom, transparent, #b3976d 20%, #b3976d 80%, transparent);
    align-self: center;
  }
  .en {
    font-family: ${serif};
    font-size: 31px;
    font-weight: 500;
    color: #2f3532;
    letter-spacing: 0.6px;
    line-height: 1;
  }
  .rule {
    width: 120px;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(154, 123, 79, 0.55), transparent);
    margin-bottom: 14px;
  }
  .tagline {
    font-size: 16.5px;
    font-weight: 450;
    color: #505651;
    letter-spacing: 0.9px;
    line-height: 1.4;
  }
</style><body>
  <div class="frame">
    <svg class="grain" width="100%" height="100%">
      <filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
      <rect width="100%" height="100%" filter="url(#n)" opacity="0.22"/>
    </svg>
    <svg class="watermark" viewBox="0 0 400 400" fill="none">
      <circle cx="200" cy="200" r="192" stroke="#9a7b4f" stroke-width="1"/>
      <circle cx="200" cy="200" r="166" stroke="#9a7b4f" stroke-width="0.75" stroke-dasharray="3 4"/>
      <circle cx="200" cy="200" r="118" stroke="#9a7b4f" stroke-width="0.8"/>
      ${bgTicks}
    </svg>
    <svg class="watermark-left" viewBox="0 0 400 400" fill="none">
      <circle cx="200" cy="200" r="188" stroke="#5a7254" stroke-width="1"/>
      <circle cx="200" cy="200" r="142" stroke="#9a7b4f" stroke-width="0.8"/>
    </svg>
    <div class="content">
      <div class="lockup">
        <svg class="emblem" viewBox="0 0 100 100" fill="none">
          <defs>
            <linearGradient id="dial" x1="14" y1="10" x2="86" y2="90" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#fffef9"/>
              <stop offset="100%" stop-color="#efe9da"/>
            </linearGradient>
            <linearGradient id="brass" x1="10" y1="8" x2="90" y2="92" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#c5a676"/>
              <stop offset="50%" stop-color="#96764b"/>
              <stop offset="100%" stop-color="#b89868"/>
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="47" fill="url(#dial)" stroke="url(#brass)" stroke-width="2"/>
          <circle cx="50" cy="50" r="42.5" stroke="#c8b698" stroke-width="0.75"/>
          ${ticks}
          <circle cx="50" cy="50" r="28" stroke="#d4c7b0" stroke-width="0.8" stroke-dasharray="2 2.5"/>
          <line x1="50" y1="60" x2="50" y2="16" stroke="#232826" stroke-width="2.1" stroke-linecap="round"/>
          <line x1="41" y1="55" x2="66" y2="38" stroke="#9a7b4f" stroke-width="1.6" stroke-linecap="round"/>
          <circle cx="50" cy="14" r="2.4" fill="#5a7254"/>
          <circle cx="50" cy="50" r="4.2" fill="#fffdf8" stroke="#96764b" stroke-width="1.8"/>
          <circle cx="50" cy="50" r="1.6" fill="#5a7254"/>
        </svg>
        <div class="titles">
          <span class="zh">准点</span>
          <span class="sep"></span>
          <span class="en">The Dining Hour</span>
        </div>
      </div>
      <div class="rule"></div>
      <p class="tagline">香港大学圣约翰学院食堂准点结账浏览器扩展 · 天文台校时与订单核验</p>
    </div>
  </div>
</body></html>`;

const galleryHTML = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 840px;
    height: 520px;
    background: transparent;
    font-family: ${sans};
    color: #242927;
    padding: 4px;
  }
  .wrap {
    width: 100%;
    height: 100%;
    border-radius: 20px;
    border: 1px solid #dcd4c5;
    background: linear-gradient(160deg, #fcfaf4 0%, #f2ede2 100%);
    box-shadow: 0 8px 24px rgba(32, 37, 35, 0.06), inset 0 1px 0 #fff;
    padding: 20px 22px 18px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 18px;
  }
  .col {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    background: rgba(255, 253, 249, 0.72);
    border: 1px solid #e4ddd0;
    border-radius: 15px;
    padding: 14px 12px 12px;
  }
  .shot-wrap {
    flex: 1;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
  }
  .shot {
    max-width: 100%;
    max-height: 418px;
    border-radius: 14px;
    box-shadow: 0 10px 24px rgba(26, 31, 29, 0.13);
    border: 1px solid rgba(255, 255, 255, 0.9);
  }
  .label {
    width: 100%;
    text-align: center;
    padding-top: 10px;
    margin-top: 10px;
    border-top: 1px solid rgba(39, 43, 42, 0.07);
    font-size: 14px;
    font-weight: 600;
    color: #2c312e;
    letter-spacing: 0.3px;
  }
  .label span {
    font-weight: 400;
    color: #6b6e66;
    font-size: 13px;
    margin-left: 6px;
  }
</style><body>
  <div class="wrap">
    <div class="col">
      <div class="shot-wrap"><img class="shot" src="${imgs.calib}" /></div>
      <div class="label">01 · 校时与准备<span>偏差修正</span></div>
    </div>
    <div class="col">
      <div class="shot-wrap"><img class="shot" src="${imgs.count}" /></div>
      <div class="label">02 · 倒计时等待<span>单圈进度环</span></div>
    </div>
    <div class="col">
      <div class="shot-wrap"><img class="shot" src="${imgs.success}" /></div>
      <div class="label">03 · 结果核验<span>双延迟记录</span></div>
    </div>
  </div>
</body></html>`;

(async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    for (const [name, html, width, height] of [
      ['hero-banner.png', heroHTML, 840, 256],
      ['ui-gallery.png', galleryHTML, 840, 520]
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
