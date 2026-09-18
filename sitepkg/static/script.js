const BASE_PLACES = [
  {id:'rica', name:'Озеро Рица', category:'nature', tag:'горы + вода', location:'Гагрский район', text:'Холодная бирюзовая вода, горы вокруг и тот самый день, который хочется запомнить.', img:'https://upload.wikimedia.org/wikipedia/commons/d/de/Lake_Ritsa.jpg'},
  {id:'gagra', name:'Гагра', category:'sea', tag:'море', location:'Гагра', text:'Море, пальмы, красивые улочки и прогулка без спешки — просто быть рядом.', img:'https://upload.wikimedia.org/wikipedia/commons/e/e0/Gagra_colonnade.jpg'},
  {id:'newathos', name:'Новый Афон', category:'history', tag:'атмосфера', location:'Новый Афон', text:'Монастырь, старые стены, зелень и ощущение, будто мы случайно попали в кино.', img:'https://upload.wikimedia.org/wikipedia/commons/5/5e/New_Athos_Monastery.JPG'},
  {id:'canyon', name:'Юпшарский каньон', category:'nature', tag:'вау-вид', location:'дорога на Рицу', text:'Скалы вокруг и дорога, которую хочется остановить и фотографировать каждые пять минут.', img:'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/2014_Reliktowy_Park_Narodowy_Rica%2C_W%C4%85w%C3%B3z_%22Kammienna_torba%22_na_rzece_Jupszara_%2806%29.jpg/1280px-2014_Reliktowy_Park_Narodowy_Rica%2C_W%C4%85w%C3%B3z_%22Kammienna_torba%22_na_rzece_Jupszara_%2806%29.jpg'},
  {id:'sukhum', name:'Сухум', category:'sea', tag:'город + море', location:'Сухум', text:'Набережная, пальмы, кофе, вечерний город и длинная прогулка вдвоём.', img:'https://upload.wikimedia.org/wikipedia/commons/f/f5/On_quay._Sukhum.jpg'},
  {id:'waterfall', name:'Гегский водопад', category:'nature', tag:'природа', location:'Гудаутский район', text:'Горная вода, прохлада и ощущение маленького приключения вдали от города.', img:'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Abkhazia._Gegsky_waterfall_P9100123_2600.jpg/1280px-Abkhazia._Gegsky_waterfall_P9100123_2600.jpg'},
  {id:'blue', name:'Голубое озеро', category:'nature', tag:'пейзаж', location:'Бзыбское ущелье', text:'Небольшая остановка с невероятным цветом воды и красивым видом вокруг.', img:'https://upload.wikimedia.org/wikipedia/commons/4/40/Goluboe_ozero_Abkhazia.jpg'},
  {id:'pitsunda', name:'Пицунда', category:'sea', tag:'тихий день', location:'Пицунда', text:'Сосны у моря, спокойный ритм и идеальный вариант для дня, когда никуда не надо торопиться.', img:'https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/Pitsunda_beach.jpg/1280px-Pitsunda_beach.jpg'},
  {id:'anacopia', name:'Анакопийская крепость', category:'history', tag:'история + вид', location:'Новый Афон', text:'Подняться выше, посмотреть на море сверху и представить, сколько всего здесь происходило.', img:'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Anacopia_Fortress.jpg/1280px-Anacopia_Fortress.jpg'}
];

let PLACES = [...BASE_PLACES];
const state = {selected:[], wishes:[], custom_places:[]};
let currentFilter='all';
let adminPin = sessionStorage.getItem('admin_pin') || '';
let loading = false;
const $ = (s)=>document.querySelector(s);
const $$ = (s)=>[...document.querySelectorAll(s)];

async function api(url, options={}){
  const headers={'Content-Type':'application/json', ...(options.headers||{})};
  if(adminPin) headers['X-Admin-Pin']=adminPin;
  const response=await fetch(url,{...options,headers});
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error||'Ошибка соединения');
  return data;
}

function mergePlaces(custom){
  PLACES=[...BASE_PLACES,...(custom||[])];
}

async function refresh(silent=false){
  if(loading) return;
  loading=true;
  try{
    const data=await api('/api/state');
    state.selected=data.selected||[]; state.wishes=data.wishes||[]; state.custom_places=data.custom_places||[];
    mergePlaces(state.custom_places); renderAll();
    if(data.admin) renderOwner();
  }catch(e){ if(!silent) toast('Не удалось обновить данные'); }
  finally{loading=false;}
}

function renderPlaces(filter='all'){
  const grid=$('#placesGrid');
  const list=PLACES.filter(p=>filter==='all'||p.category===filter);
  grid.innerHTML=list.map(p=>{
    const selected=state.selected.includes(p.id);
    return `<article class="place ${selected?'is-selected':''}" data-id="${escapeHtml(p.id)}">
      <div class="place-bg" style="background-image:linear-gradient(180deg,rgba(9,20,26,.05),rgba(5,13,18,.1)),url('${escapeAttr(p.img)}')"></div>
      <div class="place-inner"><div class="tag">${escapeHtml(p.tag)}</div><div>
        <h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.text)}</p>
        <div class="place-bottom"><button class="want-btn ${selected?'selected':''}" type="button" data-want="${escapeHtml(p.id)}"><span class="heart">${selected?'♥':'♡'}</span>${selected?'Выбрано':'Хочу сюда'}</button><span class="mini-location">${escapeHtml(p.location)}</span></div>
      </div></div></article>`;
  }).join('');
  $$('[data-want]').forEach(btn=>btn.addEventListener('click',async e=>togglePlace(e.currentTarget.dataset.want,e.currentTarget)));
}

