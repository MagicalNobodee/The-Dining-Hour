(() => {
  if (document.getElementById('meal-timer-extension')) return;
  const { MEALS, targetToday, formatHK, validateClock, timerDelay } = MealClock;
  const host = document.createElement('div');
  host.id = 'meal-timer-extension';
  host.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483647;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = MealView;
  document.documentElement.append(host);
  const header = root.querySelector('header');
  let drag = null;
  function movePanel(x, y) {
    const bounds = host.getBoundingClientRect();
    host.style.left = `${Math.max(12, Math.min(x, innerWidth - bounds.width - 12))}px`;
    host.style.top = `${Math.max(12, Math.min(y, innerHeight - bounds.height - 12))}px`;
    host.style.right = 'auto';
    host.style.bottom = 'auto';
  }
  header.addEventListener('pointerdown', event => {
    if (event.button !== 0 || drag) return;
    const bounds = host.getBoundingClientRect();
    drag = { id: event.pointerId, dx: event.clientX - bounds.left, dy: event.clientY - bounds.top };
    header.setPointerCapture(event.pointerId);
    header.classList.add('dragging');
    event.preventDefault();
  });
  header.addEventListener('pointermove', event => {
    if (drag?.id === event.pointerId) movePanel(event.clientX - drag.dx, event.clientY - drag.dy);
  });
  function endDrag(event) {
    if (drag?.id !== event.pointerId) return;
    drag = null;
    header.classList.remove('dragging');
    if (header.hasPointerCapture(event.pointerId)) header.releasePointerCapture(event.pointerId);
  }
  header.addEventListener('pointerup', endDrag);
  header.addEventListener('pointercancel', endDrag);
  header.addEventListener('lostpointercapture', endDrag);
  function keepPanelVisible() {
    if (!host.style.left) return;
    const bounds = host.getBoundingClientRect();
    movePanel(bounds.left, bounds.top);
  }
  window.addEventListener('resize', keepPanelVisible);
  new ResizeObserver(keepPanelVisible).observe(host);
  const $ = id => root.getElementById(id);
  let clock = null, run = null, pending = false, timer, displayTimer, lease = null, preparation = null;
  let generation = 0, lastAttempt = null;
  const network = MealNetwork.mount();
  const send = async message => {
    const result = await chrome.runtime.sendMessage(message);
    if (!result?.ok) throw new Error(result?.error || '扩展连接中断，请刷新后重新准备');
    return result;
  };
  const log = message => { send({ type: 'log', entry: { message } }).catch(() => {}); };
  const shell = root.querySelector('.shell');
  const panelZoom = Number(getComputedStyle(shell).zoom) || 1;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let ringAnimation = null;
  let syncing = false, resultVisualTimer = null, lastViewShown = false;
  let activePane = $('setup-view'), transitionId = 0, paneAnimations = [];
  const stage = $('view-stage');
  const status = message => {
    $('status').textContent = message;
    $('status').hidden = !message || /^(先校时|校时完成|已切换餐次|已准备 ·|演练倒计时|正在向香港天文台校时|正在检查登录、购物车)/.test(message);
  };
  function setView(view, previousHeight) {
    if (view !== 'waiting') {
      ringAnimation?.cancel(); ringAnimation = null;
      $('ring-progress').style.strokeDashoffset = view === 'sending' ? '0' : '100';
    }
    const id = ++transitionId;
    const previous = activePane;
    const next = $(view === 'setup' ? 'setup-view' : view === 'waiting' ? 'active-view' : view === 'result' ? 'result-view' : 'loading-view');
    const oldHeight = previousHeight ?? (stage.getBoundingClientRect().height / panelZoom);
    paneAnimations.forEach(animation => animation.cancel()); paneAnimations = [];
    shell.dataset.view = view;
    shell.setAttribute('aria-busy', String(view === 'preparing' || view === 'sending'));
    $('cancel').hidden = view === 'setup' || view === 'result';
    $('stage-title').textContent = run?.demo ? '预演此刻' : '静候开餐';
    $('stage-kicker').textContent = run?.demo ? 'A five-second rehearsal' : 'A moment, perfectly timed';
    const statusHome = view === 'result' ? $('result-copy') : next === $('loading-view') ? $('loading-copy') : $('notice-area');
    statusHome.append($('status'));
    if (view === 'preparing') setLoading('prepare');
    activePane = next;
    stage.querySelectorAll(':scope > .view').forEach(pane => {
      pane.style.cssText = '';
      pane.hidden = pane !== next;
      pane.inert = pane !== next;
      pane.setAttribute('aria-hidden', String(pane !== next));
    });
    if (reducedMotion.matches || previous === next || oldHeight === 0) {
      stage.style.height = ''; delete shell.dataset.transitioning; return;
    }
    previous.hidden = false;
    previous.style.cssText = 'position:absolute;inset:0 auto auto 0;pointer-events:none;width:100%;';
    next.style.opacity = '0';
    stage.style.height = `${oldHeight}px`;
    shell.dataset.transitioning = 'true';
    // Let the network operation start first; animation setup runs on the next paint.
    requestAnimationFrame(() => {
      if (id !== transitionId) return;
      const height = (next.getBoundingClientRect().height / panelZoom);
      const easing = 'cubic-bezier(.22,1,.36,1)';
      const exit = previous.animate([{opacity:1,transform:'translateY(0) scale(1)',filter:'blur(0)'},
        {opacity:0,transform:'translateY(-8px) scale(.985)',filter:'blur(3px)'}], {duration:200,easing,fill:'both'});
      const enter = next.animate([{opacity:0,transform:'translateY(12px) scale(.985)',filter:'blur(3px)'},
        {opacity:1,transform:'translateY(0) scale(1)',filter:'blur(0)'}], {duration:460,easing,fill:'both'});
      const resize = stage.animate([{height:`${oldHeight}px`},{height:`${height}px`}], {duration:460,easing,fill:'both'});
      paneAnimations = [exit,enter,resize];
      exit.onfinish = () => { if (id === transitionId) previous.hidden = true; };
      enter.onfinish = () => {
        if (id !== transitionId) return;
        previous.hidden = true; previous.style.cssText = ''; next.style.cssText = '';
        stage.style.height = ''; paneAnimations.forEach(animation => animation.cancel()); paneAnimations = [];
        delete shell.dataset.transitioning;
      };
    });
  }
  function setLoading(phase) {
    shell.dataset.loadingPhase = phase;
    $('loading-title').textContent = phase === 'prepare' ? '正在检查餐品' : phase === 'verify' ? '正在核对订单' :
      phase === 'done' ? '结果已核对' : phase === 'demo' ? '演练加载中' : '正在提交订单';
  }
  function resultFor(current, kind) {
    return MealClock.cleanResult({ kind: current.demo ? 'demo' : kind,
      sendDelayMs: current.sendDelayMs, confirmDelayMs: current.confirmDelayMs, attempts: current.attempts || 0 });
  }
  function renderResult(result, message, detail = '') {
    const previousHeight = (stage.getBoundingClientRect().height / panelZoom);
    const demo = result.kind === 'demo', confirmed = result.kind === 'confirmed';
    const failed = result.kind === 'closed' || result.kind === 'rejected';
    shell.dataset.result = demo ? 'demo' : confirmed ? 'success' : failed ? 'failed' : 'unknown';
    $('result-title').textContent = demo ? '演练完成' : confirmed ? '下单成功' : failed ? '未能下单' : result.kind === 'changed' ? '订单需核对' : '结果待核对';
    $('result-kicker').textContent = demo ? 'REHEARSAL COMPLETE' : confirmed ? 'ORDER CONFIRMED' : failed ? 'NOT COMPLETED' : 'CHECK YOUR ORDER';
    const metric = (name, value) => {
      $(name + '-delay').textContent = value === null ? '—' : value.toLocaleString('zh-CN', {minimumFractionDigits:value < 100 ? 1 : 0,maximumFractionDigits:value < 100 ? 1 : 0});
      $(name + '-delay').dataset.ms = value === null ? '' : String(value);
      $(name + '-unit').textContent = value === null ? '' : 'ms';
    };
    metric('send', result.sendDelayMs); metric('confirm', result.confirmDelayMs);
    $('send-caption').textContent = demo ? '演练未发送请求' : result.sendDelayMs === null ? '暂无可用发送记录' : '开餐时刻 → 浏览器开始请求';
    $('confirm-caption').textContent = demo ? '演练未产生订单' : confirmed && result.confirmDelayMs === null ? '计时中断，确认耗时不可用' : confirmed ? '开餐时刻 → 核对成功订单' : '未确认成功，不计成功耗时';
    $('metric-note').textContent = demo ? '这里只演示界面过渡，不生成下单或成功耗时。' : '从开餐时刻起算；成功确认以读到匹配订单为准，不是服务器落单时刻。';
    $('orders').hidden = demo;
    status(detail ? `${message}\n网站提示：${detail.slice(0,350)}` : message);
    setView('result', previousHeight); controls();
  }
  function setTime(value) {
    const el = $('countdown');
    if (el.textContent === value) return;
    const parts = value.split(':');
    if (parts.length !== 3) { el.textContent = value; return; }
    if (el.querySelectorAll('.pair').length !== 3) {
      el.innerHTML = parts.map(part => `<span class="pair">${part}</span>`).join('<span class="colon">:</span>');
      return;
    }
    el.querySelectorAll('.pair').forEach((part, i) => {
      if (part.textContent === parts[i]) return;
      part.textContent = parts[i];
      if (!reducedMotion.matches) part.animate([{opacity:.35,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}], {duration:260,easing:'cubic-bezier(.22,1,.36,1)'});
    });
  }
  const slot = () => targetToday(Date.now() + (clock?.offset || 0), $('meal').value);
  function showClock() {
    shell.dataset.sync = syncing ? 'syncing' : clock ? 'synced' : 'idle';
    $('clock-title').textContent = syncing ? '正在校准' : '香港标准时间';
    if (!syncing) delete shell.dataset.syncPhase;
    $('clock').textContent = syncing ? '正在获取标准时间…' : clock ? '香港天文台 · 已同步' : '香港天文台 · 未同步';
    $('clock').title = clock ? `修正 ${Math.round(clock.offset)} ms · 估计误差 ±${clock.uncertainty} ms` : '请在开餐前 30 分钟内校时';
    $('sync').textContent = syncing ? '校准中' : clock ? '再校准' : '校准';
  }
  function showMeal() {
    const meal = MEALS[$('meal').value];
    const timeChanged = $('hero-time').textContent !== meal.start;
    $('hero-time').textContent = meal.start;
    $('service').textContent = `${meal.label} · ${meal.start}—${meal.end}`;
    setTime(`${meal.start}:00`);
    $('today').textContent = `今天 ${formatHK(slot())}`;
    $('active-target').textContent = `今天 ${meal.start} · ${meal.label.split(' ')[1]} · 香港时间`;
    $('arm').setAttribute('aria-label', `准备今天 ${meal.start} 结账`);
    root.querySelector('.slider').style.transform = `translateX(${Object.keys(MEALS).indexOf($('meal').value) * 100}%)`;
    root.querySelectorAll('.meal').forEach(button => {
      const selected = button.dataset.meal === $('meal').value;
      button.setAttribute('aria-checked', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    if (timeChanged && !reducedMotion.matches) $('hero-time').animate([{opacity:.2,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}], {duration:400,easing:'cubic-bezier(.22,1,.36,1)'});
  }
  function controls() {
    network.setActivity(pending ? '准备或校时中，测速暂停' : run?.demo ? '演练中，测速暂停' :
      run && run.phase !== 'waiting' ? '正在核对订单，测速暂停' : '', run?.deadline ?? null);
    const busy = !!run || pending;
    $('meal').disabled = busy;
    root.querySelectorAll('.meal').forEach(button => { button.disabled = busy; });
    $('arm').disabled = busy || !clock || !$('confirm').checked || lastAttempt?.slot === slot();
    $('sync').disabled = busy;
    $('demo').disabled = busy;
    $('confirm').disabled = busy;
    $('cancel').disabled = !busy || !!run?.cancelled;
    $('cancel').textContent = run?.sent ? '停止后续尝试' : '取消';
    $('warning').textContent = run?.sent ? '已发出 · 请勿重复提交' : shell.dataset.view === 'result' ? '以网站订单记录为准' : '前台 · 开盖 · 勿刷新或离开';
  }
  function findLink() {
    const links = [...document.querySelectorAll('a[href]')].filter(a =>
      /^proceed\s+to\s+checkout$/i.test(a.textContent.trim()) && a.getClientRects().length &&
      getComputedStyle(a).visibility !== 'hidden' && getComputedStyle(a).display !== 'none');
    if (links.length !== 1) throw new Error('未找到唯一可用的 Proceed To Checkout，请检查购物车');
    const link = links[0], url = new URL(link.href);
    if (url.origin !== location.origin || url.pathname !== '/ordered/' || url.search || url.hash ||
        link.getAttribute('aria-disabled') === 'true' || link.hasAttribute('disabled'))
      throw new Error('结账链接变化或不可用，已停止');
    return link;
  }
  function checkUnchanged(current) {
    if (!current.link.isConnected || findLink() !== current.link || current.link.href !== current.href)
      throw new Error('购物车按钮已变化，已停止');
    if (MealSite.cart(document).fingerprint !== current.cart.fingerprint)
      throw new Error('购物车内容已变化，请重新准备');
  }
  function remember(current, message, kind = 'unknown') {
    lastAttempt = { at: Date.now(), slot: current.target, message, result: resultFor(current, kind) };
    try { sessionStorage.setItem('meal-timer-last-attempt', JSON.stringify(lastAttempt)); } catch {}
  }
  function stop(message) {
    generation++;
    syncing = false; showClock();
    preparation?.abort(); preparation = null;
    run?.warmAbort?.abort(); clearTimeout(run?.demoTimer); clearTimeout(resultVisualTimer);
    clearTimeout(timer); clearInterval(displayTimer);
    if (run?.sent) {
      // Cancelling an HTTP request cannot undo an order. Stop retries but keep reading its outcome.
      run.cancelled = true;
      remember(run, '请求已发出，后续尝试已停止；请核对网站订单');
      status('已停止后续尝试，正在核对已经发出的请求；它可能已经下单。');
      $('orders').hidden = false; controls(); return;
    }
    const hadRun = !!run;
    run = null; pending = false;
    if (lease) send({ type: 'release', lease }).catch(() => {});
    lease = null;
    status(message); showMeal(); setView('setup'); controls();
    if (hadRun) log(message);
  }
  function finish(current, message, kind = 'unknown', detail = '') {
    if (run !== current) return;
    current.warmAbort?.abort(); clearTimeout(current.demoTimer);
    clearTimeout(timer); clearInterval(displayTimer);
    const result = resultFor(current, kind);
    if (!current.demo) {
      remember(current, message, kind);
      send({ type:'complete', lease:current.lease, message, result, at:lastAttempt.at }).catch(() => {}).finally(() =>
        send({ type:'release', lease:current.lease }).catch(() => {}));
    } else send({ type:'release', lease:current.lease }).catch(() => {});
    run = null; pending = false; lease = null; lastViewShown = true;
    log(message);
    // All measurements are already frozen. This short hold is presentation only.
    const hold = reducedMotion.matches ? 0 : Math.max(0, 560 - (performance.now() - (current.loadingAt || 0)));
    setLoading('done'); status(current.demo ? '演练已完成，正在显示结果…' : '订单核对已结束，正在显示结果…'); controls();
    clearTimeout(resultVisualTimer);
    resultVisualTimer = setTimeout(() => renderResult(result, message, detail), hold);
  }
  function syncRing(current) {
    ringAnimation?.cancel();
    const duration = Math.max(0, current.deadline - current.ringStart);
    if (!duration) { $('ring-progress').style.strokeDashoffset = '0'; return; }
    // Share the countdown's monotonic deadline; no independent looping timer.
    ringAnimation = $('ring-progress').animate(
      [{strokeDashoffset:'100'}, {strokeDashoffset:'0'}],
      {duration, easing:'linear', fill:'forwards'}
    );
    ringAnimation.startTime = current.ringStart;
  }
  function renderCountdown() {
    if (!run || run.phase !== 'waiting') return;
    const seconds = Math.ceil(Math.max(0, run.deadline - performance.now()) / 1000);
    setTime(`${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`);
  }
  async function warm(current) {
    current.warmAbort = new AbortController();
    try {
      const result = await MealSite.read('/cart/', { signal: current.warmAbort.signal, timeout: 4500 });
      if (run !== current || current.phase !== 'waiting') return;
      if (result.login) { stop('登录已失效，请重新登录后准备'); return; }
      if (!result.ok || !result.cart.valid) throw new Error('连接检查未完成');
      if (result.cart.fingerprint !== current.cart.fingerprint) { stop('购物车内容或余额已变化，请重新准备'); return; }
      $('connection').textContent = `连接已准备 · 最近检查 ${Math.round(result.ms)} ms`;
      log(`连接检查完成：${Math.round(result.ms)} ms`);
    } catch {
      if (run === current && current.phase === 'waiting') {
        $('connection').textContent = '最后一次连接检查未完成，将使用已核对的购物车按时尝试。';
        log('连接预热未完成；未发送结账请求');
      }
    }
  }
  async function resync(current) {
    try {
      const result = await send({ type: 'clock' });
      if (run !== current || current.phase !== 'waiting' || current.deadline - performance.now() < 8000) return;
      validateClock(result.clock, Date.now(), current.target);
      clock = result.clock; current.offset = clock.offset;
      current.deadline = current.mono + current.target - current.wall - current.offset;
      syncRing(current);
      controls();
      showClock(); log(`开餐前再次校时：误差范围约 ±${clock.uncertainty} ms`);
    } catch {
      if (run === current && current.phase === 'waiting') log('再次校时未完成，保留仍在有效期内的校时结果');
    }
  }
  async function verify(current, response) {
    setLoading('verify'); status('正在读取网站订单，核对餐品和数量…');
    const until = performance.now() + 12000;
    let outcome = 'unknown';
    for (let check = 0; check < 3; check++) {
      const read = path => {
        const remaining = until - performance.now();
        if (remaining <= 0) throw new Error('订单核对超时');
        return MealSite.read(path, {timeout:Math.min(6000, Math.ceil(remaining))});
      };
      const latestCart = check === 0 && response?.ok && response.cart.valid ? response : await read('/cart/');
      const latestOrders = await read('/order_details/');
      if (!latestCart.ok || !latestOrders.ok || latestCart.login || latestOrders.login) return 'unknown';
      outcome = MealSite.newOrderResult(current.orders, latestOrders.orders, current.cart, latestCart.cart);
      if (outcome === 'confirmed') {
        const now = performance.now();
        if (Math.abs((Date.now() - current.wall) - (now - current.mono)) <= 250)
          current.confirmDelayMs = Math.max(0, now - current.deadline);
        return outcome;
      }
      const previous = new Set(current.orders.rows.map(row => row.id));
      if (outcome === 'unknown' && latestCart.cart.fingerprint === current.cart.fingerprint && latestOrders.orders.valid &&
          latestOrders.orders.rows.every(row => previous.has(row.id))) {
        if (response && MealSite.isClosed(response, current.cart)) return 'closed';
        if (MealSite.isRejected(response, current.cart)) return 'rejected';
      }
      if (check < 2 && performance.now() < until) await new Promise(resolve => setTimeout(resolve, [250,600][check]));
    }
    return outcome;
  }
  function canRetry(current) {
    return !current.cancelled && document.visibilityState === 'visible' &&
      MealClock.retryWithinWindow(current, performance.now(), Date.now());
  }
  async function execute(current) {
    current.phase = 'sending'; current.warmAbort?.abort(); clearInterval(displayTimer);
    for (let attempt = 1; attempt <= 4; attempt++) {
      if (current.cancelled || document.visibilityState !== 'visible') {
        finish(current, '后续尝试已停止，请核对网站订单'); return;
      }
      let response;
      current.sent = true; current.attempts = attempt;
      const responsePromise = MealSite.read('/ordered/', { timeout:12000, onSend:sentAt => {
        current.lastSendDelayMs = Math.max(0, sentAt - current.deadline);
        if (attempt === 1) current.sendDelayMs = current.lastSendDelayMs;
      } });
      if (attempt === 1) {
        remember(current, '请求已发出，结果尚未确认，请查看订单');
        current.loadingAt = performance.now(); setTime('00:00:00'); setView('sending');
      }
      setLoading('request');
      // Persist the attempt without waiting on extension IPC before sending the site request.
      if (attempt === 1) send({ type:'sent', lease:current.lease, result:resultFor(current, 'unknown'), at:lastAttempt.at }).catch(() => {});
      controls();
      status(`第 ${attempt} 次请求已发出，等待网站回复…`);
      log(`结账请求 ${attempt}：调用发送延迟 ${current.lastSendDelayMs.toFixed(1)} ms`);
      try { response = await responsePromise; }
      catch (error) {
        log(`结账请求未确认：${error.name}`);
        let outcome = 'unknown';
        try { outcome = await verify(current); } catch {}
        finish(current, outcome === 'confirmed' ? '已在网站订单中确认本次餐品，未再次提交。' :
          outcome === 'changed' ? '连接中断后发现新增订单，请核对餐品和数量；已停止补发。' :
          '请求超时或连接中断，结果不明确；已停止补发，请查看订单。', outcome); return;
      }
      log(`结账回复 ${attempt}：${Math.round(response.ms)} ms，状态 ${response.status}`);
      if (response.login) { finish(current, '网站要求重新登录，已停止；请核对订单后重新登录'); return; }
      if (MealSite.isClosed(response, current.cart)) {
        if (attempt === 4 || !canRetry(current)) {
          let outcome = 'unknown';
          try { outcome = await verify(current, response); } catch {}
          const message = outcome === 'closed' ? '网站仍提示未开放，且未发现新增订单；已结束本餐次的自动尝试。' :
            outcome === 'confirmed' ? '已在订单记录中确认餐品，购物车已清空。' :
            '网站提示未开放，但订单核对未能完成；已停止自动提交，请查看网站订单。';
          finish(current, message, outcome); return;
        }
        status(`网站明确提示未开放，购物车和余额未变，稍后再试（${attempt}/4）…`);
        await new Promise(resolve => setTimeout(resolve, [100, 200, 400][attempt - 1]));
        if (!canRetry(current)) {
          finish(current, '已停止后续尝试，请核对网站订单'); return;
        }
        try { checkUnchanged(current); }
        catch { finish(current, '购物车或按钮发生变化，已停止后续尝试，请核对订单'); return; }
        continue;
      }
      let outcome = 'unknown';
      try { outcome = await verify(current, response); } catch {}
      const message = outcome === 'confirmed' ? '已确认新增订单与所选餐品相符，购物车已清空。' :
        outcome === 'rejected' ? '网站拒绝本次下单，购物车与订单记录未改变；已停止自动提交。' :
        outcome === 'changed' ? '发现新增订单，请到网站核对餐品和数量；已停止自动提交。' :
        '网站已回复，暂不能确认是否全部抢到；已停止自动提交，请查看订单。';
      finish(current, message, outcome, response.alerts.join('；')); return;
    }
  }
  function tick() {
    if (!run || run.phase !== 'waiting') return;
    const current = run, mono = performance.now(), remaining = current.deadline - mono;
    if (Math.abs((Date.now() - current.wall) - (mono - current.mono)) > 250) {
      clock = null; showClock(); stop('系统时间变化或电脑曾休眠，已取消；请重新校时'); return;
    }
    if (remaining > 0) {
      if (!current.demo && !current.resyncStarted && current.initialRemaining > 50000 && remaining <= 45000) {
        current.resyncStarted = true; void resync(current);
      }
      if (!current.demo && !current.warmStarted && remaining <= 8000 && remaining > 1000) {
        current.warmStarted = true; void warm(current);
      }
      timer = setTimeout(tick, timerDelay(remaining)); return;
    }
    if (-remaining > 1000) { stop('错过目标时间超过 1 秒，已停止，未补下单'); return; }
    if (document.visibilityState !== 'visible') { stop('页面不在前台，已停止'); return; }
    if (current.demo) {
      const delay = Math.max(0, mono - current.deadline).toFixed(1);
      current.phase = 'demo-loading'; current.loadingAt = performance.now(); clearInterval(displayTimer);
      setTime('00:00:00'); setView('sending'); setLoading('demo'); status('演示加载与结果过渡，不访问网站、不下单。');
      current.demoTimer = setTimeout(() => finish(current, `演练完成，未下单；本机触发延迟 ${delay} 毫秒`, 'demo'), 900);
      return;
    }
    try { validateClock(clock, current.target - clock.offset - 1, current.target); checkUnchanged(current); }
    catch (error) { stop(error.message); return; }
    void execute(current).catch(() => finish(current, '执行结果不明确，已停止自动提交，请查看订单'));
  }
  async function start(demo) {
    if (run || pending) return;
    const token = ++generation, attemptLease = crypto.randomUUID(); lease = attemptLease;
    clearTimeout(resultVisualTimer);
    pending = true; controls(); if (!demo) setView('preparing');
    preparation = new AbortController();
    const signal = preparation.signal;
    let claimed = false;
    try {
      if (document.visibilityState !== 'visible') throw new Error('请先切换到购物车页面');
      if (!demo && !$('confirm').checked) throw new Error('请先确认已选好餐品');
      const wall = Date.now(), mono = performance.now(), offset = demo ? 0 : clock?.offset || 0;
      const target = demo ? wall + 5000 : targetToday(wall + offset, $('meal').value);
      if (!demo) validateClock(clock, wall, target);
      const link = demo ? null : findLink();
      await send({ type: 'claim', target: target - offset, slot: demo ? null : target, lease: attemptLease }); claimed = true;
      if (token !== generation) { await send({ type: 'release', lease: attemptLease }); return; }
      let cart, orders;
      if (!demo) {
        status('正在检查登录、购物车和订单记录…');
        const freshCart = await MealSite.read('/cart/', { signal });
        if (freshCart.login) throw new Error('登录已失效，请重新登录');
        if (!freshCart.ok || !freshCart.cart.valid || !freshCart.cart.items.length) throw new Error('无法确认购物车内容，请刷新后重新准备');
        cart = freshCart.cart;
        if (MealSite.cart(document).fingerprint !== cart.fingerprint) throw new Error('购物车页面已过期，请刷新后重新准备');
        const freshOrders = await MealSite.read('/order_details/', { signal });
        if (!freshOrders.ok || freshOrders.login || !freshOrders.orders.valid) throw new Error('无法读取订单记录，请稍后重新准备');
        orders = freshOrders.orders;
        if (token !== generation) return;
        validateClock(clock, Date.now(), target);
        $('connection').textContent = `登录和购物车已核对 · 连接 ${Math.round(freshCart.ms)} ms`;
      }
      if (token !== generation) return;
      run = { demo, phase: 'waiting', lease: attemptLease, wall, mono, offset, deadline: mono + target - wall - offset,
        initialRemaining: target - wall - offset, target, link, href: link?.href, cart, orders, sent: false };
      run.ringStart = performance.now(); syncRing(run);
      pending = false; preparation = null; setView('waiting'); controls(); $('orders').hidden = true;
      status(demo ? '演练倒计时，不会下单。' : '已准备 · 到点直接结账；明确未开放时最多尝试 4 次');
      log(demo ? '开始安全演练' : `已准备：${formatHK(target)}；校时误差范围约 ±${clock.uncertainty} 毫秒`);
      renderCountdown(); displayTimer = setInterval(renderCountdown, 200); tick();
    } catch (error) {
      if (token === generation) { pending = false; preparation = null; setView('setup'); status(error.message); controls(); }
    } finally {
      if (claimed && (!run || run.lease !== attemptLease)) send({ type: 'release', lease: attemptLease }).catch(() => {});
    }
  }
  root.querySelectorAll('.meal').forEach(button => {
    button.addEventListener('click', () => {
      if (run || pending || $('meal').value === button.dataset.meal) return;
      $('meal').value = button.dataset.meal;
      $('meal').dispatchEvent(new Event('change'));
    });
    button.addEventListener('keydown', event => {
      const buttons = [...root.querySelectorAll('.meal')];
      const index = buttons.indexOf(button);
      const next = event.key === 'ArrowRight' ? (index + 1) % 3 : event.key === 'ArrowLeft' ? (index + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : -1;
      if (next < 0 || run || pending) return;
      event.preventDefault(); buttons[next].focus(); buttons[next].click();
    });
  });
  reducedMotion.addEventListener('change', () => {
    if (!reducedMotion.matches) return;
    transitionId++; paneAnimations.forEach(animation => animation.cancel()); paneAnimations = [];
    stage.querySelectorAll(':scope > .view').forEach(pane => { pane.hidden = pane !== activePane; pane.style.cssText = ''; });
    stage.style.height = ''; delete shell.dataset.transitioning;
  });
  $('back').addEventListener('click', () => {
    if (run || pending) return;
    clearTimeout(resultVisualTimer); lastViewShown = true;
    setView('setup'); showMeal(); controls(); $('status').hidden = true; $('orders').hidden = true;
  });
  $('meal').addEventListener('change', () => {
    $('confirm').checked = false; showMeal(); controls();
    status('已切换餐次，请确认对应餐品和开餐时间后再准备。');
  });
  $('confirm').addEventListener('change', controls);
  $('arm').addEventListener('click', () => start(false));
  $('demo').addEventListener('click', () => start(true));
  $('cancel').addEventListener('click', () => stop('已取消，不会自动结账'));
  $('sync').addEventListener('click', async () => {
    if (pending || run) return;
    const token = ++generation, began = performance.now();
    const wait = ms => new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
    pending = true; syncing = true; shell.dataset.syncPhase = 'measuring';
    showClock(); controls(); status('正在向香港天文台校时…');
    try {
      const result = await send({ type: 'clock' });
      if (token !== generation) return;
      // Keep the reveal readable; this is presentation time, not extra network work.
      await wait(750 - (performance.now() - began));
      if (token !== generation) return;
      const correction = Math.round(result.clock.offset);
      $('clock-title').textContent = `修正 ${correction >= 0 ? '+' : ''}${correction} 毫秒`;
      $('clock').textContent = `预估误差 ±${result.clock.uncertainty} 毫秒`;
      shell.dataset.syncPhase = 'details';
      await wait(Math.max(2000, 3200 - (performance.now() - began)));
      if (token !== generation) return;
      shell.dataset.syncPhase = 'leaving';
      await wait(400);
      if (token !== generation) return;
      clock = result.clock; showMeal(); status('');
    } catch (error) {
      if (token === generation) { clock = null; status(error.message); }
    } finally {
      if (token === generation) { pending = false; syncing = false; showClock(); controls(); }
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' && (run || pending)) stop('页面切到后台，已取消；回到本页后重新准备');
  });
  window.addEventListener('pagehide', () => stop('页面已离开，任务已取消'));
  showMeal();
  try { lastAttempt = JSON.parse(sessionStorage.getItem('meal-timer-last-attempt') || 'null'); } catch {}
  function showLast() {
    if (lastAttempt && Date.now() - lastAttempt.at < 30 * 60_000 && !run && !pending && !lastViewShown) {
      lastViewShown = true;
      const result = MealClock.cleanResult(lastAttempt.result) || {kind:'unknown',sendDelayMs:null,confirmDelayMs:null,attempts:0};
      renderResult(result, lastAttempt.message);
    }
    controls();
  }
  showLast();
  send({ type: 'state' }).then(result => {
    if (result.lastAttempt && (!lastAttempt || result.lastAttempt.at > lastAttempt.at)) lastAttempt = result.lastAttempt;
    showLast();
  }).catch(() => {});
})();
