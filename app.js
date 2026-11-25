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
const BASE_LISTS = [
  {id:'groceries', n:'Groceries', e:'🥦', pat:'apricot', sub:'Food and cleaning products'},
  {id:'home', n:'Home', e:'🏠', pat:'blush', sub:'Homewares, storage, furniture and decor'},
  {id:'bunnings', n:'Bunnings & DIY', e:'🔨', pat:'sage', sub:'Hardware, garden and fix-it jobs'},
  {id:'clothes', n:'Clothes', e:'👕', pat:'peri', sub:'For each of you, with sizes'},
  {id:'kids', n:'Kids', e:'🧸', pat:'pink', sub:'Toys, school bits and nappies'},
  {id:'gifts', n:'Gifts', e:'🎁', pat:'wine', sub:'Secret: only you can see this', secret:true}
];
// Your own lists: shared ones in shop_meta/lists, secret ones in your private ~shop_meta/lists
let LISTS = BASE_LISTS.slice(), CUSTOM_SHARED = [], CUSTOM_MINE = [];
const LIST_COLOURS = [['pink','Pink'],['blush','Blush'],['terra','Terracotta'],['apricot','Apricot'],['butter','Butter'],['sage','Sage'],['peri','Periwinkle'],['wine','Wine']];
function rebuildLists(){ LISTS.length = 0; LISTS.push(...BASE_LISTS, ...CUSTOM_SHARED.map(l => ({...l, custom:true})), ...CUSTOM_MINE.map(l => ({...l, custom:true, secret:true}))); }
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
// A typical Woolworths walk: fresh produce at the door, bakery and deli, the middle aisles, then fridges and frozen.
const DEFAULT_ORDER = ['Fruit & veg','Bakery','Meat & seafood','Pantry','Snacks','Drinks','Health & beauty','Baby & kids','Pets','Cleaning & household','Dairy & eggs','Frozen','Other'];
let AISLE_ORDER = DEFAULT_ORDER.slice(), AISLE_MAP = {}, AISLE_ICONS = {};
const normText = t => String(t||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const aisleFor = i => AISLE_MAP[normText(i.text)] || i.aisle || 'Other';
function saveAisles(){ F.put('shop_meta', {id:'aisles', order:AISLE_ORDER, map:AISLE_MAP, icons:AISLE_ICONS}).catch(()=>toast('Couldn’t save the aisles. Check you’re online.')); }
const aisleOf = t => { if(AISLE_MAP[normText(t)]) return AISLE_MAP[normText(t)]; const s = String(t).toLowerCase(); const a = AISLES.find(x => x[2].test(s)); return a ? a[0] : 'Other'; };
const aisleIcon = n => AISLE_ICONS[n] || (AISLES.find(a => a[0]===n) || ['', '🛒'])[1];

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
  if(LISTS.find(l=>l.id===list && l.secret)) it.secret = true;   // gifts and your own secret lists
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
  const ae = document.activeElement, keepId = ae && ae.id && ae.tagName==='INPUT' && !ae.closest('#sheet') ? ae.id : null, sel = keepId ? [ae.selectionStart, ae.selectionEnd, ae.value] : null;
  renderInner();
  if(keepId){ const el = document.getElementById(keepId); if(el){ el.value = sel[2]; el.focus({preventScroll:true}); try{ el.setSelectionRange(sel[0], sel[1]); }catch(e){} } }
}
function renderInner(){
  ['home','list','shop','sizes'].forEach(v => $('#v-'+v).hidden = v!==view);
  if(view==='home') renderHome(); else if(view==='list') renderList(); else if(view==='shop') renderShop(); else renderSizes();
}
function go(v, extra){ view = v; if(v==='list') openList = extra; if(v==='shop') openShop = extra; render(); window.scrollTo(0,0); history.replaceState(null, '', '#'+v+(extra?'-'+extra:'')); }

