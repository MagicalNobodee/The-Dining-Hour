chrome.storage.local.get('records').then(({ records = [] }) => {
  document.getElementById('logs').textContent = records.length ? records.map(r =>
    `${new Date(r.at).toLocaleString('zh-CN', { timeZone: 'Asia/Hong_Kong', hour12: false })}\n${r.message}`
  ).join('\n\n') : '尚无记录';
});
