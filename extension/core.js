/* Shared by the content script and the local tests. */
(() => {
  const HK_OFFSET = 8 * 3600_000;
  const CLOCK_TTL = 30 * 60_000;
  const MEALS = {
    breakfast: { label: 'Breakfast 早餐', start: '07:40', end: '09:30' },
    lunch: { label: 'Lunch 午餐', start: '12:20', end: '13:45' },
    dinner: { label: 'Dinner 晚餐', start: '18:50', end: '20:00' }
  };
  function targetToday(now, meal = 'dinner') {
    if (!Object.hasOwn(MEALS, meal)) throw new Error('请选择有效餐次');
    const day = new Date(now + HK_OFFSET).toISOString().slice(0, 10);
    return Date.parse(`${day}T${MEALS[meal].start}:00+08:00`);
  }
  function formatHK(time) {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    }).format(new Date(time));
  }
  function parseTime(text) {
    const match = /^0=([0-9A-Za-z]{16})\s*$/.exec(text);
    if (!match) throw new Error('校时服务返回了无法识别的数据');
    // HKO's public clock9a format: six shifted base-62 digits, five base-60 places.
    const positions = [10, 4, 7, 13, 1, 15], shifts = [17, 20, 24, 13, 2, 0];
    const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const values = positions.map((position, i) => (alphabet.indexOf(match[1][position]) - shifts[i] + 62) % 62);
    let seconds = 1555200000;
    for (let i = 0; i < 5; i++) seconds += values[i] * 60 ** (4 - i);
    return Math.round((seconds + values[5] / 61) * 1000);
  }
  function validateClock(clock, now, target) {
    if (!clock || !Number.isFinite(clock.offset) || !Number.isFinite(clock.at) ||
        !Number.isFinite(clock.uncertainty) || clock.uncertainty < 0 || clock.uncertainty > 760)
      throw new Error('请先成功校时');
    if (now < clock.at - 1000 || now - clock.at > CLOCK_TTL || target - (clock.at + clock.offset) > CLOCK_TTL)
      throw new Error('校时已过期或距离开饭太久，请在所选餐次开餐前 30 分钟内重新校时');
    if (target <= now + clock.offset) throw new Error('今天所选餐次的开餐时间已过，不会补下单；请选择其他餐次或明天重新准备');
  }
  function timerDelay(remaining) {
    if (remaining > 1000) return Math.min(remaining - 1000, 250);
    if (remaining > 50) return 10;
    return 1;
  }
  function retryWithinWindow(run, mono, wall) {
    return mono < run.deadline + 4000 && Math.abs((wall - run.wall) - (mono - run.mono)) <= 250;
  }
  function cleanResult(value) {
    if (!value || typeof value !== 'object') return null;
    if (!['confirmed', 'closed', 'rejected', 'changed', 'unknown', 'demo'].includes(value.kind)) return null;
    const duration = n => Number.isFinite(n) && n >= 0 && n <= 3600_000 ? Math.round(n * 10) / 10 : null;
    return { kind: value.kind, sendDelayMs: value.kind === 'demo' ? null : duration(value.sendDelayMs),
      confirmDelayMs: value.kind === 'confirmed' ? duration(value.confirmDelayMs) : null,
      attempts: Number.isInteger(value.attempts) && value.attempts >= 0 && value.attempts <= 4 ? value.attempts : 0 };
  }
  const api = { cleanResult, retryWithinWindow, MEALS, targetToday, formatHK, parseTime, validateClock, timerDelay, CLOCK_TTL };
  if (typeof module !== 'undefined') module.exports = api;
  else globalThis.MealClock = api;
})();
