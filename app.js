/* =====================================================================
   Our List: the Johnstons' shopping lists.
   Shared items: households/johnston/shop_items (both of you see them).
   Secret items and the Gifts list: private/{email}/shop_items (only you).
   ===================================================================== */
import * as F from '/family.js';

const $ = s => document.querySelector(s);
const esc = F.esc;
const local = { get(k,d){ try{ const v = localStorage.getItem('ol-'+k); return v===null ? d : JSON.parse(v); }catch(e){ return d; } }, set(k,v){ try{ localStorage.setItem('ol-'+k, JSON.stringify(v)); }catch(e){} } };

/* ---------- Lists, people, shops, aisles ---------- */
const LISTS = [
  {id:'groceries', n:'Groceries', e:'🥦', pat:'daisy', sub:'Food and cleaning products'},
  {id:'home', n:'Home', e:'🏠', pat:'check', sub:'Homewares, storage, furniture and decor'},
  {id:'bunnings', n:'Bunnings & DIY', e:'🔨', pat:'wave', sub:'Hardware, garden and fix-it jobs'},
  {id:'clothes', n:'Clothes', e:'👕', pat:'stripe', sub:'For each of you, with sizes'},
  {id:'kids', n:'Kids', e:'🧸', pat:'stars', sub:'Toys, school bits and nappies'},
  {id:'gifts', n:'Gifts', e:'🎁', pat:'stars2', sub:'Secret: only you can see this', secret:true}
];
const PEOPLE = [{id:'thea', n:'Thea', e:'🌸'}, {id:'nathan', n:'Nathan', e:'🧢'}, {id:'thomas', n:'Thomas', e:'🦖'}, {id:'belle', n:'Belle', e:'🎀'}];
const SHOPS = ['Woolworths','Coles','ALDI','Bunnings','Kmart','Target','Big W','IKEA','Chemist','Online'];
const SUPERMARKETS = ['Woolworths','Coles','ALDI'];
const SIZE_KEYS = ['Tops','Bottoms','Dresses','Shoes','Undies & socks','PJs','Jacket'];
const AISLES = [
  ['Fruit & veg','🥕',/\b(apple|banana|berr|grape|orange|lemon|lime|mango|pear|peach|plum|melon|kiwi|avocado|tomato|potato|onion|garlic|ginger|carrot|celery|lettuce|spinach|kale|rocket|cucumber|capsicum|zucchini|broccoli|cauli|cabbage|corn|pumpkin|mushroom|herb|parsley|coriander|basil|mint|salad|fruit|veg)/],
  ['Meat & seafood','🥩',/\b(chicken|beef|mince|pork|lamb|sausage|bacon|ham|steak|fish|salmon|tuna|prawn|turkey|chorizo|meat)/],
  ['Dairy & eggs','🥛',/\b(milk|cheese|butter|yoghurt|yogurt|cream|egg|feta|parmesan|mozzarella)/],
  ['Bakery','🍞',/\b(bread|loaf|roll|wrap|tortilla|bun|croissant|muffin|crumpet|sourdough|bagel)/],
  ['Pantry','🥫',/\b(rice|pasta|noodle|flour|sugar|oil|vinegar|sauce|stock|spice|salt|pepper|honey|jam|peanut|oats|cereal|tin|can|beans|lentil|chickpea|coffee|tea|baking|vanilla|cocoa|soy|mayo|mustard|vegemite)/],
  ['Frozen','🧊',/\b(frozen|ice cream|peas|ice)/],
  ['Drinks','🧃',/\b(juice|water|soda|cordial|kombucha|drink)/],
  ['Snacks','🍪',/\b(chips|biscuit|chocolate|crackers|lolly|lollies|snack|bar|popcorn|nuts)/],
  ['Baby & kids','🍼',/\b(nappy|nappies|wipes|formula|pouch|baby)/],
  ['Health & beauty','🧴',/\b(shampoo|conditioner|soap|toothpaste|toothbrush|deodorant|razor|sunscreen|panadol|nurofen|vitamin|tampon|pad|moisturiser|floss|bandaid)/],
  ['Cleaning & household','🧽',/\b(detergent|laundry|bleach|spray|wipes? clean|sponge|dishwash|dish|cleaner|softener|toilet paper|loo paper|paper towel|bin bag|garbage|scrub|mop|foil|cling|baking paper|zip ?lock|sandwich bags?|freezer bags?)/],
  ['Pets','🐶',/\b(dog|pet|kibble|treats?)/]
];
const STORAGE = /\b(storage|tubs?|containers?|baskets?|boxes|organis|drawer|shelf|shelves|hooks?|hangers?)\b/i;
const aisleOf = t => { const s = String(t).toLowerCase(); const a = AISLES.find(x => x[2].test(s)); return a ? a[0] : 'Other'; };
const aisleIcon = n => (AISLES.find(a => a[0]===n) || ['', '🛒'])[1];