function renderHome(){
  const first = (user.displayName||'').split(' ')[0];
  const now = all().filter(i=>!i.done && i.need==='now' && i.list!=='gifts').length;
  const shopCounts = SHOPS.map(s => [s, forShop(s).filter(i=>!i.done).length]).filter(x=>x[1]);
  $('#v-home').innerHTML = `<div class="home"><div>
    <p class="hello">Hey ${esc(first||'there')} ✿</p>
    <p class="sum">${now ? `${now} thing${now===1?'':'s'} to get soon` : 'All stocked up ✨'}</p>
    <form class="quick" id="qaForm" autocomplete="off"><label class="sr" for="qa">Quick add to groceries</label><input id="qa" placeholder="Add to groceries… e.g. 2 milk"><button class="btn" type="submit">Add</button></form>
    ${staplesHTML()}
    <h2 class="sec">Lists</h2>
    <div class="tiles">${LISTS.map(l => { const items = itemsIn(l.id), left = items.filter(i=>!i.done).length;
      return `<button type="button" class="tile c-${l.pat}" data-list="${l.id}"><span class="te">${l.e}</span><span><b>${esc(l.n)}</b><br><span class="tc">${left ? left+(l.custom && !l.shop ? ' to do' : ' to get') : 'nothing yet'}</span></span>${l.secret?'<span class="lock" aria-label="Secret">🔒</span>':''}</button>`; }).join('')}
      <button type="button" class="tile tile-new" id="newList"><span class="te">＋</span><span><b>New list</b><br><span class="tc">make your own</span></span></button></div>
  </div><aside class="side">
    <div class="panel"><h2 class="sec" style="margin-top:0">Out and about? Shop by store</h2>
    <div class="shops">${SHOPS.map(s => { const n = (shopCounts.find(x=>x[0]===s)||[0,0])[1]; return `<button type="button" class="shopchip ${n?'has':''}" data-shop="${esc(s)}">${esc(s)}${n?` <span>${n}</span>`:''}</button>`; }).join('')}</div>
    <p class="note" style="margin:14px 0 0">Shared with Nathan, live. 🔒 Secret items and your Gifts list are only on your account.</p></div>
  </aside></div>`;
  $('#newList').onclick = () => listSheet(null);
  $('#qaForm').onsubmit = e => { e.preventDefault(); const v = $('#qa').value; if(!v.trim()) return; addItem(v); $('#qa').value=''; $('#qa').focus(); toast('Added ✓'); };
}
function staplesHTML(){
  const st = Object.entries(local.get('staples', {})).sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
  const onList = new Set(itemsIn('groceries').filter(i=>!i.done).map(i=>i.text.toLowerCase()));
  const pick = st.filter(t=>!onList.has(t)).slice(0, 8);
  return pick.length ? `<div class="staples" aria-label="Your staples"><span class="note">Staples:</span>${pick.map(t=>`<button type="button" class="pill" data-staple="${esc(t)}">＋ ${esc(t)}</button>`).join('')}</div>` : '';
}
function itemRow(i, opts={}){
  const today = new Date().toISOString().slice(0,10), dueTxt = i.due ? `<span style="color:${i.due < today && !i.done ? '#C0392B' : 'inherit'}">${i.due < today && !i.done ? 'overdue · ' : 'due '}${new Date(i.due+'T00:00').toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'})}</span>` : '';
  const meta = [i.qty ? `×${esc(i.qty)}` : '', opts.showList ? esc((LISTS.find(l=>l.id===i.list)||{n:''}).n) : '', i.person ? esc((PEOPLE.find(p=>p.id===i.person)||{n:i.person}).n) : '', i.forWho ? 'for '+esc(i.forWho) : '', i.size ? 'size '+esc(i.size) : '', i.price ? '$'+esc(i.price) : '', i.need==='sometime' ? 'sometime' : '', (i.shops||[]).length && !opts.hideShops ? esc(i.shops.join(', ')) : ''].filter(Boolean).join(' · ');
  return `<div class="row-i ${i.done?'done':''}"><button type="button" class="tick" data-tick="${i.id}" aria-pressed="${!!i.done}" aria-label="${i.done?'Untick':'Tick'} ${esc(i.text)}">${i.done?'✓':''}</button>
    <button type="button" class="it" data-edit="${i.id}"><b>${esc(i.text)}${i._secret?' <span aria-label="Secret">🔒</span>':''}</b>${meta?`<span>${meta}</span>`:''}${i.note?`<span class="nt" style="white-space:pre-line">${esc(i.note)}</span>`:''}${dueTxt?`<span>${dueTxt}</span>`:''}</button>
    ${i.link ? `<a class="lk" href="${esc(i.link)}" target="_blank" rel="noopener" aria-label="Open link for ${esc(i.text)}">🔗</a>` : ''}</div>`;
}
function groupHTML(title, items, opts){ return items.length ? `<div class="grp-wrap"><h3 class="grp">${title}</h3><div class="card">${items.map(i=>itemRow(i, opts)).join('')}</div></div>` : ''; }
function trolley(items){ const d = items.filter(i=>i.done); return d.length ? `<h3 class="grp">In the trolley 🛒 <button type="button" class="link" id="clearT">Clear ${d.length}</button></h3><div class="card dim">${d.map(i=>itemRow(i)).join('')}</div>` : ''; }

