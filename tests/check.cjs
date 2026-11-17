const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http'), https = require('node:https'), net = require('node:net');
const {execFileSync} = require('node:child_process');
const { chromium, executablePath } = require('./runtime.cjs');
const core = require('../extension/core.js');
const base = Date.parse('2026-11-05T18:49:50+08:00');
assert.equal(core.targetToday(base), Date.parse('2026-11-05T18:50:00+08:00'));
assert.equal(core.targetToday(base, 'breakfast'), Date.parse('2026-11-05T07:40:00+08:00'));
assert.equal(core.targetToday(base, 'lunch'), Date.parse('2026-11-05T12:20:00+08:00'));
assert.equal(core.targetToday(Date.parse('2026-11-05T16:30:00Z')), Date.parse('2026-11-06T18:50:00+08:00'));
assert.throws(() => core.targetToday(base, 'invalid'));
assert.equal(core.parseTime('0=s5KaiMlKlIZ7atn6'), 1793875323098);
assert.throws(() => core.parseTime('<html>blocked</html>'));
for (const clock of [null, {offset:0,at:base-31*60000,uncertainty:10}, {offset:0,at:base,uncertainty:-1}])
  assert.throws(() => core.validateClock(clock, base, base+10000));
assert.throws(() => core.validateClock({offset:500,at:base,uncertainty:10},base+10000,base+10000));
core.validateClock({offset:100,at:base,uncertainty:10},base,base+10000);
const retryAnchor={wall:10000,mono:100,deadline:1000};
assert.equal(core.retryWithinWindow(retryAnchor,1100,11000),true);
assert.equal(core.retryWithinWindow(retryAnchor,5000,14900),false);
assert.equal(core.retryWithinWindow(retryAnchor,1100,61000),false,'sleep or wall-clock jump must stop retries');
assert.deepEqual(core.cleanResult({kind:'unknown',sendDelayMs:2.345,confirmDelayMs:12,attempts:1}),{kind:'unknown',sendDelayMs:2.3,confirmDelayMs:null,attempts:1});
assert.equal(core.cleanResult({kind:'confirmed',sendDelayMs:NaN,confirmDelayMs:Infinity}).confirmDelayMs,null);
assert.equal(core.cleanResult({kind:'demo',sendDelayMs:10,confirmDelayMs:20}).sendDelayMs,null);
assert.equal(core.cleanResult({kind:'forged'}),null);
const pause = ms => new Promise(r => setTimeout(r, ms));
const dish = {id:1,name:'Test meal',description:'测试餐品',price:10,quantity:1};
const closed = ['Test meal is not available right now for Close Hours','The Dining Hall is closed'];
const cartHTML = ({items=[dish],balance=200,alerts=[]}={}) => `<!doctype html><html><head><meta charset="utf-8"></head><body style="font:18px system-ui;padding:40px;background:#f5f6f2"><form action="/accounts/logout/"><button>Logout</button></form>${alerts.map(a=>`<div class="alert alert-warning">${a}</div>`).join('')}<div class="cart"><h3>Your Cart</h3>${items.length ? `<table><thead><tr><th></th><th>Name</th><th>Description</th><th>Specification</th><th>Price</th><th>Quantity</th></tr></thead><tbody>${items.map(i=>`<tr><td><a href="/remove-from-cart/${i.id}/">Delete</a></td><td>${i.name}</td><td>${i.description}</td><td>Available</td><td>${i.price}.0</td><td>${i.quantity} dish</td></tr>`).join('')}</tbody></table>` : '<h4>Sorry, Your Cart is Empty....Please add Items!!!</h4>'}<h3>Your Balance</h3><ul>${[`Meals Balance: ${balance}.0`,'Breakfast Balance: 100.0',`Total: ${items.length?items.reduce((a,i)=>a+i.price*i.quantity,0):'None'}`,`Number of Dishes: ${items.length?items.reduce((a,i)=>a+i.quantity,0):'None'}`].map(x=>`<li class="list-group-item">${x}</li>`).join('')}${items.length?'<li><a href="/ordered/">Proceed To Checkout</a></li>':''}</ul></div></body></html>`;
const orderHTML = (rows=[]) => `<!doctype html><html><head><meta charset="utf-8"></head><body><h3>Active Orders</h3><table><thead><tr><th>Order No.</th><th>Ordered</th><th>Name</th><th>Description</th><th>Price</th><th>Quantity</th><th>Order Status</th><th>Delivery Date</th></tr></thead><tbody>${rows.map(i=>`<tr><td><a href="/order_summary/${i.orderId}/">Order ${i.orderId}</a></td><td>Today</td><td>${i.name}</td><td>${i.description}</td><td>${i.price}.0</td><td>${i.quantity}</td><td>${i.status||'Pending'}</td><td>Today</td></tr>`).join('')}</tbody></table><h3>Past Orders</h3></body></html>`;
(async()=>{
  fs.mkdirSync('artifacts/results',{recursive:true});
  const profile=fs.mkdtempSync('/tmp/meal-optimized-test-');
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',profile+'/key.pem','-out',profile+'/cert.pem','-days','1','-subj','/CN=dh.stjohns.hk'],{stdio:'ignore'});
  const fixtureServer=https.createServer({key:fs.readFileSync(profile+'/key.pem'),cert:fs.readFileSync(profile+'/cert.pem')});
  await new Promise(resolve=>fixtureServer.listen(0,'127.0.0.1',resolve));
  const proxy=http.createServer((_req,res)=>{res.writeHead(403);res.end();});
  proxy.on('connect',(req,client,head)=>{
    client.on('error',()=>{});
    if(req.url!=='dh.stjohns.hk:443'){client.end('HTTP/1.1 403 Forbidden\r\n\r\n');return;}
    const upstream=net.connect(fixtureServer.address().port,'127.0.0.1',()=>{
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n');if(head.length)upstream.write(head);
      upstream.pipe(client);client.pipe(upstream);
    });
    client.on('error',()=>upstream.destroy());upstream.on('error',()=>client.destroy());
    client.on('close',()=>upstream.destroy());
  });
  await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve));
  const context=await chromium.launchPersistentContext(profile,{
    executablePath,
    headless:true,ignoreHTTPSErrors:true,proxy:{server:`http://127.0.0.1:${proxy.address().port}`},args:[`--disable-extensions-except=${path.resolve('extension')}`,`--load-extension=${path.resolve('extension')}`],viewport:{width:1150,height:820}
  });
  const passed=[],errors=[];let scenario,requests=[],worker;
  fs.mkdirSync('artifacts/results',{recursive:true});
  const ok=name=>{passed.push(name);console.log('PASS:',name);};
  try{
    worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
    await worker.evaluate(()=>{globalThis.fetch=async()=>new Response('fixture',{status:200});});
    await context.addCookies([{name:'sessionid',value:'isolated-test-session',domain:'dh.stjohns.hk',path:'/',secure:true}]);
    // Every site request, including Chromium's redirect chain, stays behind this local proxy.
    fixtureServer.on('request',async(req,res)=>{
      const active=scenario;
      const u=new URL(req.url,'https://dh.stjohns.hk');
      const kind=req.headers['sec-fetch-dest']==='document'?'document':'fetch';
      const item={path:u.pathname,method:req.method,kind,at:Date.now(),body:null,cookie:(req.headers.cookie||'').includes('isolated-test-session')};
      requests.push(item);
      const reply=(body,status=200,headers={})=>{res.writeHead(status,{'content-type':'text/html; charset=utf-8','cache-control':'no-store',...headers});res.end(body);};
      if(u.pathname==='/ordered/'){
        active.attempts++;active.inFlight++;active.maxInFlight=Math.max(active.maxInFlight,active.inFlight);
        await pause(active.orderDelay||20);
        const attempt=active.attempts;
        if(active.abort){active.inFlight--;req.socket.destroy();return;}
        if(active.successAt&&attempt>=active.successAt){active.rows=[{...dish,orderId:101}];active.items=[];active.balance=190;active.alerts=[];active.showOrdersAt=Date.now()+(active.orderVisibilityDelay||0);}
        else if(active.fakeSuccess){active.alerts=['Order successfully placed'];}
        else if(active.emptyWithoutOrder){active.items=[];active.balance=190;active.alerts=[];}
        else if(active.partial){active.rows=[{...dish,orderId:101}];active.items=[{...dish,id:2,name:'Other meal'}];active.balance=190;active.alerts=closed;}
        else if(active.ambiguous){active.alerts=['Service temporarily unavailable'];}
        else if(active.conflicting){active.alerts=[...closed,'Insufficient balance'];}
        else if(active.changedBalance){active.balance=190;active.alerts=closed;}
        else active.alerts=closed;
        active.inFlight--;
        if(active.httpError)return reply(cartHTML({...active,alerts:closed}),500);
        return reply('',302,{location:active.login?'/accounts/login/':'/cart/'});
      }
      if(u.pathname==='/cart/'){
        if(kind==='fetch'&&active.cartDelay)await pause(active.cartDelay);
        if(active.preflightLogin&&kind==='fetch')return reply('',302,{location:'/accounts/login/'});
        if(active.warmChanged&&requests.filter(x=>x.path==='/cart/'&&x.kind==='fetch').length>=2)active.items=[{...dish,quantity:2}];
        return reply(cartHTML(active));
      }
      if(u.pathname==='/order_details/'){
        const body=orderHTML(Date.now() < (active.showOrdersAt||0) ? [] : active.rows);
        if(active.attempts && active.ordersBodyDelay){
          res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
          const split=Math.floor(body.length/2);res.write(body.slice(0,split));
          await pause(active.ordersBodyDelay);active.orderBodyEndedAt=Date.now();res.end(body.slice(split));return;
        }
        return reply(body);
      }
      if(u.pathname==='/static/main/styles.css')return reply('body { color: #222; }',200,{'content-type':'text/css'});
      if(u.pathname==='/accounts/login/')return reply('<input type="password"><h1>Login</h1>');
      if(u.pathname==='/favicon.ico')return reply('',204);
      return reply('Not found',404);
    });
    async function reset(options={}){
      for(const p of context.pages())await p.close();
      await worker.evaluate(async()=>{await queue;await chrome.storage.session.clear();await chrome.storage.local.remove('records');chrome.power.releaseKeepAwake();});
      scenario={items:[dish],balance:200,alerts:[],rows:[],attempts:0,inFlight:0,maxInFlight:0,...options};requests=[];
      const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
      await p.goto('https://dh.stjohns.hk/cart/');await p.locator('#meal-timer-extension').waitFor();return p;
    }
    async function arm(p,{meal='dinner',lead=1800}={}){
      const target=core.targetToday(Date.now(),meal);
      await worker.evaluate(remote=>{const start=Date.now();MealClock.parseTime=()=>remote+Date.now()-start;},target-lead-3800);
      await p.getByRole('radio',{name:new RegExp(core.MEALS[meal].label)}).click();
      await p.getByRole('button',{name:'校准时间',exact:true}).click();
      await p.locator('.shell[data-sync="synced"]').waitFor();
      await p.locator('#confirm').check();
      await p.locator('#arm').click();
      return target;
    }
    const status=p=>p.locator('#status');
    let p=await reset();
    await p.locator('.shell').screenshot({path:'artifacts/results/design-setup.png'});
    const panel=p.locator('#meal-timer-extension'),before=await panel.boundingBox(),handle=await panel.locator('header').boundingBox();
    await p.mouse.move(handle.x+25,handle.y+10);await p.mouse.down();await p.mouse.move(handle.x-350,handle.y-150,{steps:8});await p.mouse.up();
    const moved=await panel.boundingBox();assert.ok(moved.x<before.x-300&&moved.y<before.y-100);
    await p.setViewportSize({width:400,height:480});await p.waitForFunction(()=>{const b=document.getElementById('meal-timer-extension').getBoundingClientRect();return b.x>=0&&b.y>=0&&b.right<=400&&b.bottom<=480;});const small=await panel.boundingBox();assert.ok(small.x>=0&&small.y>=0&&small.x+small.width<=400&&small.y+small.height<=480);
    await p.setViewportSize({width:1150,height:820});
    for(const [meal,time]of[['breakfast','07:40:00'],['lunch','12:20:00'],['dinner','18:50:00']]){await p.getByRole('radio',{name:new RegExp(core.MEALS[meal].label)}).click();assert.equal(await p.locator('#countdown').textContent(),time);}
    assert.equal(scenario.attempts,0);ok('meal selection, drag, viewport constraints');
    await p.waitForFunction(()=>document.getElementById('meal-network-indicator').shadowRoot.getElementById('failures').textContent==='0 / 5 次');
    assert.ok(Number(await p.locator('#meal-network-indicator').locator('#value').textContent())>0);
    assert.equal(requests.filter(r=>r.path==='/static/main/styles.css').length,6);
    ok('installed extension measures same-origin resources in its actual content-script context');
    await p.addScriptTag({path:path.resolve('extension/site.js')});
    const parsed=await p.evaluate(({cart,orders})=>{const c=MealSite.snapshot(new DOMParser().parseFromString(cart,'text/html'),location.href);const o=MealSite.orders(new DOMParser().parseFromString(orders,'text/html'));return {cart:c.cart,orders:o};},{cart:cartHTML(),orders:orderHTML([{...dish,orderId:101}])});
    assert.equal(parsed.cart.valid,true);assert.equal(parsed.cart.items[0].quantity,1);assert.equal(parsed.orders.rows[0].id,'101');ok('actual site-shaped cart and order parsing');
    const duplicate=await p.evaluate(({expected,empty,rows})=>{const parse=x=>new DOMParser().parseFromString(x,'text/html');return MealSite.newOrderResult({valid:true,rows:[]},MealSite.orders(parse(rows)),MealSite.cart(parse(expected)),MealSite.cart(parse(empty)));},{expected:cartHTML(),empty:cartHTML({items:[],balance:180}),rows:orderHTML([{...dish,orderId:101},{...dish,orderId:102}])});
    assert.equal(duplicate,'changed');ok('duplicate matching orders require manual verification');


    p=await reset({successAt:1});await arm(p,{lead:2600});await p.locator('.shell[data-view="waiting"]').waitFor();await p.screenshot({path:'artifacts/results/ready.png'});
    assert.equal(scenario.attempts,0);await p.locator('.shell[data-view="result"][data-result="success"]').waitFor();
    assert.equal(scenario.attempts,1);assert.equal(scenario.maxInFlight,1);
    const preparingAt=requests.find(r=>r.path==='/cart/' && r.kind==='fetch').at;
    const verifiedAt=requests.filter(r=>r.path==='/order_details/' && r.kind==='fetch').at(-1).at;
    assert.equal(requests.filter(r=>r.path==='/static/main/styles.css' && r.at>=preparingAt && r.at<=verifiedAt).length,0,'preparation and checkout suppress probes; post-result monitoring may resume');
    ok('no background speed probes during preparation and checkout');
    const checkout=requests.find(x=>x.path==='/ordered/');assert.equal(checkout.kind,'fetch');assert.equal(checkout.method,'GET');assert.equal(checkout.body,null);assert.equal(checkout.cookie,true);
    assert.ok(requests.filter(x=>x.path==='/cart/'&&x.kind==='fetch').length>=2,'preparation and warmup');
    assert.match((await worker.evaluate(async()=>(await chrome.storage.session.get('lastAttempt')).lastAttempt)).message,/已确认新增订单/);
    const successMetrics=await p.evaluate(()=>{const r=document.getElementById('meal-timer-extension').shadowRoot;return {send:Number(r.getElementById('send-delay').dataset.ms),confirm:Number(r.getElementById('confirm-delay').dataset.ms)};});
    assert.ok(successMetrics.send>=0&&successMetrics.confirm>=successMetrics.send);
    assert.ok(successMetrics.confirm-successMetrics.send<350,'fast confirmation excludes the visual loading hold');
    assert.ok(Date.now()-checkout.at>=350,'loading transition is actually visible');
    assert.equal(new URL(p.url()).pathname,'/cart/','result stays visible instead of navigating away');
    await p.locator('.shell').screenshot({path:'artifacts/results/success.png',animations:'disabled'});
    await p.reload();await p.locator('.shell[data-view="result"][data-result="success"]').waitFor();
    assert.equal(Number(await p.locator('#send-delay').getAttribute('data-ms')),successMetrics.send);
    assert.equal(Number(await p.locator('#confirm-delay').getAttribute('data-ms')),successMetrics.confirm);
    assert.equal(scenario.attempts,1);
    ok('success result persists both measured metrics through refresh without another checkout');
    ok('foreground fetch, session reuse, prewarm, order confirmation, no repeated checkout');

    p=await reset({successAt:1,orderDelay:160,ordersBodyDelay:1000});await arm(p,{lead:2200});
    await p.locator('.shell[data-view="sending"][data-loading-phase="verify"]').waitFor();
    assert.equal(await p.locator('#result-view').isVisible(),false,'never show success before complete order HTML');
    await p.locator('.shell').screenshot({path:'artifacts/results/loading.png',animations:'disabled'});
    await p.locator('.shell[data-view="result"][data-result="success"]').waitFor();
    const delayedSend=Number(await p.locator('#send-delay').getAttribute('data-ms'));
    const delayedConfirm=Number(await p.locator('#confirm-delay').getAttribute('data-ms'));
    assert.ok(delayedConfirm-delayedSend>=1100,'success clock includes waiting for full order response');
    assert.ok(Date.now()>=scenario.orderBodyEndedAt);assert.equal(scenario.attempts,1);
    assert.equal(requests.filter(r=>r.path==='/static/main/styles.css' && r.at<=scenario.orderBodyEndedAt).length,0,'no probe while awaiting the full verification body');
    ok('spinner remains until full order page is loaded; success timing uses verified evidence');
    p=await reset({successAt:1,orderVisibilityDelay:800});await arm(p);
    await p.locator('.shell[data-view="result"][data-result="success"]').waitFor();
    assert.equal(scenario.attempts,1);assert.ok(Number(await p.locator('#confirm-delay').getAttribute('data-ms'))>=800);
    ok('late order visibility is rechecked read-only without resubmitting checkout');
    p=await reset({successAt:2});await arm(p);await p.locator('.shell[data-view="result"][data-result="success"]').waitFor();assert.equal(scenario.attempts,2);assert.equal(scenario.maxInFlight,1);const retried=await worker.evaluate(async()=>(await chrome.storage.session.get('lastAttempt')).lastAttempt.result);
    const firstSend=(await worker.evaluate(async()=>(await chrome.storage.local.get('records')).records)).find(r=>r.message.startsWith('结账请求 1：'));
    assert.equal(retried.attempts,2);assert.equal(retried.sendDelayMs,Number(/延迟 ([\d.]+) ms/.exec(firstSend.message)[1]));
    assert.ok(retried.confirmDelayMs>retried.sendDelayMs+100);
    ok('retry result retains first-send delay and includes retries in confirmation delay');
    ok('explicit closed response retries once then confirms success');
    p=await reset();await arm(p);await p.getByText(/网站仍提示未开放，且未发现新增订单/).waitFor();assert.equal(scenario.attempts,4);assert.equal(scenario.maxInFlight,1);assert.equal(await p.locator('#confirm-delay').getAttribute('data-ms'),'');assert.equal(await p.locator('#result-title').textContent(),'未能下单');await p.locator('.shell').screenshot({path:'artifacts/results/failed.png',animations:'disabled'});ok('closed responses stop at four serial attempts; failed result has no success duration');
    const lastCount=scenario.attempts;await p.reload();await p.locator('.shell[data-view="result"]').waitFor();await p.getByRole('button',{name:'返回设置',exact:true}).click();await p.getByRole('button',{name:'校准时间',exact:true}).click();await p.locator('.shell[data-sync="synced"]').waitFor();await p.locator('#confirm').check();assert.equal(await p.locator('#arm').isDisabled(),true);assert.equal(scenario.attempts,lastCount);ok('reload cannot rearm the same submitted meal');

    for(const [options,label]of[[{ambiguous:true},'unknown response'],[{conflicting:true},'mixed closed and failure alerts'],[{changedBalance:true},'balance changed'],[{partial:true},'partial order'],[{emptyWithoutOrder:true},'empty cart without a matching order'],[{httpError:true},'server error'],[{fakeSuccess:true},'unverified success wording']]){
      p=await reset(options);await arm(p);await p.getByText(/已停止自动提交/).waitFor();assert.equal(scenario.attempts,1,label);assert.notEqual(await p.locator('#result-title').textContent(),'下单成功');assert.equal(await p.locator('#confirm-delay').getAttribute('data-ms'),'');ok(label+' never retries or declares full success');
    }
    p=await reset({orderDelay:4300});await arm(p);await p.getByText(/网站仍提示未开放，且未发现新增订单/).waitFor();assert.equal(scenario.attempts,1);ok('retry window expires while waiting for a slow closed response');
    p=await reset({abort:true});await arm(p);await p.getByText(/请求超时或连接中断/).waitFor();assert.ok(scenario.attempts>=1&&scenario.attempts<=2);const transportAttempts=scenario.attempts;const appAttempts=(await worker.evaluate(async()=>(await chrome.storage.local.get('records')).records)).filter(r=>/^结账请求 \d+：调用/.test(r.message));assert.equal(appAttempts.length,1);ok(`transport failure: one application attempt, ${transportAttempts} browser transport attempts; no application retry`);
    p=await reset({login:true});await arm(p);await p.getByText(/网站要求重新登录/).waitFor();assert.equal(scenario.attempts,1);ok('login redirect stops retries');
    p=await reset({preflightLogin:true});await arm(p);await p.getByText('登录已失效，请重新登录',{exact:true}).waitFor();assert.equal(scenario.attempts,0);ok('expired login blocks arming');
    p=await reset({warmChanged:true});await arm(p,{lead:2300});await p.getByText(/购物车内容或余额已变化/).waitFor();await pause(2500);assert.equal(scenario.attempts,0);ok('prewarm detects remote cart changes');
    p=await reset();await arm(p,{lead:1800});await p.locator('.shell[data-view="waiting"]').waitFor();await p.locator('a[href="/ordered/"]').evaluate(a=>a.href='/wrong/');await p.getByText(/结账链接变化或不可用/).waitFor();assert.equal(scenario.attempts,0);ok('changed destination blocks sending');
    p=await reset({orderDelay:1200,successAt:1});await arm(p);await p.getByText(/第 1 次请求已发出/).waitFor();await p.getByRole('button',{name:'停止后续尝试',exact:true}).click();await p.locator('.shell[data-view="result"][data-result="success"]').waitFor();assert.equal(scenario.attempts,1);ok('cancel after send still checks actual outcome, no duplicate');
    p=await reset({cartDelay:1200});await arm(p,{lead:5000});await p.locator('.shell[data-view="preparing"]').waitFor();await p.getByRole('button',{name:'取消',exact:true}).click();await pause(1500);assert.equal(scenario.attempts,0);assert.match(await status(p).textContent(),/已取消/);ok('cancel during preflight aborts preparation');

    p=await reset();await arm(p,{lead:52000});await p.locator('.shell[data-view="waiting"]').waitFor();
    await p.locator('#ring-progress').evaluate(el=>{window.__firstRingAnimation=el.getAnimations()[0];});
    await p.waitForFunction(()=>document.querySelector('#meal-timer-extension').shadowRoot.getElementById('countdown').textContent<='00:00:45');
    for(let i=0;i<40;i++){const logs=await worker.evaluate(async()=>(await chrome.storage.local.get('records')).records||[]);if(logs.some(r=>r.message.startsWith('开餐前再次校时')))break;await pause(100);}
    assert.ok((await worker.evaluate(async()=>(await chrome.storage.local.get('records')).records)).some(r=>r.message.startsWith('开餐前再次校时')));
    const ringSync=await p.locator('#ring-progress').evaluate(el=>{
      const animation=el.getAnimations()[0];
      const parts=el.getRootNode().getElementById('countdown').textContent.split(':').map(Number);
      return {replaced:animation!==window.__firstRingAnimation,remaining:(animation.effect.getTiming().duration-animation.currentTime)/1000,display:parts[0]*3600+parts[1]*60+parts[2]};
    });
    assert.ok(ringSync.replaced&&Math.abs(ringSync.display-ringSync.remaining)<1.3,'ring retimes to corrected deadline');
    await p.getByRole('button',{name:'取消',exact:true}).click();assert.equal(scenario.attempts,0);ok('last-minute clock refresh completes before request window');
    for(const meal of ['breakfast','lunch']){p=await reset({successAt:1});await arm(p,{meal});await p.locator('.shell[data-view="result"][data-result="success"]').waitFor();assert.equal(scenario.attempts,1);ok(meal+' uses its own Hong Kong opening time');}
    p=await reset();await p.getByRole('button',{name:'5 秒演练',exact:true}).click();await p.getByText(/演练完成，未下单/).waitFor();assert.equal(scenario.attempts,0);assert.equal(requests.filter(x=>x.kind==='fetch'&&['/cart/','/order_details/','/ordered/'].includes(x.path)).length,0);ok('rehearsal performs no site requests');
    await p.getByRole('button',{name:'返回设置',exact:true}).click();await p.getByRole('button',{name:'5 秒演练',exact:true}).click();await p.getByRole('button',{name:'取消',exact:true}).click();await pause(5100);assert.match(await status(p).textContent(),/已取消/);ok('cancelled rehearsal remains cancelled');
    await p.getByRole('button',{name:'5 秒演练',exact:true}).click();
    const p2=await context.newPage();await p2.goto('https://dh.stjohns.hk/cart/');await p2.locator('#meal-timer-extension').waitFor();await p2.getByRole('button',{name:'5 秒演练',exact:true}).click();await p2.getByText(/已有一个页面正在等待/).waitFor();await p.getByRole('button',{name:'取消',exact:true}).click();ok('cross-tab exclusion remains active');
    await worker.evaluate(()=>{MealClock.parseTime=()=>{throw new Error('bad clock');};});await p.getByRole('button',{name:'校准时间',exact:true}).click();await p.getByText(/校时失败或网络太慢/).waitFor();assert.equal(await p.locator('#arm').isDisabled(),true);ok('bad calibration blocks arming');
    assert.deepEqual(errors,[]);ok('no unhandled browser errors');
    fs.mkdirSync('artifacts/results',{recursive:true});fs.writeFileSync('artifacts/results/test-result.json',JSON.stringify({passed:true,tests:passed,isolatedSite:true,realCheckoutRequests:0,pageErrors:errors},null,2));
  }finally{await context.close();proxy.closeAllConnections();fixtureServer.closeAllConnections();await new Promise(r=>proxy.close(r));await new Promise(r=>fixtureServer.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