async function togglePlace(id, button){
  const was=state.selected.includes(id);
  try{ await api('/api/select',{method:'POST',body:JSON.stringify({id})});
    if(!was){heartBurst(button);confettiBurst(button);toast('Добавила в наше путешествие ♥');}
    else toast('Убрала из нашего маршрута ♡');
    await refresh(true);
  }catch(e){toast(e.message);}
}

function renderSelected(){
  const list=$('#selectedList');
  if(!state.selected.length){list.innerHTML='<div class="selected-empty"><span>♡</span><b>Маршрут ещё пуст</b><small>Выбери первое место выше.</small></div>';return;}
  list.innerHTML=state.selected.map(id=>{const p=PLACES.find(x=>x.id===id);if(!p)return'';return `<div class="selected-item"><div class="thumb" style="background-image:url('${escapeAttr(p.img)}')"></div><div><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.location)}</small></div><button class="remove" data-remove="${escapeHtml(p.id)}" type="button" aria-label="Убрать">×</button></div>`}).join('');
  $$('[data-remove]').forEach(btn=>btn.addEventListener('click',async()=>{try{await api('/api/select',{method:'POST',body:JSON.stringify({id:btn.dataset.remove})});await refresh(true);toast('Убрала это место ♡')}catch(e){toast(e.message)}}));
}

function renderWishes(){
  const messages=$('#messages'); const empty=$('#emptyChat');
  messages.querySelectorAll('.bubble').forEach(x=>x.remove());
  if(!state.wishes.length){empty.style.display='grid';$('#chatCount').textContent='0';return;}
  empty.style.display='none';
  state.wishes.forEach(w=>{
    const div=document.createElement('div');div.className=`bubble ${w.author==='Ты'?'mine':''}`;
    const date=new Date(w.created_at).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit'});
    const status=w.status==='added'?' • добавлено в маршрут':w.status==='done'?' • услышано':'';
    div.innerHTML=`<span class="name">${escapeHtml(w.author)} • ${date}${status}</span><p>${escapeHtml(w.text)}</p>`;
    messages.appendChild(div);
  });
  $('#chatCount').textContent=String(state.wishes.length);messages.scrollTop=messages.scrollHeight;
}

function renderAll(){
  renderPlaces(currentFilter);renderSelected();renderWishes();
  const n=state.selected.length,w=state.wishes.length;
  $('#selectedCount').textContent=n;$('#routeTotal').textContent=`${n} ${plural(n,'место','места','мест')}`;
  $('#selectedHero').textContent=n;$('#wishHero').textContent=w;$('#finalPlaces').textContent=`${n} ${plural(n,'место','места','мест')}`;$('#finalWishes').textContent=`${w} ${plural(w,'пожелание','пожелания','пожеланий')}`;
  $('#ownerPlaces').textContent=n;$('#ownerWishes').textContent=w;
}
function renderOwner(){
  const box=$('#ownerWishList'); if(!box)return;
  if(!state.wishes.length){box.innerHTML='<div class="owner-empty">Пока нет новых пожеланий ✦</div>';return;}
  box.innerHTML=state.wishes.map(w=>`<div class="owner-wish"><div><b>${escapeHtml(w.author)}</b><p>${escapeHtml(w.text)}</p></div><div class="owner-wish-actions">${w.status==='new'?`<button data-done="${w.id}" type="button">Услышано ♥</button><button data-addwish="${w.id}" type="button">В маршрут +</button>`:`<span class="done-status">${w.status==='added'?'добавлено ♥':'услышано ✓'}</span>`}</div></div>`).join('');
  $$('[data-done]').forEach(b=>b.onclick=async()=>{try{await api(`/api/wish/${b.dataset.done}/done`,{method:'POST'});await refresh(true);toast('Пожелание отмечено ♥')}catch(e){toast(e.message)}});
  $$('[data-addwish]').forEach(b=>b.onclick=()=>openAddWish(Number(b.dataset.addwish)));
}

function openAddWish(id){
  const wish=state.wishes.find(w=>w.id===id);if(!wish)return;
  const name=prompt('Как назвать это место/идею в маршруте?',wish.text.slice(0,70));if(!name)return;
  api(`/api/wish/${id}/add-to-route`,{method:'POST',body:JSON.stringify({name,text:wish.text})}).then(()=>{refresh(true);heartBurst($('#ownerBtn'));confettiBurst($('#ownerBtn'));toast('Добавила желание в маршрут ♥')}).catch(e=>toast(e.message));
}