/* ---------- State ---------- */
let user = null, shared = [], mine = [], sizes = {}, view = 'home', openList = null, openShop = null, editing = null;
const all = () => [...shared, ...mine.map(i => ({...i, _secret:true}))];
const itemsIn = id => all().filter(i => i.list===id);

/* ---------- Toast and sheet ---------- */
let tT = null;
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(tT); tT = setTimeout(()=>t.hidden = true, 2600); }
let lastFocus = null;
function openSheet(title, html, ready){
  lastFocus = document.activeElement;
  $('#sheetTitle').textContent = title; $('#sheetBody').innerHTML = html; $('#sheet').hidden = false; document.body.style.overflow = 'hidden';
  ready && ready($('#sheetBody')); setTimeout(()=>$('#sheetClose').focus(), 30);
}
function closeSheet(){ $('#sheet').hidden = true; document.body.style.overflow = ''; if(lastFocus && lastFocus.focus) lastFocus.focus(); }
$('#sheet').addEventListener('click', e => { if(e.target.id==='sheet' || e.target.closest('#sheetClose')) closeSheet(); });
document.addEventListener('keydown', e => { if(e.key==='Escape' && !$('#sheet').hidden) closeSheet(); });

/* ---------- Saving ---------- */
const colFor = it => it._secret || it.secret ? '~shop_items' : 'shop_items';
function clean(o){ const c = {...o}; delete c._secret; Object.keys(c).forEach(k => c[k]===undefined && delete c[k]); return c; }
function save(it){ F.put(colFor(it), clean(it)).catch(() => toast('Saved on this phone. It will sync when you’re back online.')); }
function drop(it){ F.remove(colFor(it), it.id).catch(()=>{}); }
function parseQuick(text){
  const m = text.trim().match(/^(\d+(?:\.\d+)?)\s*(?:x\s*)?(.+)$/i);
  return m ? {qty:m[1], text:m[2].trim()} : {qty:'', text:text.trim()};
}
function addItem(text, extraIn={}){ let extra = {...extraIn};
  const {qty, text:t} = parseQuick(text); if(!t) return;
  let list = extra.list || 'groceries';
  if(list==='groceries' && STORAGE.test(t)){ list = 'home'; extra = {...extra, list}; setTimeout(()=>toast('That sounds like storage, so it’s gone to Home 🏠'), 50); }
  const it = {id:F.uid('s'), text:t, qty, list, done:false, need:'now', at:Date.now(), by:(user && user.displayName || '').split(' ')[0], ...extra};
  if(list==='groceries' && !it.aisle) it.aisle = aisleOf(t);
  if(LISTS.find(l=>l.id===list && l.secret)) it.secret = true;
  if(it.secret){ it._secret = true; mine.push(it); } else shared.push(it);
  save(it); render();
  // remember for staples
  if(list==='groceries'){ const st = local.get('staples', {}); st[t.toLowerCase()] = (st[t.toLowerCase()]||0)+1; local.set('staples', st); }
}
function toggle(id){ const it = all().find(i=>i.id===id); if(!it) return; it.done = !it.done; it.doneAt = it.done ? Date.now() : null;
  const arr = it._secret ? mine : shared; const i = arr.findIndex(x=>x.id===id); if(i>=0) arr[i] = {...arr[i], done:it.done, doneAt:it.doneAt};
  save(it); render(); }
function clearTicked(items){ items.filter(i=>i.done).forEach(drop); toast('Cleared ✓'); }

/* =====================================================================
   VIEWS
   ===================================================================== */
function render(){
  if(!user) return;
  ['home','list','shop','sizes'].forEach(v => $('#v-'+v).hidden = v!==view);
  if(view==='home') renderHome(); else if(view==='list') renderList(); else if(view==='shop') renderShop(); else renderSizes();
  window.scrollTo(0, view==='home' ? window.scrollY : 0);
}
function go(v, extra){ view = v; if(v==='list') openList = extra; if(v==='shop') openShop = extra; render(); window.scrollTo(0,0); history.replaceState(null, '', '#'+v+(extra?'-'+extra:'')); }