function renderList(){
  const l = LISTS.find(x=>x.id===openList) || LISTS[0], items = itemsIn(l.id), open = items.filter(i=>!i.done);
  let body = '';
  if(l.id==='groceries'){ const used = [...new Set(open.map(aisleFor))], ais = [...AISLE_ORDER, ...used.filter(a => !AISLE_ORDER.includes(a))];
    body = ais.map(a => groupHTML(`${aisleIcon(a)} ${esc(a)}`, open.filter(i=>aisleFor(i)===a))).join(''); }
  else if(l.id==='clothes' || l.id==='kids'){ const ppl = l.id==='kids' ? PEOPLE.filter(p=>['thomas','belle'].includes(p.id)) : PEOPLE;
    body = ppl.map(p => groupHTML(`${p.e} ${p.n}${l.id==='clothes' && sizes[p.id] ? ` <button type="button" class="link" data-sizes="${p.id}">sizes</button>` : ''}`, open.filter(i=>i.person===p.id))).join('') + groupHTML('Everyone', open.filter(i=>!ppl.some(p=>p.id===i.person))); }
  else if(l.id==='gifts'){ const who = [...new Set(open.map(i=>i.forWho||'Someone'))].sort(); body = who.map(w => groupHTML(`🎁 For ${esc(w)}`, open.filter(i=>(i.forWho||'Someone')===w))).join(''); }
  else body = groupHTML('Need now', open.filter(i=>i.need!=='sometime')) + groupHTML('Sometime', open.filter(i=>i.need==='sometime'));
  $('#v-list').innerHTML = `<div class="bar"><button type="button" class="back" data-go="home">← Lists</button></div>
    <header class="lhead c-${l.pat}"><span class="te">${l.e}</span><div><h1>${esc(l.n)}</h1><p>${esc(l.sub)}</p></div></header>
    ${l.secret ? `<p class="secret">🔒 Only you can see this list.${l.id==='gifts' ? ' Nathan has his own.' : ''}</p>` : ''}
    ${l.custom ? `<button type="button" class="link" id="editList" style="margin:8px 0 0">✏️ Edit list</button>` : ''}
    <form class="quick" id="laForm" autocomplete="off"><label class="sr" for="la">Add to ${esc(l.n)}</label><input id="la" placeholder="${l.id==='gifts'?'Gift idea…':'Add an item…'}">${l.id==='clothes'||l.id==='kids' ? `<select id="lp" aria-label="Who for">${(l.id==='kids'?PEOPLE.filter(p=>['thomas','belle'].includes(p.id)):PEOPLE).map(p=>`<option value="${p.id}">${p.e} ${p.n}</option>`).join('')}</select>` : ''}${l.id==='gifts' ? '<input id="lw" placeholder="For…" style="max-width:110px">' : ''}<button class="btn" type="submit">Add</button></form>
    ${l.id==='clothes' ? '<button type="button" class="link" data-go="sizes" style="margin:6px 0 0">👟 Everyone’s sizes</button>' : ''}
    ${l.id==='groceries' ? '<div style="display:flex;gap:16px;flex-wrap:wrap;margin:6px 0 0"><button type="button" class="link" id="arrangeAisles">↕︎ Arrange and add aisles</button><a class="link" href="/mealplanner/#shop" style="text-decoration:none">🍽️ Meal planner list ›</a></div>' : ''}
    ${body ? `<div class="groups">${body}</div>` : '<p class="empty">Nothing here yet. Add the first thing above ✨</p>'}${trolley(items)}`;
  $('#laForm').onsubmit = e => { e.preventDefault(); const v = $('#la').value; if(!v.trim()) return;
    const extra = {list:l.id}; const lp = $('#lp'); if(lp) extra.person = lp.value; const lw = $('#lw'); if(lw && lw.value.trim()) extra.forWho = lw.value.trim();
    if(extra.person && sizes[extra.person] && l.id==='clothes'){ /* size filled in from the item sheet */ }
    addItem(v, extra); $('#la').value=''; $('#la').focus(); };
  const ct = $('#clearT'); if(ct) ct.onclick = () => clearTicked(items);
  const ar = $('#arrangeAisles'); if(ar) ar.onclick = aislesSheet;
  const el = $('#editList'); if(el) el.onclick = () => listSheet(l.id);
}
/* ---------- Your own lists ---------- */
function listSheet(id){
  const l = id ? LISTS.find(x => x.id===id) : {n:'', e:'📝', pat:'blush', secret:false};
  openSheet(id ? 'Edit list' : 'New list', `<label class="l" for="ln">Name</label><input class="f" id="ln" value="${esc(l.n)}" placeholder="e.g. Honey Do List, Christmas, Camping">
    <div class="g2"><div><label class="l" for="le">Emoji</label><input class="f" id="le" value="${esc(l.e)}" maxlength="4"></div>
    <div><label class="l" for="ls">Short description</label><input class="f" id="ls" value="${esc(l.sub||'')}" placeholder="optional"></div></div>
    <p class="l">Colour</p><div class="chips">${LIST_COLOURS.map(([k,n]) => `<button type="button" class="pill c-${k}" data-lc="${k}" aria-pressed="${l.pat===k}" aria-label="${n}" style="min-width:44px">${l.pat===k?'✓':'&nbsp;'}</button>`).join('')}</div>
    ${id ? `<p class="note" style="margin-top:12px">${l.secret ? '🔒 Secret: only you can see this list.' : '👫 Shared with Nathan.'}</p>` : `<div class="chips" style="margin-top:12px"><button type="button" class="pill" data-ls="shared" aria-pressed="true">👫 Shared with Nathan</button><button type="button" class="pill" data-ls="secret" aria-pressed="false">🔒 Only me</button></div>`}
    <div class="g2" style="margin-top:16px"><button class="btn" id="lsave" type="button">${id ? 'Save' : 'Create list'}</button>${id ? '<button class="btn line" id="ldel" type="button">Delete list</button>' : ''}</div>`, b => {
    let pat = l.pat, secret = !!l.secret;
    b.querySelectorAll('[data-lc]').forEach(x => x.onclick = () => { pat = x.dataset.lc; b.querySelectorAll('[data-lc]').forEach(y => { y.setAttribute('aria-pressed', String(y===x)); y.innerHTML = y===x ? '✓' : '&nbsp;'; }); });
    b.querySelectorAll('[data-ls]').forEach(x => x.onclick = () => { secret = x.dataset.ls==='secret'; b.querySelectorAll('[data-ls]').forEach(y => y.setAttribute('aria-pressed', String(y===x))); });
    b.querySelector('#lsave').onclick = async () => {
      const n = b.querySelector('#ln').value.trim(); if(!n){ toast('Give the list a name first.'); return; }
      const def = {id: id || ('L' + Date.now().toString(36)), n, e: b.querySelector('#le').value.trim() || '📝', sub: b.querySelector('#ls').value.trim() || (secret ? 'Only you can see this' : 'Shared with Nathan'), pat};
      const arr = (id ? l.secret : secret) ? CUSTOM_MINE : CUSTOM_SHARED, i = arr.findIndex(x => x.id===def.id);
      if(i >= 0) arr[i] = def; else arr.push(def);
      rebuildLists(); render();
      try{ await F.put((id ? l.secret : secret) ? '~shop_meta' : 'shop_meta', {id:'lists', custom:arr}); }catch(e){ toast('Couldn’t save the list. Check you’re online.'); }
      closeSheet(); if(!id) go('list', def.id); toast(id ? 'Saved ✓' : `${n} created ✓`);
    };
    const del = b.querySelector('#ldel'); if(del) del.onclick = async () => {
      const items = itemsIn(id); if(!confirm(`Delete “${l.n}”${items.length ? ` and its ${items.length} item${items.length===1?'':'s'}` : ''}?`)) return;
      items.forEach(drop); const arr = l.secret ? CUSTOM_MINE : CUSTOM_SHARED, i = arr.findIndex(x => x.id===id); if(i >= 0) arr.splice(i, 1);
      rebuildLists(); try{ await F.put(l.secret ? '~shop_meta' : 'shop_meta', {id:'lists', custom:arr}); if(id==='honeydo') await F.put('shop_meta', {id:'preload-honeydo', at:Date.now(), deleted:true}); }catch(e){}
      closeSheet(); go('home'); toast('List deleted');
    };
  });
}
/* ---------- Arrange aisles: drag (or ↑ ↓) into your store's order, rename, add, remove ---------- */
function aislesSheet(){
  const counts = {}; itemsIn('groceries').filter(i=>!i.done).forEach(i => { const a = aisleFor(i); counts[a] = (counts[a]||0)+1; });
  openSheet('Aisles', `<p class="note" style="margin-top:0">Starts in a typical Woolworths order, but every store differs. Hold and drag ⠿ (or use ↑ ↓) to match your shop. Saved for both of you.</p>
    <div id="aisleList">${AISLE_ORDER.map((a,i) => `<div class="arow" data-ai="${i}"><span class="grip" aria-hidden="true">⠿</span><span class="an">${aisleIcon(a)} ${esc(a)}${counts[a] ? ` <span class="note">· ${counts[a]}</span>` : ''}</span>
      <span class="aact"><button type="button" class="pill" data-up="${i}" aria-label="Move ${esc(a)} up" ${i===0?'disabled':''}>↑</button><button type="button" class="pill" data-down="${i}" aria-label="Move ${esc(a)} down" ${i===AISLE_ORDER.length-1?'disabled':''}>↓</button><button type="button" class="pill" data-ren="${i}" aria-label="Rename ${esc(a)}">✏️</button>${a!=='Other' ? `<button type="button" class="pill" data-del="${i}" aria-label="Remove ${esc(a)}">✕</button>` : ''}</span></div>`).join('')}</div>
    <form id="addAisle" class="quick" style="margin-top:14px" autocomplete="off"><label class="sr" for="newAisle">New aisle</label><input id="newAisle" placeholder="New aisle, e.g. International foods"><button class="btn" type="submit">Add</button></form>
    <button type="button" class="link" id="resetAisles">Reset to the Woolworths order</button>`, b => {
    const move = (from, to) => { if(to<0 || to>=AISLE_ORDER.length || from===to) return; const [x] = AISLE_ORDER.splice(from,1); AISLE_ORDER.splice(to,0,x); saveAisles(); aislesSheet(); render(); };
    b.querySelectorAll('[data-up]').forEach(x => x.onclick = () => move(+x.dataset.up, +x.dataset.up-1));
    b.querySelectorAll('[data-down]').forEach(x => x.onclick = () => move(+x.dataset.down, +x.dataset.down+1));
    b.querySelectorAll('[data-ren]').forEach(x => x.onclick = () => { const i = +x.dataset.ren, old = AISLE_ORDER[i], nw = (prompt('Rename this aisle', old)||'').trim();
      if(!nw || nw===old || AISLE_ORDER.includes(nw)) return; AISLE_ORDER[i] = nw; if(AISLE_ICONS[old]) { AISLE_ICONS[nw] = AISLE_ICONS[old]; delete AISLE_ICONS[old]; } else AISLE_ICONS[nw] = aisleIcon(old);
      Object.keys(AISLE_MAP).forEach(k => { if(AISLE_MAP[k]===old) AISLE_MAP[k] = nw; });
      itemsIn('groceries').filter(it => it.aisle===old).forEach(it => save({...it, aisle:nw})); saveAisles(); aislesSheet(); render(); });
    b.querySelectorAll('[data-del]').forEach(x => x.onclick = () => { const i = +x.dataset.del, a = AISLE_ORDER[i]; if(!confirm(`Remove “${a}”? Its items move to Other.`)) return;
      AISLE_ORDER.splice(i,1); Object.keys(AISLE_MAP).forEach(k => { if(AISLE_MAP[k]===a) delete AISLE_MAP[k]; }); itemsIn('groceries').filter(it => it.aisle===a).forEach(it => save({...it, aisle:'Other'})); saveAisles(); aislesSheet(); render(); });
    b.querySelector('#addAisle').onsubmit = e => { e.preventDefault(); const n = b.querySelector('#newAisle').value.trim(); if(!n || AISLE_ORDER.includes(n)) return;
      AISLE_ORDER.splice(Math.max(0, AISLE_ORDER.indexOf('Other')), 0, n); AISLE_ICONS[n] = '🛒'; saveAisles(); aislesSheet(); render(); setTimeout(() => { const f = $('#newAisle'); if(f) f.focus(); }, 30); };
    b.querySelector('#resetAisles').onclick = () => { if(!confirm('Put the aisles back in the Woolworths order? (Your own aisles stay, just before Other.)')) return;
      const extra = AISLE_ORDER.filter(a => !DEFAULT_ORDER.includes(a)); AISLE_ORDER = [...DEFAULT_ORDER.slice(0,-1), ...extra, 'Other']; saveAisles(); aislesSheet(); render(); };
    // hold and drag the ⠿ rows (touch or mouse)
    const rows = [...b.querySelectorAll('.arow')];
    rows.forEach(row => {
      let timer = null, dragging = false, sy = 0, ghostY = 0; const from = +row.dataset.ai;
      const targetIndex = y => { let idx = rows.length - 1; for(let k=0; k<rows.length; k++){ const r = rows[k].getBoundingClientRect(); if(y < r.top + r.height/2){ idx = k; break; } } return idx > from ? idx - (y > rows[rows.length-1].getBoundingClientRect().bottom ? 0 : 1) : idx; };
      const lift = () => { dragging = true; row.classList.add('lifted'); if(navigator.vibrate) navigator.vibrate(25); };
      const follow = y => { row.style.transform = `translateY(${y - sy}px)`; const t = targetIndex(y); rows.forEach((r,k) => r.classList.toggle('drop-here', k===t && k!==from)); ghostY = y; };
      const drop = () => { row.classList.remove('lifted'); row.style.transform = ''; rows.forEach(r => r.classList.remove('drop-here')); dragging = false; move(from, targetIndex(ghostY)); };
      const grip = row.querySelector('.grip');
      [row, grip].forEach(el => el.addEventListener('touchstart', e => { if(e.target.closest('button')) return; sy = ghostY = e.touches[0].clientY; timer = setTimeout(lift, el===grip ? 60 : 280); }, {passive:true}));
      row.addEventListener('touchmove', e => { if(dragging){ e.preventDefault(); follow(e.touches[0].clientY); } else if(Math.abs(e.touches[0].clientY - sy) > 8) clearTimeout(timer); }, {passive:false});
      row.addEventListener('touchend', () => { clearTimeout(timer); if(dragging) drop(); });
      row.addEventListener('mousedown', e => { if(e.target.closest('button')) return; sy = ghostY = e.clientY; timer = setTimeout(lift, 200);
        const mm = ev => { if(dragging){ ev.preventDefault(); follow(ev.clientY); } }; const mu = () => { clearTimeout(timer); document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); if(dragging) drop(); };
        document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu); });
    });
  });
}
function forShop(s){
  return all().filter(i => i.list!=='gifts' || i._secret).filter(i => (i.shops||[]).includes(s) || (SUPERMARKETS.includes(s) && i.list==='groceries' && !(i.shops||[]).length));
}
function renderShop(){
  const s = openShop, items = forShop(s), open = items.filter(i=>!i.done);
  const byList = LISTS.map(l => groupHTML(`${l.e} ${l.n}`, open.filter(i=>i.list===l.id), {hideShops:true})).join('');
  $('#v-shop').innerHTML = `<div class="bar"><button type="button" class="back" data-go="home">← Lists</button></div>
    <header class="lhead c-pink"><span class="te">🏪</span><div><h1>${esc(s)}</h1><p>Everything to grab here, from every list</p></div></header>
    ${SUPERMARKETS.includes(s) ? '<p class="note">Includes all groceries that aren’t tagged for a particular shop.</p>' : ''}
    ${byList ? `<div class="groups">${byList}</div>` : '<p class="empty">Nothing tagged for this shop yet.</p>'}${trolley(items)}`;
  const ct = $('#clearT'); if(ct) ct.onclick = () => clearTicked(items);
}
function renderSizes(){
  $('#v-sizes').innerHTML = `<div class="bar"><button type="button" class="back" data-list="clothes">← Clothes</button></div>
    <header class="lhead c-peri"><span class="te">👟</span><div><h1>Sizes</h1><p>Never guess in the shop again</p></div></header>
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
    ${it.list==='groceries' ? `<label class="l" for="e-a">Aisle</label><select class="f" id="e-a">${[...new Set([...AISLE_ORDER, aisleFor(it)])].map(a=>`<option ${a===aisleFor(it)?'selected':''}>${esc(a)}</option>`).join('')}<option value="__new">＋ New aisle…</option></select><p class="note" style="margin:4px 0 0">Changing the aisle is remembered for next time.</p>` : ''}
    ${['clothes','kids'].includes(it.list) ? `<div class="g2"><div><label class="l" for="e-p">Who for</label><select class="f" id="e-p"><option value="">Everyone</option>${PEOPLE.map(p=>`<option value="${p.id}" ${p.id===it.person?'selected':''}>${p.e} ${p.n}</option>`).join('')}</select></div><div><label class="l" for="e-s">Size</label><input class="f" id="e-s" value="${esc(it.size || '')}" placeholder="${it.person && sizes[it.person] ? 'e.g. '+esc(Object.entries(sizes[it.person]).filter(([k])=>k!=='at').map(([k,v])=>v).filter(Boolean)[0]||'') : ''}"></div></div>` : ''}
    ${it.list==='gifts' ? `<div class="g2"><div><label class="l" for="e-w">For</label><input class="f" id="e-w" value="${esc(it.forWho||'')}"></div><div><label class="l" for="e-pr">Price ($)</label><input class="f" id="e-pr" inputmode="decimal" value="${esc(it.price||'')}"></div></div>` : ''}
    ${it.list!=='groceries' ? `<label class="l" for="e-due">Due date (optional)</label><input class="f" id="e-due" type="date" value="${esc(it.due||'')}">` : ''}
    <label class="l" for="e-k">Link</label><input class="f" id="e-k" type="url" value="${esc(it.link||'')}" placeholder="Paste a link to the exact one">
    <label class="l" for="e-n">Notes</label><textarea class="f" id="e-n" rows="2" placeholder="Colour, brand, where you saw it…">${esc(it.note||'')}</textarea>
    <p class="l">Where to buy it</p><div class="chips">${SHOPS.map(s=>`<button type="button" class="pill" data-eshop="${esc(s)}" aria-pressed="${(it.shops||[]).includes(s)}">${esc(s)}</button>`).join('')}</div>
    <p class="l">When</p><div class="chips"><button type="button" class="pill" data-need="now" aria-pressed="${it.need!=='sometime'}">Need now</button><button type="button" class="pill" data-need="sometime" aria-pressed="${it.need==='sometime'}">Sometime</button></div>
    ${l && l.secret ? '<p class="secret" style="margin-top:12px">🔒 Gifts are always secret.</p>' : `<div class="chips" style="margin-top:12px"><button type="button" class="pill" id="e-sec" aria-pressed="${!!it._secret}">🔒 Secret (only me)</button></div>`}
    <div class="g2" style="margin-top:16px"><button class="btn" id="e-save" type="button">Save</button><button class="btn line" id="e-del" type="button">Delete</button></div>`, b => {
    b.querySelectorAll('[data-eshop]').forEach(x => x.onclick = () => x.setAttribute('aria-pressed', String(x.getAttribute('aria-pressed')!=='true')));
    const aSel = b.querySelector('#e-a'); if(aSel) aSel.onchange = () => { if(aSel.value !== '__new') return; const n = (prompt('Name the new aisle')||'').trim(); if(!n){ aSel.value = aisleFor(it); return; }
      if(!AISLE_ORDER.includes(n)){ AISLE_ORDER.splice(Math.max(0, AISLE_ORDER.indexOf('Other')), 0, n); AISLE_ICONS[n] = '🛒'; saveAisles(); }
      const o = document.createElement('option'); o.textContent = n; aSel.insertBefore(o, aSel.querySelector('[value="__new"]')); aSel.value = n; };
    b.querySelectorAll('[data-need]').forEach(x => x.onclick = () => b.querySelectorAll('[data-need]').forEach(y => y.setAttribute('aria-pressed', String(y===x))));
    const sec = b.querySelector('#e-sec'); if(sec) sec.onclick = () => sec.setAttribute('aria-pressed', String(sec.getAttribute('aria-pressed')!=='true'));
    b.querySelector('#e-save').onclick = () => {
      const v = id => { const el = b.querySelector(id); return el ? el.value.trim() : undefined; };
      const list = v('#e-l'), secretNow = LISTS.find(x=>x.id===list && x.secret) ? true : sec ? sec.getAttribute('aria-pressed')==='true' : !!it._secret;
      const newAisle = list==='groceries' ? (v('#e-a') && v('#e-a')!=='__new' ? v('#e-a') : aisleOf(v('#e-t')||it.text)) : undefined;
      if(list==='groceries' && newAisle && newAisle !== aisleFor(it)){ AISLE_MAP[normText(v('#e-t')||it.text)] = newAisle; saveAisles(); }   // remember the move
      const upd = {...it, text:v('#e-t')||it.text, qty:v('#e-q'), list, aisle: newAisle,
        person:v('#e-p'), size:v('#e-s'), forWho:v('#e-w'), price:v('#e-pr'), link:v('#e-k'), note:v('#e-n'),
        due: v('#e-due') || undefined,
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
/* Items Thea listed in the Household chat (Nov 2026), added once on first open. */
const PRELOAD = [
  ['T-shirts','clothes',{person:'thea'}],['Body suits','clothes',{person:'thea'}],['Gym towel','clothes',{person:'thea'}],['Training shoes','clothes',{person:'thea'}],['Under skirt','clothes',{person:'thea'}],
  ['Bathers','clothes',{person:'thomas'}],['Bathers','clothes',{person:'belle'}],['Rain jacket','clothes',{shops:['Kmart']}],
  ['Hue light bulb','bunnings',{shops:['Bunnings']}],
  ['Tea towels (for presents)','home',{shops:['Kmart']}],['Party supplies box','home',{shops:['Kmart']}],['Craft box','home',{shops:['Kmart']}],
  ['Studymate book cover roll, 1 m × 450 mm, white','kids',{shops:['Kmart'], link:'https://www.kmart.com.au/product/studymate-book-cover-roll-1mx450mm-white-110039867/'}],
  ['Hooks for Thomas’s wall and Belle','home',{shops:['Kmart']}],['Silicone muffin trays','home',{shops:['Kmart']}],['Bread zip-lock bags','home',{shops:['Kmart']}],
  ['Gas mask','home',{}],['Dishwasher cap replacements','home',{}],['Blue light glasses','home',{}],
  ['Spot cleaner refill','groceries',{aisle:'Cleaning & household'}],['Cleaning cloths','groceries',{aisle:'Cleaning & household'}]
];
/* The Honey Do List (shared): jobs Thea would like Nathan to do around the house. Added once. */
const HONEYDO = [
  ['Download the audio of The New Adventures of Winnie the Pooh for the Yoto', {note:'The actual audio version'}],
  ['Toilet roll holder', {}],
  ['Thea’s drawers', {}],
  ['Anchor furniture to the wall', {note:'– Kids’ kitchen?\n– Cabinet with the amp in it?\n– Thea’s new chest of drawers\n– Tall drawers in Thea’s wardrobe', due:'2026-09-18'}],
  ['Fix the foam insulation at the front door', {}]
];
// Checks every time the app opens: if the Honey Do List (or its first jobs) are missing, they're added.
// If Thea deletes the list on purpose, that's remembered and it isn't added back.
async function addHoneyDoOnce(){
  try{
    const mark = await F.getOne('shop_meta', 'preload-honeydo');
    if(mark && mark.deleted) return;
    const cur = await F.getOne('shop_meta', 'lists'), custom = (cur && cur.custom) || [];
    const listMissing = !custom.some(l => l.id==='honeydo');
    if(listMissing){ custom.push({id:'honeydo', n:'Honey Do List', e:'🍯', sub:'Jobs for Nathan around the house', pat:'butter'}); await F.put('shop_meta', {id:'lists', custom}); }
    if(listMissing || !mark){
      const have = new Set(shared.map(i => i.id));
      for(const [i, [text, extra]] of HONEYDO.entries()) if(!have.has('honey-'+i)) await F.put('shop_items', {id:'honey-'+i, text, qty:'', list:'honeydo', done:false, need:'now', at:Date.now(), by:'Thea', ...extra});
      await F.put('shop_meta', {id:'preload-honeydo', at:Date.now()});   // marked only once everything is saved
    }
  }catch(e){ console.warn('[Our List] Honey Do List', e); }
}
async function preloadOnce(){
  try{ const done = await F.getOne('shop_meta', 'preload-nov-2026'); if(done) return;
    const have = new Set(shared.map(i => i.id));
    for(const [i, [text, list, extra]] of PRELOAD.entries()) if(!have.has('pre-'+i)) await F.put('shop_items', {id:'pre-'+i, text, qty:'', list, done:false, need:'now', at:Date.now(), by:'Thea', ...extra});
    await F.put('shop_meta', {id:'preload-nov-2026', at:Date.now()});
  }catch(e){ /* try again next time */ }
}
function start(){
  $('#signin').onclick = () => F.signIn().catch(() => $('#gatemsg').textContent = 'Sign-in didn’t work. Please try again.');
  F.watchUser(u => {
    user = u;
    if(!u){ $('#gate').hidden = false; ['home','list','shop','sizes'].forEach(v => $('#v-'+v).hidden = true); return; }
    $('#gate').hidden = true; F.setOwner && F.setOwner(u.email);
    let firstLoad = true;
    F.listen('shop_items', rows => { shared = rows; render(); if(firstLoad){ firstLoad = false; addFromLink(); preloadOnce().then(addHoneyDoOnce); } }, () => toast('Couldn’t load the lists. Check you’re signed in.'));
    F.listen('~shop_items', rows => { mine = rows; render(); }, () => {});
    F.listen('~shop_meta', rows => { const l = rows.find(r => r.id==='lists'); CUSTOM_MINE = l ? (l.custom||[]) : []; rebuildLists(); render(); }, () => {});
    F.listen('shop_meta', rows => { const lists = rows.find(r => r.id==='lists'); CUSTOM_SHARED = lists ? (lists.custom||[]) : []; rebuildLists(); render(); const a = rows.find(r => r.id==='aisles'); if(a){ AISLE_ORDER = (a.order && a.order.length) ? a.order : DEFAULT_ORDER.slice(); AISLE_MAP = a.map || {}; AISLE_ICONS = a.icons || {}; render(); } }, () => {});
    F.listen('shop_sizes', rows => { sizes = Object.fromEntries(rows.map(r => [r.id, r])); if(view==='sizes') render(); }, () => {});
    const h = location.hash.slice(1); if(h.startsWith('list-')) go('list', h.slice(5)); else if(h.startsWith('shop-')) go('shop', decodeURIComponent(h.slice(5))); else go(h==='sizes'?'sizes':'home');
  });
}
start();