function plural(n,a,b,c){const m=n%10,d=n%100;return d>=11&&d<=14?c:m===1?a:(m>=2&&m<=4?b:c)}
function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]))}
function escapeAttr(s){return escapeHtml(s).replace(/`/g,'&#096;')}

function heartBurst(target){const r=target.getBoundingClientRect();for(let i=0;i<15;i++){const h=document.createElement('span');h.className='fly-heart';h.textContent=Math.random()>.15?'♥':'♡';h.style.setProperty('--x',(r.left+r.width/2)+'px');h.style.setProperty('--y',(r.top+r.height/2)+'px');h.style.setProperty('--dx',`${(Math.random()-.5)*220}px`);h.style.setProperty('--dy',`${60+Math.random()*190}px`);h.style.setProperty('--rot',`${(Math.random()-.5)*80}deg`);h.style.setProperty('--dur',`${.8+Math.random()*.7}s`);h.style.fontSize=`${15+Math.random()*18}px`;$('#heart-layer').appendChild(h);setTimeout(()=>h.remove(),1700)}}
function confettiBurst(target){const r=target.getBoundingClientRect();for(let i=0;i<22;i++){const c=document.createElement('span');c.className='confetti';c.style.setProperty('--x',(r.left+r.width/2)+'px');c.style.setProperty('--y',(r.top+r.height/2)+'px');c.style.setProperty('--dx',`${(Math.random()-.5)*280}px`);c.style.setProperty('--dy',`${90+Math.random()*210}px`);c.style.setProperty('--h',`${Math.random()*360}`);$('#heart-layer').appendChild(c);setTimeout(()=>c.remove(),1400)}}
function toast(text){const el=$('#toast');el.textContent=text;el.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.classList.remove('show'),2300)}

$$('.filter').forEach(btn=>btn.addEventListener('click',()=>{$$('.filter').forEach(x=>x.classList.remove('active'));btn.classList.add('active');currentFilter=btn.dataset.filter;renderPlaces(currentFilter)}));
$('#wishForm').addEventListener('submit',async e=>{e.preventDefault();const input=$('#wishInput');const text=input.value.trim();if(!text)return;try{await api('/api/wish',{method:'POST',body:JSON.stringify({text,author:'Она'})});input.value='';await refresh(true);heartBurst($('#wishForm button'));toast('Я запомнил твоё желание ♥')}catch(err){toast(err.message)}});
$('#surpriseBtn').addEventListener('click',()=>{const remaining=PLACES.filter(p=>!state.selected.includes(p.id));const pick=remaining[Math.floor(Math.random()*remaining.length)]||PLACES[Math.floor(Math.random()*PLACES.length)];document.querySelector(`[data-id="${CSS.escape(pick.id)}"]`)?.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>toast(`Маленькая подсказка: ${pick.name} ✦`),550)});
$('#saveBtn').addEventListener('click',()=>{const text=`Наш маршрут в Абхазии\n\nМеста:\n${state.selected.length?state.selected.map((id,i)=>`${i+1}. ${PLACES.find(p=>p.id===id)?.name}`).join('\n'):'— пока пусто'}\n\nПожелания:\n${state.wishes.length?state.wishes.map(w=>`• ${w.text}`).join('\n'):'— пока пусто'}`;navigator.clipboard?.writeText(text).then(()=>toast('Наши планы скопированы ♥')).catch(()=>toast('Планы сохранены онлайн ♥'));confettiBurst($('#saveBtn'));heartBurst($('#saveBtn'))});

const ownerModal=$('#ownerModal');
$('#ownerBtn').addEventListener('click',async()=>{
  if(!adminPin){const pin=prompt('Введите PIN организатора');if(!pin)return;const check=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin})}).then(r=>r.json()).catch(()=>({ok:false}));if(!check.ok){toast('PIN неверный');return;}adminPin=pin;sessionStorage.setItem('admin_pin',pin)}
  ownerModal.classList.add('show');ownerModal.setAttribute('aria-hidden','false');await refresh(true);renderOwner();
});
$('#closeOwner').addEventListener('click',closeModal);ownerModal.addEventListener('click',e=>{if(e.target.id==='ownerModal')closeModal()});function closeModal(){ownerModal.classList.remove('show');ownerModal.setAttribute('aria-hidden','true')}
$('#exportBtn').addEventListener('click',()=>{const text=`Выбрано: ${state.selected.length}\n${state.selected.map((id,i)=>`${i+1}. ${PLACES.find(p=>p.id===id)?.name}`).join('\n')}\n\nПожелания:\n${state.wishes.map(w=>`• ${w.text}`).join('\n')}`;navigator.clipboard?.writeText(text).then(()=>toast('Список скопирован ♥'))});
$('#clearBtn').addEventListener('click',async()=>{if(!confirm('Точно очистить выбранные места?'))return;try{await api('/api/state',{method:'DELETE'});await refresh(true);toast('Маршрут очищен ♡')}catch(e){toast(e.message)}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});

refresh();
setInterval(()=>refresh(true),5000);