function renderHome(){
  const first = (user.displayName||'').split(' ')[0];
  const now = all().filter(i=>!i.done && i.need==='now' && i.list!=='gifts').length;
  const shopCounts = SHOPS.map(s => [s, forShop(s).filter(i=>!i.done).length]).filter(x=>x[1]);
  $('#v-home').innerHTML = `
    <header class="cover"><div><p class="hi">Hey ${esc(first||'there')} 👋</p><h1 class="logo"><span>our</span> list</h1><p class="sub">${now ? `${now} thing${now===1?'':'s'} needed soon` : 'All stocked up ✨'}</p></div></header>
    <label class="sr" for="qa">Quick add to groceries</label>
    <form class="quick" id="qaForm" autocomplete="off"><input id="qa" placeholder="Add to groceries… e.g. 2 milk"><button class="btn" type="submit">Add</button></form>
    ${staplesHTML()}
    <h2 class="sec">Lists</h2>
    <div class="tiles">${LISTS.map(l => { const items = itemsIn(l.id), left = items.filter(i=>!i.done).length;
      return `<button type="button" class="tile p-${l.pat}" data-list="${l.id}"><span class="te">${l.e}</span><b>${esc(l.n)}</b><span class="tc">${left ? left+' to get' : 'nothing yet'}</span>${l.secret?'<span class="lock" aria-label="Secret">🔒</span>':''}</button>`; }).join('')}</div>
    <h2 class="sec">Out and about? Shop by store</h2>
    <div class="shops">${SHOPS.map(s => { const n = (shopCounts.find(x=>x[0]===s)||[0,0])[1]; return `<button type="button" class="shopchip ${n?'has':''}" data-shop="${esc(s)}">${esc(s)}${n?` <span>${n}</span>`:''}</button>`; }).join('')}</div>
    <p class="note" style="margin-top:18px">Shared with Nathan, live. 🔒 Secret items and your Gifts list are only on your account.</p>`;
  $('#qaForm').onsubmit = e => { e.preventDefault(); const v = $('#qa').value; if(!v.trim()) return; addItem(v); $('#qa').value=''; $('#qa').focus(); toast('Added to groceries ✓'); };
}
function staplesHTML(){
  const st = Object.entries(local.get('staples', {})).sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
  const onList = new Set(itemsIn('groceries').filter(i=>!i.done).map(i=>i.text.toLowerCase()));
  const pick = st.filter(t=>!onList.has(t)).slice(0, 8);
  return pick.length ? `<div class="staples" aria-label="Your staples"><span class="note">Staples:</span>${pick.map(t=>`<button type="button" class="pill" data-staple="${esc(t)}">＋ ${esc(t)}</button>`).join('')}</div>` : '';
}
function itemRow(i, opts={}){
  const meta = [i.qty ? `×${esc(i.qty)}` : '', opts.showList ? esc((LISTS.find(l=>l.id===i.list)||{n:''}).n) : '', i.person ? esc((PEOPLE.find(p=>p.id===i.person)||{n:i.person}).n) : '', i.forWho ? 'for '+esc(i.forWho) : '', i.size ? 'size '+esc(i.size) : '', i.price ? '$'+esc(i.price) : '', i.need==='sometime' ? 'sometime' : '', (i.shops||[]).length && !opts.hideShops ? esc(i.shops.join(', ')) : ''].filter(Boolean).join(' · ');
  return `<div class="row-i ${i.done?'done':''}"><button type="button" class="tick" data-tick="${i.id}" aria-pressed="${!!i.done}" aria-label="${i.done?'Untick':'Tick'} ${esc(i.text)}">${i.done?'✓':''}</button>
    <button type="button" class="it" data-edit="${i.id}"><b>${esc(i.text)}${i._secret?' <span aria-label="Secret">🔒</span>':''}</b>${meta?`<span>${meta}</span>`:''}${i.note?`<span class="nt">${esc(i.note)}</span>`:''}</button>
    ${i.link ? `<a class="lk" href="${esc(i.link)}" target="_blank" rel="noopener" aria-label="Open link for ${esc(i.text)}">🔗</a>` : ''}</div>`;
}
function groupHTML(title, items, opts){ return items.length ? `<h3 class="grp">${title}</h3><div class="card">${items.map(i=>itemRow(i, opts)).join('')}</div>` : ''; }
function trolley(items){ const d = items.filter(i=>i.done); return d.length ? `<h3 class="grp">In the trolley 🛒 <button type="button" class="link" id="clearT">Clear ${d.length}</button></h3><div class="card dim">${d.map(i=>itemRow(i)).join('')}</div>` : ''; }

