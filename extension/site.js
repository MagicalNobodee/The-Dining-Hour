/* Site-specific parsing stays here; response HTML is never inserted into the live page. */
(() => {
  const text = node => (node?.textContent || '').replace(/\s+/g, ' ').trim();
  const number = value => /^\d+(?:\.\d+)?(?:\s|$)/.test(value) ? Number.parseFloat(value) : NaN;
  const key = item => JSON.stringify([item.name, item.description, item.price]);
  function cart(doc) {
    const section = doc.querySelector('.cart');
    const summary = [...(section?.querySelectorAll('.list-group-item') || [])].map(text)
      .filter(value => /^(Meals Balance|Breakfast Balance|Total|Number of Dishes):/.test(value));
    const items = [...(section?.querySelectorAll('tbody tr') || [])].map(row => {
      const cells = [...row.querySelectorAll('td')].map(text);
      return { id: row.querySelector('a[href*="/remove-from-cart/"]')?.getAttribute('href'),
        name: cells[1], description: cells[2], price: number(cells[4] || ''), quantity: number(cells[5] || '') };
    });
    const valid = !!section && /Your Cart/.test(text(section)) && summary.length === 4 &&
      items.every(item => item.id && item.name && Number.isFinite(item.price) && item.quantity > 0);
    return { valid, items, summary, fingerprint: JSON.stringify([items, summary]) };
  }
  function orders(doc) {
    const rows = [];
    const valid = [...doc.querySelectorAll('h1,h2,h3,h4')].some(h => /^(Active|Past) Orders$/.test(text(h)));
    for (const row of doc.querySelectorAll('tr')) {
      const cells = [...row.querySelectorAll('td')];
      const href = cells[0]?.querySelector('a')?.getAttribute('href') || '';
      const match = /^\/order_summary\/(\d+)\/$/.exec(href);
      if (!match || cells.length < 7) continue;
      rows.push({ id: match[1], name: text(cells[2]), description: text(cells[3]),
        price: number(text(cells[4])), quantity: number(text(cells[5])), status: text(cells[6]) });
    }
    return { valid, rows };
  }
  function snapshot(doc, url) {
    return { path: new URL(url, location.href).pathname,
      login: !!doc.querySelector('input[type="password"]') || /\/accounts\/login\//.test(url),
      alerts: [...doc.querySelectorAll('.alert')].map(text).filter(Boolean), cart: cart(doc), orders: orders(doc) };
  }
  async function read(path, { signal, timeout = 8000, onSend } = {}) {
    const url = new URL(path, location.href);
    if (url.origin !== location.origin || !['/cart/', '/order_details/', '/ordered/'].includes(url.pathname) || url.search || url.hash)
      throw new Error('请求地址变化，已停止');
    const timeoutSignal = AbortSignal.timeout(timeout);
    const started = performance.now();
    // Calling fetch immediately is intentional: no extension message or navigation is on the send path.
    const sentAt = performance.now();
    const responsePromise = fetch(url.href, { method: 'GET', credentials: 'same-origin', cache: 'no-store',
      redirect: 'follow', signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal });
    onSend?.(sentAt);
    const response = await responsePromise;
    const html = await response.text();
    if (new URL(response.url).origin !== location.origin) throw new Error('回复来自其他网站，结果需要核对');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return { ...snapshot(doc, response.url), ok: response.ok, status: response.status, ms: performance.now() - started };
  }
  function isClosed(result, baseline) {
    return result.ok && !result.login && result.path === '/cart/' && result.cart.valid &&
      result.cart.fingerprint === baseline.fingerprint &&
      result.alerts.some(value => /^The Dining Hall is closed\.?$/i.test(value)) &&
      result.alerts.every(value => /^The Dining Hall is closed\.?$/i.test(value) ||
        /^.+ is not available right now for Close Hours\.?$/i.test(value));
  }
  function isRejected(result, baseline) {
    return result?.ok && !result.login && result.cart.valid && result.cart.fingerprint === baseline.fingerprint &&
      result.alerts.some(value => /^(?:Insufficient (?:balance|funds)|(?:.+ is )?(?:sold out|out of stock))[.!]?$/i.test(value));
  }
  function newOrderResult(before, after, expected, afterCart) {
    if (!before.valid || !after.valid) return 'unknown';
    const previous = new Set(before.rows.map(row => row.id));
    const fresh = after.rows.filter(row => !previous.has(row.id) && !/cancel|refund|reject|fail|delete/i.test(row.status));
    if (!fresh.length) return 'unknown';
    const wanted = new Map(), received = new Map(), seen = new Set();
    for (const item of expected.items) wanted.set(key(item), (wanted.get(key(item)) || 0) + item.quantity);
    for (const item of fresh) {
      // Active and past sections can show the same order; do not count that row twice.
      const identity = JSON.stringify([item.id, key(item), item.quantity]);
      if (seen.has(identity)) continue;
      seen.add(identity);
      received.set(key(item), (received.get(key(item)) || 0) + item.quantity);
    }
    const all = wanted.size > 0 && wanted.size === received.size && [...wanted].every(([name, qty]) => received.get(name) === qty);
    if (all && afterCart.valid && afterCart.items.length === 0) return 'confirmed';
    return 'changed';
  }
  globalThis.MealSite = { cart, orders, snapshot, read, isClosed, isRejected, newOrderResult };
})();
