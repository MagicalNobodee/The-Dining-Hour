importScripts('core.js');
let queue = Promise.resolve();
const serialized = task => {
  const result = queue.then(task);
  queue = result.catch(() => {});
  return result;
};
async function release(tabId, documentId, lease) {
  const { owner } = await chrome.storage.session.get('owner');
  if (owner && owner.tabId === tabId && (!documentId || owner.documentId === documentId) && (!lease || owner.lease === lease)) {
    await chrome.storage.session.remove('owner');
    await chrome.storage.local.remove('networkGuard');
    chrome.power.releaseKeepAwake();
  }
}
async function calibrate() {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const start = Date.now(), mono = performance.now();
    try {
      const response = await fetch(`https://time.weather.gov.hk/cgi-bin/clock9a.pr?t=${start}-${i}`, {
        cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(4000)
      });
      if (!response.ok) throw new Error('校时服务暂不可用');
      const remote = MealClock.parseTime(await response.text());
      const rtt = performance.now() - mono, end = Date.now();
      if (rtt > 1500 || Math.abs(end - start - rtt) > 100 ||
          Number(response.headers.get('age') || 0) > 0 || Math.abs(remote - end) > 86400_000) continue;
      samples.push({ offset: remote - (start + end) / 2, uncertainty: Math.ceil(rtt / 2) + 10, at: end, rtt });
    } catch { /* One failed sample does not invalidate the other samples. */ }
  }
  if (!samples.length) throw new Error('校时失败或网络太慢，请稍后再试；尚未准备下单');
  return samples.sort((a, b) => a.rtt - b.rtt)[0];
}
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (!msg || typeof msg !== 'object' || !sender.tab || !/^https?:\/\/dh\.stjohns\.hk\/(cart|ordered)\/?(?:[?#].*)?$/.test(sender.url || '')) return;
  const task = async () => {
    if (msg.type === 'clock') return { clock: await calibrate() };
    if (msg.type === 'state') return { lastAttempt: (await chrome.storage.session.get('lastAttempt')).lastAttempt };
    if (msg.type === 'claim') {
      if (typeof msg.lease !== 'string' || msg.lease.length > 80 || !Number.isFinite(msg.target) || msg.target <= Date.now() - 2000 || msg.target > Date.now() + 31 * 60_000)
        throw new Error('目标时间无效，请重新校时');
      const { owner, lastAttempt } = await chrome.storage.session.get(['owner', 'lastAttempt']);
      if (msg.slot !== null && (!Number.isFinite(msg.slot) || Math.abs(msg.slot - msg.target) > 86400_000))
        throw new Error('餐次时间无效');
      if (msg.slot !== null && lastAttempt?.slot === msg.slot) throw new Error('本餐次已发过请求，请先查看订单，不会再次自动下单');
      if (owner && owner.until > Date.now()) throw new Error('已有一个页面正在等待，请先取消那个任务');
      await chrome.storage.session.set({ owner: { tabId: sender.tab.id, documentId: sender.documentId, lease: msg.lease, slot: msg.slot, until: msg.target + 60_000 } });
      await chrome.storage.local.set({networkGuard:{from:msg.target-15000,until:msg.target+60000}});
      chrome.power.requestKeepAwake('display');
      return {};
    }
    if (msg.type === 'sent' || msg.type === 'complete') {
      const { owner } = await chrome.storage.session.get('owner');
      if (!owner || owner.tabId !== sender.tab.id || owner.lease !== msg.lease ||
          (owner.documentId && sender.documentId !== owner.documentId)) throw new Error('任务已失效');
      const message = msg.type === 'sent' ? '请求已发出，结果尚未确认，请查看订单' : String(msg.message || '').slice(0, 300);
      const at = Number.isFinite(msg.at) && Math.abs(msg.at - Date.now()) < 60000 ? msg.at : Date.now();
      await chrome.storage.session.set({ lastAttempt: { slot: owner.slot, at, message, result: MealClock.cleanResult(msg.result) } });
      return {};
    }
    if (msg.type === 'release') { await release(sender.tab.id, sender.documentId, msg.lease); return {}; }
    if (msg.type === 'log') {
      const { records = [] } = await chrome.storage.local.get('records');
      const entry = msg.entry;
      if (!entry || typeof entry.message !== 'string') throw new Error('无效记录');
      await chrome.storage.local.set({ records: [{ at: Date.now(), message: entry.message.slice(0, 500) }, ...records].slice(0, 20) });
      return {};
    }
    throw new Error('未知操作');
  };
  // Calibration makes network calls; it must not block cancellation or single-owner checks.
  (msg.type === 'clock' ? task() : serialized(task)).then(
    result => respond({ ok: true, ...result }), error => respond({ ok: false, error: error.message })
  );
  return true;
});
chrome.tabs.onRemoved.addListener(id => { serialized(() => release(id)); });
chrome.tabs.onUpdated.addListener((id, change) => {
  if (change.status === 'loading') serialized(() => release(id));
});