function renderList(){
  const l = LISTS.find(x=>x.id===openList) || LISTS[0], items = itemsIn(l.id), open = items.filter(i=>!i.done);
  let body = '';
  if(l.id==='groceries'){ const ais = [...new Set([...AISLES.map(a=>a[0]),'Other'])]; body = ais.map(a => groupHTML(`${aisleIcon(a)} ${a}`, open.filter(i=>(i.aisle||'Other')===a))).join(''); }
  else if(l.id==='clothes' || l.id==='kids'){ const ppl = l.id==='kids' ? PEOPLE.filter(p=>['thomas','belle'].includes(p.id)) : PEOPLE;
    body = ppl.map(p => groupHTML(`${p.e} ${p.n}${l.id==='clothes' && sizes[p.id] ? ` <button type="button" class="link" data-sizes="${p.id}">sizes</button>` : ''}`, open.filter(i=>i.person===p.id))).join('') + groupHTML('Everyone', open.filter(i=>!ppl.some(p=>p.id===i.person))); }
  else if(l.id==='gifts'){ const who = [...new Set(open.map(i=>i.forWho||'Someone'))].sort(); body = who.map(w => groupHTML(`🎁 For ${esc(w)}`, open.filter(i=>(i.forWho||'Someone')===w))).join(''); }
  else body = groupHTML('Need now', open.filter(i=>i.need!=='sometime')) + groupHTML('Sometime', open.filter(i=>i.need==='sometime'));
  $('#v-list').innerHTML = `<div class="bar"><button type="button" class="back" data-go="home">← Lists</button></div>
    <header class="lhead p-${l.pat}"><span class="te">${l.e}</span><div><h1>${esc(l.n)}</h1><p>${esc(l.sub)}</p></div></header>
    ${l.secret ? '<p class="secret">🔒 Only you can see this list. Nathan has his own.</p>' : ''}
    <form class="quick" id="laForm" autocomplete="off"><label class="sr" for="la">Add to ${esc(l.n)}</label><input id="la" placeholder="${l.id==='gifts'?'Gift idea…':'Add an item…'}">${l.id==='clothes'||l.id==='kids' ? `<select id="lp" aria-label="Who for">${(l.id==='kids'?PEOPLE.filter(p=>['thomas','belle'].includes(p.id)):PEOPLE).map(p=>`<option value="${p.id}">${p.e} ${p.n}</option>`).join('')}</select>` : ''}${l.id==='gifts' ? '<input id="lw" placeholder="For…" style="max-width:110px">' : ''}<button class="btn" type="submit">Add</button></form>
    ${l.id==='clothes' ? '<button type="button" class="link" data-go="sizes" style="margin:6px 0 0">👟 Everyone’s sizes</button>' : ''}
    ${body || '<p class="empty">Nothing here yet. Add the first thing above ✨</p>'}${trolley(items)}`;
  $('#laForm').onsubmit = e => { e.preventDefault(); const v = $('#la').value; if(!v.trim()) return;
    const extra = {list:l.id}; const lp = $('#lp'); if(lp) extra.person = lp.value; const lw = $('#lw'); if(lw && lw.value.trim()) extra.forWho = lw.value.trim();
    if(extra.person && sizes[extra.person] && l.id==='clothes'){ /* size filled in from the item sheet */ }
    addItem(v, extra); $('#la').value=''; $('#la').focus(); };
  const ct = $('#clearT'); if(ct) ct.onclick = () => clearTicked(items);
}
function forShop(s){
  return all().filter(i => i.list!=='gifts' || i._secret).filter(i => (i.shops||[]).includes(s) || (SUPERMARKETS.includes(s) && i.list==='groceries' && !(i.shops||[]).length));
}
function renderShop(){
  const s = openShop, items = forShop(s), open = items.filter(i=>!i.done);
  const byList = LISTS.map(l => groupHTML(`${l.e} ${l.n}`, open.filter(i=>i.list===l.id), {hideShops:true})).join('');
  $('#v-shop').innerHTML = `<div class="bar"><button type="button" class="back" data-go="home">← Lists</button></div>
    <header class="lhead p-stars"><span class="te">🏪</span><div><h1>${esc(s)}</h1><p>Everything to grab here, from every list</p></div></header>
    ${SUPERMARKETS.includes(s) ? '<p class="note">Includes all groceries that aren’t tagged for a particular shop.</p>' : ''}
    ${byList || '<p class="empty">Nothing tagged for this shop yet.</p>'}${trolley(items)}`;
  const ct = $('#clearT'); if(ct) ct.onclick = () => clearTicked(items);
}
function renderSizes(){
  $('#v-sizes').innerHTML = `<div class="bar"><button type="button" class="back" data-list="clothes">← Clothes</button></div>
    <header class="lhead p-stripe"><span class="te">👟</span><div><h1>Sizes</h1><p>Never guess in the shop again</p></div></header>
    ${PEOPLE.map(p => `<div class="card" style="margin-top:12px"><b>${p.e} ${p.n}</b><div class="sizes">${SIZE_KEYS.map(k => `<label><span>${k}</span><input data-size="${p.id}|${k}" value="${esc((sizes[p.id]||{})[k]||'')}" placeholder="–"></label>`).join('')}</div>${sizes[p.id] && sizes[p.id].at ? `<p class="note">Updated ${new Date(sizes[p.id].at).toLocaleDateString('en-AU')}</p>` : ''}</div>`).join('')}
    <p class="note" style="margin-top:10px">Kids grow fast, so check these each season.</p>`;
  document.querySelectorAll('[data-size]').forEach(inp => inp.onchange = () => { const [pid, k] = inp.dataset.size.split('|'); const cur = {...(sizes[pid]||{}), [k]: inp.value.trim(), at:Date.now()};
    sizes[pid] = cur; F.put('shop_sizes', {id:pid, ...cur}).catch(()=>{}); toast('Size saved ✓'); });
}

/* ---------- Item sheet ---------- */
function editSheet(id){
  const it = all().find(i=>i.id===id); if(!it) return;
  const l = LISTS.find(x=>x.id===it.list);
  openSheet('Edit item', `<label class="l" for="e-t">Item</label><input class="f" id="e-t" value="${esc(it.text)}">
    <div class="g2"><div><label class="l" for="e-q">How many</label><input class="f" id="e-q" value="${esc(it.qty||'')}" placeholder="e.g. 2"></div>
      <div><label class="l" for="e-l">List</label><select class="f" id="e-l">${LISTS.map(x=>`<option value="${x.id}" ${x.id===it.list?'selected':''}>${x.e} ${esc(x.n)}</option>`).join('')}</select></div></div>
    ${it.list==='groceries' ? `<label class="l" for="e-a">Aisle</label><select class="f" id="e-a">${[...AISLES.map(a=>a[0]),'Other'].map(a=>`<option ${a===(it.aisle||'Other')?'selected':''}>${a}</option>`).join('')}</select>` : ''}
    ${['clothes','kids'].includes(it.list) ? `<div class="g2"><div><label class="l" for="e-p">Who for</label><select class="f" id="e-p"><option value="">Everyone</option>${PEOPLE.map(p=>`<option value="${p.id}" ${p.id===it.person?'selected':''}>${p.e} ${p.n}</option>`).join('')}</select></div><div><label class="l" for="e-s">Size</label><input class="f" id="e-s" value="${esc(it.size || '')}" placeholder="${it.person && sizes[it.person] ? 'e.g. '+esc(Object.entries(sizes[it.person]).filter(([k])=>k!=='at').map(([k,v])=>v).filter(Boolean)[0]||'') : ''}"></div></div>` : ''}
    ${it.list==='gifts' ? `<div class="g2"><div><label class="l" for="e-w">For</label><input class="f" id="e-w" value="${esc(it.forWho||'')}"></div><div><label class="l" for="e-pr">Price ($)</label><input class="f" id="e-pr" inputmode="decimal" value="${esc(it.price||'')}"></div></div>` : ''}
    <label class="l" for="e-k">Link</label><input class="f" id="e-k" type="url" value="${esc(it.link||'')}" placeholder="Paste a link to the exact one">
    <label class="l" for="e-n">Notes</label><textarea class="f" id="e-n" rows="2" placeholder="Colour, brand, where you saw it…">${esc(it.note||'')}</textarea>
    <p class="l">Where to buy it</p><div class="chips">${SHOPS.map(s=>`<button type="button" class="pill" data-eshop="${esc(s)}" aria-pressed="${(it.shops||[]).includes(s)}">${esc(s)}</button>`).join('')}</div>
    <p class="l">When</p><div class="chips"><button type="button" class="pill" data-need="now" aria-pressed="${it.need!=='sometime'}">Need now</button><button type="button" class="pill" data-need="sometime" aria-pressed="${it.need==='sometime'}">Sometime</button></div>
    ${l && l.secret ? '<p class="secret" style="margin-top:12px">🔒 Gifts are always secret.</p>' : `<div class="chips" style="margin-top:12px"><button type="button" class="pill" id="e-sec" aria-pressed="${!!it._secret}">🔒 Secret (only me)</button></div>`}
    <div class="g2" style="margin-top:16px"><button class="btn" id="e-save" type="button">Save</button><button class="btn line" id="e-del" type="button">Delete</button></div>`, b => {
    b.querySelectorAll('[data-eshop]').forEach(x => x.onclick = () => x.setAttribute('aria-pressed', String(x.getAttribute('aria-pressed')!=='true')));
    b.querySelectorAll('[data-need]').forEach(x => x.onclick = () => b.querySelectorAll('[data-need]').forEach(y => y.setAttribute('aria-pressed', String(y===x))));
    const sec = b.querySelector('#e-sec'); if(sec) sec.onclick = () => sec.setAttribute('aria-pressed', String(sec.getAttribute('aria-pressed')!=='true'));
    b.querySelector('#e-save').onclick = () => {
      const v = id => { const el = b.querySelector(id); return el ? el.value.trim() : undefined; };
      const list = v('#e-l'), secretNow = LISTS.find(x=>x.id===list && x.secret) ? true : sec ? sec.getAttribute('aria-pressed')==='true' : !!it._secret;
      const upd = {...it, text:v('#e-t')||it.text, qty:v('#e-q'), list, aisle: list==='groceries' ? (v('#e-a') || aisleOf(v('#e-t')||it.text)) : undefined,
        person:v('#e-p'), size:v('#e-s'), forWho:v('#e-w'), price:v('#e-pr'), link:v('#e-k'), note:v('#e-n'),
        shops:[...b.querySelectorAll('[data-eshop][aria-pressed="true"]')].map(x=>x.dataset.eshop), need:(b.querySelector('[data-need][aria-pressed="true"]')||{dataset:{need:'now'}}).dataset.need};
      if(secretNow !== !!it._secret){ drop(it); upd._secret = secretNow; upd.secret = secretNow; }
      else { upd._secret = secretNow; upd.secret = secretNow || undefined; }
      save(upd); closeSheet(); toast('Saved ✓');
    };
    b.querySelector('#e-del').onclick = () => { drop(it); closeSheet(); toast('Deleted'); };
  });
}

/* ---------- Clicks and start-up ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest("button,a"); if(!t) return;
  const d = t.dataset;
  if(d.list){ if(!$('#sheet').hidden) closeSheet(); return go('list', d.list); }
  if(d.go){ return go(d.go); }
  if(d.shop){ return go('shop', d.shop); }
  if(d.tick){ return toggle(d.tick); }
  if(d.edit){ return editSheet(d.edit); }
  if(d.staple){ addItem(d.staple); toast('Added ✓'); return; }
  if(d.sizes){ return go('sizes'); }
});

// Siri / Shortcuts: opening the app with ?add=milk adds "milk" to groceries
function addFromLink(){
  const q = new URLSearchParams(location.search), add = q.get('add');
  if(add){ add.split(/,|\band\b/).map(s=>s.trim()).filter(Boolean).forEach(x => addItem(x, {list:q.get('list')||'groceries'})); toast('Added from Siri ✓'); history.replaceState(null,'',location.pathname); }
}
function start(){
  $('#signin').onclick = () => F.signIn().catch(() => $('#gatemsg').textContent = 'Sign-in didn’t work. Please try again.');
  F.watchUser(u => {
    user = u;
    if(!u){ $('#gate').hidden = false; ['home','list','shop','sizes'].forEach(v => $('#v-'+v).hidden = true); return; }
    $('#gate').hidden = true; F.setOwner && F.setOwner(u.email);
    let firstLoad = true;
    F.listen('shop_items', rows => { shared = rows; render(); if(firstLoad){ firstLoad = false; addFromLink(); } }, () => toast('Couldn’t load the lists. Check you’re signed in.'));
    F.listen('~shop_items', rows => { mine = rows; render(); }, () => {});
    F.listen('shop_sizes', rows => { sizes = Object.fromEntries(rows.map(r => [r.id, r])); if(view==='sizes') render(); }, () => {});
    const h = location.hash.slice(1); if(h.startsWith('list-')) go('list', h.slice(5)); else if(h.startsWith('shop-')) go('shop', decodeURIComponent(h.slice(5))); else go(h==='sizes'?'sizes':'home');
  });
}
start();
