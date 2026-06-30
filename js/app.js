/**
 * nXuu Trading Journal — app.js v6.0
 * Features: Trade detail view, Filter history, Leaderboard, Dark mode, Password reset
 */

'use strict';

// ── STATE ─────────────────────────────────────────────────────
let allTrades      = [];
let userSteps      = [];
let userModels     = [];
let calYear        = new Date().getFullYear();
let calMonth       = new Date().getMonth() + 1;
let equityChart    = null;
let selectedResult = null;
let activeFilters  = { result:'', session:'', model:'', account:'', from:'', to:'' };
let activeAccount  = ''; // '' = all accounts

// ── DARK MODE ─────────────────────────────────────────────────
function initDarkMode() {
  const saved = localStorage.getItem('nxuu_theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = saved ? saved === 'dark' : prefersDark;
  applyTheme(isDark);
}

function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const toggleBtn = document.getElementById('dark-toggle-btn');
  const settingsToggle = document.getElementById('dark-mode-toggle');
  if (toggleBtn) toggleBtn.textContent = dark ? '☀' : '☾';
  if (settingsToggle) settingsToggle.checked = dark;
  localStorage.setItem('nxuu_theme', dark ? 'dark' : 'light');
}

function toggleDark() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  applyTheme(!isDark);
  // Sync both toggle inputs
  const settingsToggle = document.getElementById('dark-mode-toggle');
  if (settingsToggle) settingsToggle.checked = !isDark;
}

// ── AUDIO ─────────────────────────────────────────────────────
const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
let audioCtx = null, audioUnlocked = false;
function getAudioCtx() { if (!audioCtx) audioCtx = new AudioCtxClass(); return audioCtx; }
function withAudio(fn) { try { const c=getAudioCtx(); c.state==='suspended'?c.resume().then(fn).catch(()=>{}):fn(); } catch(e){} }
function unlockAudio() { if(audioUnlocked)return;audioUnlocked=true;try{const c=getAudioCtx(),b=c.createBuffer(1,1,22050),s=c.createBufferSource();s.buffer=b;s.connect(c.destination);s.start(0);if(c.state==='suspended')c.resume();}catch(e){} }
function playTick()    { withAudio(()=>{try{const c=getAudioCtx(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type='sine';o.frequency.value=600;g.gain.setValueAtTime(0.18,c.currentTime);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.12);o.start();o.stop(c.currentTime+0.12);}catch(e){}});}
function playUncheck() { withAudio(()=>{try{const c=getAudioCtx(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type='sine';o.frequency.value=350;g.gain.setValueAtTime(0.1,c.currentTime);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.1);o.start();o.stop(c.currentTime+0.1);}catch(e){}});}
function playFanfare() { withAudio(()=>{try{const c=getAudioCtx();[523,659,784,1047].forEach((f,i)=>{const o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type='sine';o.frequency.value=f;const s=c.currentTime+i*0.12;g.gain.setValueAtTime(0,s);g.gain.linearRampToValueAtTime(0.22,s+0.02);g.gain.exponentialRampToValueAtTime(0.001,s+0.3);o.start(s);o.stop(s+0.3);});}catch(e){}});}

// ── CONFETTI ──────────────────────────────────────────────────
const CC=['#6b7a52','#8a9a6a','#c8d4b0','#a08040','#c8a84b','#4a6a8a','#6a4a8a','#f2ede4','#1e1c18'];
function fireConfetti() {
  const c=document.getElementById('confetti-container'); c.innerHTML='';
  for(let i=0;i<90;i++){const p=document.createElement('div');p.className='confetti-piece';const sz=Math.random()*8+5,rect=Math.random()>.5;p.style.cssText=`left:${Math.random()*100}vw;width:${sz}px;height:${rect?sz*2.5:sz}px;background:${CC[Math.floor(Math.random()*CC.length)]};border-radius:${rect?'2px':'50%'};animation-delay:${Math.random()*.6}s;animation-duration:${Math.random()*1.5+1.8}s;--drift:${Math.random()*140-70}px;--rotate:${Math.random()*720-360}deg;`;c.appendChild(p);}
  setTimeout(()=>{c.innerHTML='';},5000);
}

// ── AUTH ──────────────────────────────────────────────────────
function showAuthTab(tab) {
  document.getElementById('auth-signin').style.display = tab==='signin'?'block':'none';
  document.getElementById('auth-signup').style.display = tab==='signup'?'block':'none';
  document.getElementById('tab-signin-btn').classList.toggle('active', tab==='signin');
  document.getElementById('tab-signup-btn').classList.toggle('active', tab==='signup');
}

function showResetPanel() {
  document.getElementById('auth-signin-signup').style.display = 'none';
  document.getElementById('auth-reset').style.display = 'block';
}

function hideResetPanel() {
  document.getElementById('auth-reset').style.display = 'none';
  document.getElementById('auth-signin-signup').style.display = 'block';
}

async function handlePasswordReset() {
  const email = document.getElementById('reset-email').value.trim();
  const msg   = document.getElementById('reset-msg');
  const btn   = document.getElementById('reset-btn');
  if (!email) return setAuthMsg(msg, 'Please enter your email.', 'error');
  btn.disabled = true; btn.textContent = 'Sending...';
  try {
    await requestPasswordReset(email);
    setAuthMsg(msg, 'Reset link sent! Check your inbox.', 'success');
  } catch(e) {
    setAuthMsg(msg, e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Send Reset Link';
  }
}

async function handleSignIn() {
  const email = document.getElementById('si-email').value.trim();
  const pass  = document.getElementById('si-pass').value;
  const msg   = document.getElementById('signin-msg');
  const btn   = document.getElementById('signin-btn');
  if (!email || !pass) return setAuthMsg(msg, 'Please fill in all fields.', 'error');
  if (!isConfigured()) return setAuthMsg(msg, 'Add your Supabase keys to js/supabase.js first.', 'error');
  btn.disabled=true; btn.textContent='Signing in...';
  try { await signIn(email, pass); await bootApp(); }
  catch(e) { setAuthMsg(msg, e.message, 'error'); }
  finally { btn.disabled=false; btn.textContent='Sign In'; }
}

async function handleSignUp() {
  const email = document.getElementById('su-email').value.trim();
  const pass  = document.getElementById('su-pass').value;
  const pass2 = document.getElementById('su-pass2').value;
  const msg   = document.getElementById('signup-msg');
  const btn   = document.getElementById('signup-btn');
  if (!email||!pass||!pass2) return setAuthMsg(msg,'Please fill in all fields.','error');
  if (pass!==pass2)          return setAuthMsg(msg,'Passwords do not match.','error');
  if (pass.length<6)         return setAuthMsg(msg,'Password must be at least 6 characters.','error');
  if (!isConfigured())       return setAuthMsg(msg,'Add your Supabase keys to js/supabase.js first.','error');
  btn.disabled=true; btn.textContent='Creating account...';
  try { await signUp(email,pass); setAuthMsg(msg,'Account created! Check your email to confirm, then sign in.','success'); setTimeout(()=>showAuthTab('signin'),2500); }
  catch(e) { setAuthMsg(msg,e.message,'error'); }
  finally { btn.disabled=false; btn.textContent='Create Account'; }
}

async function handleSignOut() {
  await signOut();
  activeAccount = '';
  document.getElementById('main-app').style.display   = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
  allTrades=[]; userSteps=[]; userModels=[];
}

function setAuthMsg(el, text, type) { el.textContent=text; el.className=`auth-msg ${type}`; }

// ── BOOT ──────────────────────────────────────────────────────
async function bootApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('main-app').style.display    = 'flex';
  const email = getUserEmail();
  const displayName = getUserDisplayName();
  document.getElementById('user-email').textContent     = displayName || email;
  document.getElementById('settings-email').textContent = email;
  initDarkMode();
  const optIn = localStorage.getItem('nxuu_lb_optin') === 'true';
  const toggle = document.getElementById('lb-opt-in');
  if (toggle) toggle.checked = optIn;
  await Promise.all([loadTrades(), loadSteps(), loadModels()]);
}

// ── TABS ──────────────────────────────────────────────────────
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b=>{
    b.classList.toggle('active',b.dataset.tab===tabName);
    b.setAttribute('aria-selected',b.dataset.tab===tabName);
  });
  document.querySelectorAll('.tab-pane').forEach(p=>{
    p.classList.toggle('active',p.id===`tab-${tabName}`);
  });
  if (tabName==='calendar')    renderCalendar();
  if (tabName==='equity')      renderEquity();
  if (tabName==='stats')       renderStats();
  if (tabName==='settings')    renderSettings();
  if (tabName==='leaderboard') renderLeaderboard();
}

// ── CHECKLIST ─────────────────────────────────────────────────
async function loadSteps() { try { userSteps=await fetchSteps(); } catch(e){ userSteps=[]; } renderChecklist(); }

function renderChecklist() {
  const wrap  = document.getElementById('checklist-steps-wrap');
  const total = userSteps.length;
  document.getElementById('prog-big').innerHTML=`0<span> / ${total}</span>`;
  if (total===0) { wrap.innerHTML=`<div class="empty-state">No checklist steps yet.<br>Add them in Settings.</div>`; return; }
  const sections={};
  userSteps.forEach(s=>{ if(!sections[s.section])sections[s.section]=[]; sections[s.section].push(s); });
  const colors=['olive','blue','amber','purple','rose','teal','slate','brown'];
  let sIdx=0, html='';
  Object.entries(sections).forEach(([name,steps])=>{
    const color=colors[sIdx%colors.length]; sIdx++;
    html+=`<section class="section" data-color="${color}"><div class="sec-label"><div class="sec-icon">${String(sIdx).padStart(2,'0')}</div><h2 class="sec-name">${name}</h2><div class="sec-rule"></div></div><ul class="steps-wrap">${steps.map(step=>`<li class="step" data-id="${step.id}" onclick="tog(this)" tabindex="0" onkeydown="handleKey(event,this)"><div class="step-left-bar"></div><span class="step-num">${String(userSteps.indexOf(step)+1).padStart(2,'0')}</span><div class="step-body"><span class="step-cat">${name}</span><p class="step-title">${step.title}</p></div><div class="step-cb"><svg class="cb-svg" width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.8 7L9 1" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div></li>`).join('')}</ul></section>`;
  });
  wrap.innerHTML=html; updateChecklistProgress();
}

function tog(el) { unlockAudio(); el.classList.toggle('checked'); const c=el.classList.contains('checked'); el.setAttribute('aria-checked',c); el.classList.remove('bounce'); void el.offsetWidth; el.classList.add('bounce'); c?playTick():playUncheck(); updateChecklistProgress(); }
function handleKey(e,el) { if(e.key==='Enter'||e.key===' '){e.preventDefault();tog(el);} }
function updateChecklistProgress() {
  const total=userSteps.length, done=document.querySelectorAll('.step.checked').length;
  document.getElementById('prog-big').innerHTML=`${done}<span> / ${total}</span>`;
  document.getElementById('fill').style.width=total>0?`${Math.round(done/total*100)}%`:'0%';
  const banner=document.getElementById('complete-banner');
  if(total>0&&done===total){banner.classList.add('visible');fireConfetti();playFanfare();}
  else banner.classList.remove('visible');
}
function resetChecklist() { document.querySelectorAll('.step').forEach(s=>{s.classList.remove('checked','bounce');s.setAttribute('aria-checked','false');}); updateChecklistProgress(); }

// ── MODELS ────────────────────────────────────────────────────
async function loadModels() { try { userModels=await fetchModels(); } catch(e){ userModels=[]; } populateModelDropdown(); }
function populateModelDropdown() {
  const opts = `<option value="">Select...</option>`+userModels.map(m=>`<option value="${m.name}">${m.name}</option>`).join('');
  const sel = document.getElementById('f-model');
  if (sel) sel.innerHTML = opts;
  // Also populate filter model dropdown
  const filSel = document.getElementById('fil-model');
  if (filSel) filSel.innerHTML = `<option value="">All Models</option>`+userModels.map(m=>`<option value="${m.name}">${m.name}</option>`).join('');
}

// ── TRADE LOG ─────────────────────────────────────────────────
function initForm() {
  document.getElementById('f-date').value = new Date().toISOString().split('T')[0];
  document.querySelectorAll('.result-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{ document.querySelectorAll('.result-btn').forEach(b=>b.classList.remove('selected')); btn.classList.add('selected'); selectedResult=btn.dataset.value; });
  });
}

async function submitTrade() {
  const date=document.getElementById('f-date').value, session=document.getElementById('f-session').value;
  const model=document.getElementById('f-model').value, rRaw=document.getElementById('f-r').value;
  const pnlRaw=document.getElementById('f-pnl').value, notes=document.getElementById('f-notes').value.trim();
  const account=document.getElementById('f-account').value.trim();
  const btn=document.getElementById('submitBtn'), btnText=document.getElementById('submit-text');
  if (!date)           return showFormMsg('Please select a date.','error');
  if (!selectedResult) return showFormMsg('Please select Win, Loss, or BE.','error');
  if (rRaw===''&&pnlRaw==='') return showFormMsg('Please enter at least an R value or PnL.','error');
  btn.disabled=true; btnText.textContent='Saving...';
  try {
    await insertTrade({ date, result:selectedResult, r_value:rRaw!==''?parseFloat(rRaw):0, pnl_usd:pnlRaw!==''?parseFloat(pnlRaw):0, notes:notes||null, model:model||null, session:session||null, account:account||null });
    showFormMsg('Trade saved!','success'); resetForm(); await loadTrades();
  } catch(e) { showFormMsg('Failed to save. Check your connection.','error'); console.error(e); }
  finally { btn.disabled=false; btnText.textContent='Save Trade'; }
}

function resetForm() {
  document.getElementById('f-date').value=new Date().toISOString().split('T')[0];
  ['f-session','f-model','f-r','f-pnl','f-notes','f-account'].forEach(id=>{ const el=document.getElementById(id); if(el)el.value=''; });
  document.querySelectorAll('.result-btn').forEach(b=>b.classList.remove('selected')); selectedResult=null;
}

function showFormMsg(text,type) { const el=document.getElementById('form-msg'); el.textContent=text; el.className=`form-msg ${type}`; setTimeout(()=>{el.textContent='';el.className='form-msg';},4000); }

async function loadTrades() {
  try {
    allTrades = await fetchAllTrades();
    rebuildAccountSwitcher();
    applyFilters();
  } catch(e) {
    document.getElementById('trade-list').innerHTML=`<div class="empty-state">Could not load trades.</div>`;
    console.error(e);
  }
}

// Returns trades filtered by the active global account switcher
function getAccountTrades() {
  if (!activeAccount) return allTrades;
  return allTrades.filter(t => (t.account || '') === activeAccount);
}

function rebuildAccountSwitcher() {
  const sel = document.getElementById('account-switcher');
  if (!sel) return;
  // Collect unique non-empty account names
  const accounts = [...new Set(allTrades.map(t => t.account).filter(Boolean))].sort();
  const prev = sel.value;
  sel.innerHTML = `<option value="">All Accounts</option>` +
    accounts.map(a => `<option value="${a}"${a===prev?' selected':''}>${a}</option>`).join('');
  // If previously selected account no longer exists, reset
  if (prev && !accounts.includes(prev)) {
    activeAccount = '';
    sel.value = '';
  }
  // Show/hide switcher — only show if there are multiple accounts
  const wrap = document.getElementById('account-switcher-wrap');
  if (wrap) wrap.style.display = accounts.length > 0 ? 'flex' : 'none';
}

function switchAccount() {
  const sel = document.getElementById('account-switcher');
  activeAccount = sel ? sel.value : '';
  // Re-render all data views with the new account
  applyFilters();
  // Re-render whichever tab is currently active
  const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
  if (activeTab === 'equity')   renderEquity();
  if (activeTab === 'stats')    renderStats();
  if (activeTab === 'calendar') renderCalendar();
}

// ── FILTERS ───────────────────────────────────────────────────
function applyFilters() {
  activeFilters.result  = document.getElementById('fil-result').value;
  activeFilters.session = document.getElementById('fil-session').value;
  activeFilters.model   = document.getElementById('fil-model').value;
  activeFilters.account = document.getElementById('fil-account').value;
  activeFilters.from    = document.getElementById('fil-from').value;
  activeFilters.to      = document.getElementById('fil-to').value;

  // Start from account-switcher-filtered trades, then apply per-column filters
  let filtered = getAccountTrades();
  if (activeFilters.result)  filtered = filtered.filter(t=>t.result===activeFilters.result);
  if (activeFilters.session) filtered = filtered.filter(t=>t.session===activeFilters.session);
  if (activeFilters.model)   filtered = filtered.filter(t=>t.model===activeFilters.model);
  if (activeFilters.account) filtered = filtered.filter(t=>(t.account||'').toLowerCase()===activeFilters.account.toLowerCase());
  if (activeFilters.from)    filtered = filtered.filter(t=>t.date>=activeFilters.from);
  if (activeFilters.to)      filtered = filtered.filter(t=>t.date<=activeFilters.to);

  const hasFilters = Object.values(activeFilters).some(v=>v!=='');
  const countEl = document.getElementById('filter-count');
  if (hasFilters && countEl) countEl.textContent = `${filtered.length} of ${getAccountTrades().length}`;
  else if (countEl) countEl.textContent = '';

  renderTradeList(filtered);
}

function clearFilters() {
  ['fil-result','fil-session','fil-model','fil-account','fil-from','fil-to'].forEach(id=>{ const el=document.getElementById(id); if(el)el.value=''; });
  activeFilters = { result:'', session:'', model:'', account:'', from:'', to:'' };
  document.getElementById('filter-count').textContent = '';
  renderTradeList(getAccountTrades());
}

// ── TRADE LIST ────────────────────────────────────────────────
function renderTradeList(trades) {
  const listEl = document.getElementById('trade-list');
  if (!trades || trades.length===0) {
    listEl.innerHTML = getAccountTrades().length===0
      ? `<div class="empty-state">No trades yet. Log your first trade above.</div>`
      : `<div class="empty-state">No trades match your filters.</div>`;
    return;
  }
  listEl.innerHTML = trades.slice(0,100).map(t=>{
    const rDisplay    = t.r_value  ? (t.r_value>0?`+${t.r_value}R`:`${t.r_value}R`) : '';
    const pnlDisplay  = t.pnl_usd  ? (t.pnl_usd>0?`+$${t.pnl_usd.toFixed(2)}`:`-$${Math.abs(t.pnl_usd).toFixed(2)}`) : '';
    const dateStr     = new Date(t.date+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
    const isApi       = t.source === 'api';
    const needsReview = isApi && !t.notes && !t.model;
    return `
      <div class="trade-row" onclick="openTradeDetail('${t.id}')">
        <div class="trade-row-left">
          <div class="trade-row-top">
            <span class="trade-result ${t.result}">${t.result.toUpperCase()}</span>
            <span class="trade-date">${dateStr}</span>
            ${isApi ? `<span class="trade-tag source-tag" title="Synced from MT4/5">🔒 ${t.symbol||'MT'}</span>` : ''}
            ${needsReview ? `<span class="trade-tag review-tag">Needs review</span>` : ''}
            ${t.account ?`<span class="trade-tag account-tag">${t.account}</span>`:''}
            ${t.model   ?`<span class="trade-tag">${t.model}</span>`  :''}
            ${t.session ?`<span class="trade-tag">${t.session}</span>`:''}
          </div>
          ${t.notes?`<p class="trade-notes">${t.notes}</p>`:''}
        </div>
        <div class="trade-row-right">
          <div class="trade-values">
            ${rDisplay  ?`<span class="trade-r ${t.result}">${rDisplay}</span>`  :''}
            ${pnlDisplay?`<span class="trade-pnl ${t.pnl_usd>=0?'win':'loss'}">${pnlDisplay}</span>`:''}
          </div>
          ${isApi ? '' : `<button class="delete-btn" onclick="event.stopPropagation();confirmDelete('${t.id}')" type="button">✕</button>`}
        </div>
      </div>`;
  }).join('');
  updateUnannotatedBadge();
}

async function confirmDelete(id) {
  if (!confirm('Delete this trade?')) return;
  try { await deleteTrade(id); closeTradeModal(); await loadTrades(); }
  catch(e) { alert('Could not delete trade.'); }
}

// ── TRADE DETAIL MODAL ────────────────────────────────────────
function openTradeDetail(id) {
  const t = allTrades.find(x=>x.id===id);
  if (!t) return;
  const isApi = t.source === 'api';
  const dateStr = new Date(t.date+'T00:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const rDisplay   = t.r_value  ? (t.r_value>0?`+${t.r_value}R`:`${t.r_value}R`) : '—';
  const pnlDisplay = t.pnl_usd  ? (t.pnl_usd>0?`+$${t.pnl_usd.toFixed(2)}`:`-$${Math.abs(t.pnl_usd).toFixed(2)}`) : '—';
  const pnlClass   = t.pnl_usd >= 0 ? 'win-col' : 'loss-col';

  let lockedHtml = '';
  if (isApi) {
    const entry = t.entry_price!=null ? Number(t.entry_price).toFixed(5) : '—';
    const exit  = t.exit_price!=null  ? Number(t.exit_price).toFixed(5)  : '—';
    lockedHtml = `
      <div class="detail-locked-box">
        <div class="detail-notes-label">🔒 Synced from MT4/5 — read-only</div>
        <div class="detail-grid">
          <div class="detail-item"><div class="detail-item-label">Symbol</div><div class="detail-item-val">${t.symbol||'—'}</div></div>
          <div class="detail-item"><div class="detail-item-label">Direction</div><div class="detail-item-val">${(t.direction||'—').toUpperCase()}</div></div>
          <div class="detail-item"><div class="detail-item-label">Entry</div><div class="detail-item-val">${entry}</div></div>
          <div class="detail-item"><div class="detail-item-label">Exit</div><div class="detail-item-val">${exit}</div></div>
          <div class="detail-item"><div class="detail-item-label">Lot Size</div><div class="detail-item-val">${t.lot_size??'—'}</div></div>
          <div class="detail-item"><div class="detail-item-label">Ticket</div><div class="detail-item-val">${t.ticket??'—'}</div></div>
        </div>
      </div>`;
  }

  const annotationHtml = isApi ? `
      <div class="detail-notes-label" style="margin-top:14px;">Your journal entry</div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Session</label>
          <select class="form-input" id="ann-session">
            <option value="">Select...</option>
            <option value="asian" ${t.session==='asian'?'selected':''}>Asian</option>
            <option value="london" ${t.session==='london'?'selected':''}>London</option>
            <option value="ny" ${t.session==='ny'?'selected':''}>New York</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Model</label>
          <select class="form-input" id="ann-model">${buildModelOptions(t.model)}</select>
        </div>
        <div class="form-group">
          <label class="form-label">R Value</label>
          <input class="form-input" type="number" step="0.1" id="ann-r" value="${t.r_value??''}" placeholder="0.0" />
        </div>
        <div class="form-group form-group--full">
          <label class="form-label">Notes / Reasoning / Emotion</label>
          <textarea class="form-input form-textarea" id="ann-notes" rows="3" placeholder="Why did you enter? How did you feel?">${t.notes||''}</textarea>
        </div>
      </div>
      <button class="submit-btn" id="ann-save-btn" type="button" onclick="saveAnnotation('${t.id}')">Save Annotation</button>
      <div class="form-msg" id="ann-msg"></div>
  ` : '';

  document.getElementById('modal-body').innerHTML = `
    <div class="detail-badge-row">
      <span class="detail-badge ${t.result}">${t.result.toUpperCase()}</span>
      ${isApi ? `<span class="detail-badge tag">🔒 API</span>` : ''}
      ${t.account ? `<span class="detail-badge account">${t.account}</span>` : ''}
      ${!isApi && t.model   ? `<span class="detail-badge tag">${t.model}</span>`   : ''}
      ${!isApi && t.session ? `<span class="detail-badge tag">${t.session}</span>` : ''}
    </div>
    <div style="font-family:var(--font-mono);font-size:10px;color:var(--text4);letter-spacing:0.08em;">${dateStr}</div>
    <div class="detail-grid">
      <div class="detail-item">
        <div class="detail-item-label">R Value</div>
        <div class="detail-item-val ${t.r_value>0?'win-col':t.r_value<0?'loss-col':''}">${rDisplay}</div>
      </div>
      <div class="detail-item">
        <div class="detail-item-label">PnL (USD)</div>
        <div class="detail-item-val ${pnlClass}">${pnlDisplay}</div>
      </div>
    </div>
    ${lockedHtml}
    ${!isApi && t.notes ? `<div class="detail-notes-box"><div class="detail-notes-label">Notes</div><div class="detail-notes-text">${t.notes}</div></div>` : ''}
    ${annotationHtml}
  `;
  const delBtn = document.getElementById('modal-delete-btn');
  if (isApi) { delBtn.style.display = 'none'; }
  else { delBtn.style.display = ''; delBtn.onclick = () => confirmDelete(t.id); }
  const overlay = document.getElementById('trade-modal');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function buildModelOptions(selected) {
  return `<option value="">Select...</option>` +
    userModels.map(m=>`<option value="${m.name}" ${m.name===selected?'selected':''}>${m.name}</option>`).join('');
}

async function saveAnnotation(id) {
  const btn = document.getElementById('ann-save-btn');
  const session = document.getElementById('ann-session').value;
  const model   = document.getElementById('ann-model').value;
  const rRaw    = document.getElementById('ann-r').value;
  const notes   = document.getElementById('ann-notes').value.trim();
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    await updateTradeAnnotation(id, {
      r_value: rRaw!=='' ? parseFloat(rRaw) : null,
      model: model || null,
      session: session || null,
      notes: notes || null,
    });
    document.getElementById('ann-msg').textContent = 'Saved!';
    document.getElementById('ann-msg').className = 'form-msg success';
    await loadTrades();
  } catch(e) {
    document.getElementById('ann-msg').textContent = 'Could not save.';
    document.getElementById('ann-msg').className = 'form-msg error';
  } finally {
    btn.disabled = false; btn.textContent = 'Save Annotation';
  }
}

function updateUnannotatedBadge() {
  const count = allTrades.filter(t => t.source==='api' && !t.notes && !t.model).length;
  const badge = document.getElementById('log-unannotated-badge');
  if (!badge) return;
  if (count > 0) { badge.textContent = count; badge.style.display = ''; }
  else badge.style.display = 'none';
}

function closeTradeModal(e) {
  if (e && e.target !== document.getElementById('trade-modal')) return;
  document.getElementById('trade-modal').classList.remove('open');
  document.body.style.overflow = '';
}

// ── CALENDAR ──────────────────────────────────────────────────
async function renderCalendar() {
  const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('cal-month-label').textContent=`${MONTHS[calMonth-1]} ${calYear}`;
  const grid=document.getElementById('cal-grid'); grid.innerHTML='<div class="cal-loading">Loading...</div>';
  let trades=[];
  try { trades=await fetchTradesByMonth(calYear,calMonth); } catch(e){ console.error(e); }
  // Filter by active account if one is selected
  if (activeAccount) trades = trades.filter(t=>(t.account||'')===activeAccount);
  const tradeMap={};
  trades.forEach(t=>{ if(!tradeMap[t.date])tradeMap[t.date]=[]; tradeMap[t.date].push(t); });
  const totalPnl=trades.reduce((s,t)=>s+(t.pnl_usd||0),0);
  const wins=trades.filter(t=>t.result==='win').length, wr=trades.length>0?Math.round(wins/trades.length*100):0;
  const pnlEl=document.getElementById('cal-pnl');
  pnlEl.textContent=trades.length>0?(totalPnl>=0?`+$${totalPnl.toFixed(0)}`:`-$${Math.abs(totalPnl).toFixed(0)}`):' — ';
  pnlEl.className=`cal-stat-val ${totalPnl>=0?'win-col':'loss-col'}`;
  document.getElementById('cal-trades').textContent=trades.length||' — ';
  document.getElementById('cal-wr').textContent=trades.length>0?`${wr}%`:' — ';
  const firstDay=new Date(calYear,calMonth-1,1).getDay(), daysInMonth=new Date(calYear,calMonth,0).getDate(), today=new Date().toISOString().split('T')[0];
  const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  let html=DAYS.map(d=>`<div class="cal-day-hd">${d}</div>`).join('');
  for(let i=0;i<firstDay;i++)html+=`<div class="cal-cell empty"></div>`;
  for(let d=1;d<=daysInMonth;d++){
    const ds=`${calYear}-${String(calMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`, dts=tradeMap[ds]||[];
    const isToday=ds===today, dayPnl=dts.reduce((s,t)=>s+(t.pnl_usd||0),0), count=dts.length;
    let cls='cal-cell'; if(isToday)cls+=' today';
    if(count>0){ const hasWin=dts.some(t=>t.result==='win'),hasLoss=dts.some(t=>t.result==='loss'),allBE=dts.every(t=>t.result==='be'); if(allBE)cls+=' be'; else if(hasWin&&!hasLoss)cls+=' win'; else if(hasLoss&&!hasWin)cls+=' loss'; else cls+=' mixed'; }
    const pnlLabel=count>0?`<span class="cal-pnl-val ${dayPnl>=0?'pos':'neg'}">${dayPnl>=0?'+':''}$${Math.abs(dayPnl).toFixed(0)}</span>`:'';
    const cntLabel=count>0?`<span class="cal-count">${count}t</span>`:'';
    html+=`<div class="${cls}"><span class="cal-day-num">${d}</span>${pnlLabel}${cntLabel}</div>`;
  }
  grid.innerHTML=html;
}

// ── EQUITY CURVE ──────────────────────────────────────────────
function renderEquity() {
  const emptyEl=document.getElementById('equity-empty'), canvas=document.getElementById('equity-chart');
  const trades = getAccountTrades();
  if(trades.length===0){ emptyEl.style.display='flex'; canvas.style.display='none'; ['eq-total','eq-best','eq-worst','eq-dd'].forEach(id=>{document.getElementById(id).textContent=' — ';}); return; }
  emptyEl.style.display='none'; canvas.style.display='block';
  const sorted=[...trades].sort((a,b)=>new Date(a.date)-new Date(b.date));
  const labels=[],data=[]; let cum=0;
  sorted.forEach(t=>{ cum+=t.pnl_usd||0; labels.push(new Date(t.date+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'})); data.push(parseFloat(cum.toFixed(2))); });
  const pnlVals=sorted.map(t=>t.pnl_usd||0), total=cum, best=Math.max(...pnlVals), worst=Math.min(...pnlVals);
  let peak=0,maxDD=0; data.forEach(v=>{ if(v>peak)peak=v; const dd=peak-v; if(dd>maxDD)maxDD=dd; });
  const fmt=v=>v>=0?`+$${v.toFixed(2)}`:`-$${Math.abs(v).toFixed(2)}`;
  document.getElementById('eq-total').textContent=fmt(total); document.getElementById('eq-total').className=`equity-stat-val ${total>=0?'win-col':'loss-col'}`;
  document.getElementById('eq-best').textContent=fmt(best); document.getElementById('eq-worst').textContent=fmt(worst); document.getElementById('eq-dd').textContent=`-$${maxDD.toFixed(2)}`;
  if(equityChart)equityChart.destroy();
  const isDark=document.documentElement.getAttribute('data-theme')==='dark';
  const col=total>=0?(isDark?'#4ade80':'#6b7a52'):(isDark?'#f87171':'#8a4a4a');
  const fillCol=total>=0?(isDark?'rgba(74,222,128,0.08)':'rgba(107,122,82,0.08)'):(isDark?'rgba(248,113,113,0.08)':'rgba(138,74,74,0.08)');
  const tickColor=isDark?'#444444':'#8a8478', gridColor=isDark?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.04)';
  equityChart=new Chart(canvas,{ type:'line', data:{ labels, datasets:[{ data, borderColor:col, borderWidth:2, pointRadius:3, pointBackgroundColor:col, fill:true, backgroundColor:fillCol, tension:0.3 }] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, tooltip:{callbacks:{label:ctx=>fmt(ctx.raw)}} }, scales:{ x:{ticks:{color:tickColor,font:{size:10,family:'DM Mono'},maxTicksLimit:8,maxRotation:0},grid:{color:gridColor}}, y:{ticks:{color:tickColor,font:{size:10,family:'DM Mono'},callback:v=>v>=0?`+$${v}`:`-$${Math.abs(v)}`},grid:{color:gridColor}} } } });
}

// ── STATS / DASHBOARD ─────────────────────────────────────────
let statsChartMode = 'usd';
let statsChart = null;

function calcStreaks(trades) {
  const sorted = [...trades].sort((a,b)=>new Date(a.date)-new Date(b.date));
  let bestStreak=0, worstStreak=0, curWin=0, curLoss=0;
  sorted.forEach(t=>{
    if(t.result==='win')  { curWin++; curLoss=0; bestStreak=Math.max(bestStreak,curWin); }
    else if(t.result==='loss') { curLoss++; curWin=0; worstStreak=Math.max(worstStreak,curLoss); }
    else { curWin=0; curLoss=0; }
  });
  return { bestStreak, worstStreak };
}

function renderStats() {
  const trades = getAccountTrades();
  const emptyIds = ['st-total','st-wr','st-avgr','st-totalpnl','st-pf','st-avgwin','st-avgloss','st-rr','st-exp','st-beststreak','st-worststreak'];
  if(trades.length===0){
    emptyIds.forEach(id=>{ const el=document.getElementById(id); if(el)el.textContent='—'; });
    const sub1=document.getElementById('st-tradecnt'); if(sub1)sub1.textContent='— trades';
    const sub2=document.getElementById('st-wl-sub');  if(sub2)sub2.textContent='— W · — L';
    const sub3=document.getElementById('st-pf');      if(sub3)sub3.textContent='—';
    ['model-stats','session-stats','account-stats'].forEach(id=>{document.getElementById(id).innerHTML='<div class="empty-state">No trades yet.</div>';});
    renderStatsChart([]);
    return;
  }

  const wins   = trades.filter(t=>t.result==='win');
  const losses = trades.filter(t=>t.result==='loss');
  const total  = trades.length;
  const totalPnl = trades.reduce((s,t)=>s+(t.pnl_usd||0),0);
  const totalR   = trades.reduce((s,t)=>s+(t.r_value||0),0);
  const wr    = Math.round(wins.length/total*100);
  const avgR  = totalR/total;

  // Profit factor
  const grossWin  = wins.reduce((s,t)=>s+(t.pnl_usd||0),0);
  const grossLoss = Math.abs(losses.reduce((s,t)=>s+(t.pnl_usd||0),0));
  const pf = grossLoss>0 ? (grossWin/grossLoss).toFixed(2) : grossWin>0 ? '∞' : '—';

  // Avg win / avg loss
  const avgWin  = wins.length>0   ? grossWin/wins.length   : 0;
  const avgLoss = losses.length>0 ? grossLoss/losses.length : 0;

  // R:R ratio
  const avgWinR  = wins.length>0   ? wins.reduce((s,t)=>s+(t.r_value||0),0)/wins.length   : 0;
  const avgLossR = losses.length>0 ? Math.abs(losses.reduce((s,t)=>s+(t.r_value||0),0)/losses.length) : 0;
  const rrRatio  = avgLossR>0 ? (avgWinR/avgLossR).toFixed(2) : avgWinR>0 ? '∞' : '—';

  // Expectancy: (WR * avgWin) - (LR * avgLoss)
  const lr = losses.length/total;
  const expectancy = (wr/100)*avgWin - lr*avgLoss;

  // Streaks
  const { bestStreak, worstStreak } = calcStreaks(trades);

  // Render hero
  const pnlEl = document.getElementById('st-totalpnl');
  pnlEl.textContent = totalPnl>=0?`+$${totalPnl.toFixed(2)}`:`-$${Math.abs(totalPnl).toFixed(2)}`;
  pnlEl.className = `dash-hero-val ${totalPnl>=0?'win-col':'loss-col'}`;
  document.getElementById('st-tradecnt').textContent = `${total} trade${total!==1?'s':''}`;

  const wrEl = document.getElementById('st-wr');
  wrEl.textContent = `${wr}%`;
  wrEl.className = `dash-hero-val ${wr>=50?'win-col':'loss-col'}`;
  document.getElementById('st-wl-sub').textContent = `${wins.length}W · ${losses.length}L`;

  const pfEl = document.getElementById('st-pf');
  pfEl.textContent = pf;
  pfEl.className = `dash-hero-val ${parseFloat(pf)>=1?'win-col':'loss-col'}`;

  // Render secondary metrics
  const setMetric = (id, val, cls='') => {
    const el = document.getElementById(id); if(!el)return;
    el.textContent = val;
    if(cls) el.className = `dash-metric-val ${cls}`;
  };
  setMetric('st-avgwin',  avgWin>0?`+$${avgWin.toFixed(2)}`:'—',  'win-col');
  setMetric('st-avgloss', avgLoss>0?`-$${avgLoss.toFixed(2)}`:'—', 'loss-col');
  setMetric('st-rr',      rrRatio);
  setMetric('st-exp',     isNaN(expectancy)?'—':`${expectancy>=0?'+':''}$${Math.abs(expectancy).toFixed(2)}`);
  setMetric('st-beststreak',  bestStreak>0?`${bestStreak}W`:'—',  bestStreak>0?'win-col':'');
  setMetric('st-worststreak', worstStreak>0?`${worstStreak}L`:'—', worstStreak>0?'loss-col':'');
  setMetric('st-avgr', `${avgR>=0?'+':''}${avgR.toFixed(2)}R`);
  document.getElementById('st-total').textContent = total;

  // Render daily chart
  renderStatsChart(trades);

  // Perf rows
  const buildPerfRows=(groupKey,elId)=>{
    const groups={};
    trades.forEach(t=>{ const k=t[groupKey]?(t[groupKey].charAt(0).toUpperCase()+t[groupKey].slice(1)):'Other'; if(!groups[k])groups[k]={wins:0,losses:0,be:0,pnl:0,r:0}; groups[k][t.result==='win'?'wins':t.result==='loss'?'losses':'be']++; groups[k].pnl+=t.pnl_usd||0; groups[k].r+=t.r_value||0; });
    document.getElementById(elId).innerHTML=Object.entries(groups).map(([name,d])=>{ const t=d.wins+d.losses+d.be,w=t>0?Math.round(d.wins/t*100):0,pnlStr=d.pnl>=0?`+$${d.pnl.toFixed(2)}`:`-$${Math.abs(d.pnl).toFixed(2)}`; return `<div class="perf-row"><div class="perf-name">${name}</div><div class="perf-meta"><span class="perf-wr">${w}% WR</span><span class="perf-r ${d.pnl>=0?'win-col':'loss-col'}">${pnlStr}</span><span class="perf-count">${t} trades</span></div></div>`; }).join('');
  };
  buildPerfRows('model','model-stats'); buildPerfRows('session','session-stats'); buildPerfRows('account','account-stats');
}

function renderStatsChart(trades) {
  const canvas  = document.getElementById('stats-cumulative-chart');
  const emptyEl = document.getElementById('stats-chart-empty');
  if (!canvas) return;

  if (!trades || trades.length===0) {
    canvas.style.display='none'; emptyEl.style.display='flex'; return;
  }
  canvas.style.display='block'; emptyEl.style.display='none';

  const sorted = [...trades].sort((a,b)=>new Date(a.date)-new Date(b.date));
  const labels=[], dataUsd=[], dataR=[];
  let cumUsd=0, cumR=0;
  sorted.forEach(t=>{
    cumUsd += t.pnl_usd||0;
    cumR   += t.r_value||0;
    labels.push(new Date(t.date+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'}));
    dataUsd.push(parseFloat(cumUsd.toFixed(2)));
    dataR.push(parseFloat(cumR.toFixed(2)));
  });

  const values = statsChartMode==='usd' ? dataUsd : dataR;
  const total  = values[values.length-1] || 0;
  const isDark = document.documentElement.getAttribute('data-theme')==='dark';
  const accentColor = isDark ? '#4ade80' : '#5a6e42';
  const fillColor   = isDark ? 'rgba(74,222,128,0.08)' : 'rgba(90,110,66,0.08)';
  const tickColor   = isDark ? '#4a4a4a' : '#8a8478';
  const gridColor   = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
  const labelFmt    = statsChartMode==='usd'
    ? v=>(v>=0?`+$${v.toFixed(0)}`:`-$${Math.abs(v).toFixed(0)}`)
    : v=>(v>=0?`+${v.toFixed(2)}R`:`${v.toFixed(2)}R`);

  if(statsChart) statsChart.destroy();
  statsChart = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets:[{
      data: values,
      borderColor: accentColor,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: accentColor,
      fill: true,
      backgroundColor: fillColor,
      tension: 0.3
    }]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins:{ legend:{display:false}, tooltip:{callbacks:{label:ctx=>labelFmt(ctx.raw)}} },
      scales:{
        x:{ticks:{color:tickColor,font:{size:9,family:'DM Mono'},maxTicksLimit:8,maxRotation:0},grid:{color:gridColor}},
        y:{ticks:{color:tickColor,font:{size:9,family:'DM Mono'},callback:labelFmt},grid:{color:gridColor}}
      }
    }
  });
}

function switchStatsChart(mode) {
  statsChartMode = mode;
  document.getElementById('stats-toggle-usd').classList.toggle('active', mode==='usd');
  document.getElementById('stats-toggle-r').classList.toggle('active', mode==='r');
  renderStatsChart(getAccountTrades());
}

// ── STARTING BALANCE ──────────────────────────────────────────
function saveStartingBalance() {
  const input = document.getElementById('starting-balance-input');
  const msg   = document.getElementById('starting-balance-msg');
  const val   = parseFloat(input.value);
  if (!input.value || isNaN(val) || val <= 0) {
    msg.textContent='Please enter a valid positive number.'; msg.className='auth-msg error';
    setTimeout(()=>{msg.textContent='';msg.className='auth-msg';},3000); return;
  }
  localStorage.setItem('nxuu_starting_balance', val.toString());
  msg.textContent='Saved!'; msg.className='auth-msg success';
  setTimeout(()=>{msg.textContent='';msg.className='auth-msg';},3000);
}

// ── LEADERBOARD ───────────────────────────────────────────────
async function renderLeaderboard() {
  document.getElementById('lb-winrate').innerHTML = `<div class="lb-empty">Loading...</div>`;
  document.getElementById('lb-pnl').innerHTML     = `<div class="lb-empty">Loading...</div>`;
  try {
    const rows = await fetchLeaderboard();
    const myId = getUserId();

    if (!rows || rows.length === 0) {
      const empty = `<div class="lb-empty">No team members on the leaderboard yet.<br>Enable sharing in Settings.</div>`;
      document.getElementById('lb-winrate').innerHTML = empty;
      document.getElementById('lb-pnl').innerHTML    = empty;
      return;
    }

    // Build win-rate ranking
    const byWR = [...rows].sort((a,b)=>b.win_rate-a.win_rate);
    const maxWR = byWR[0]?.win_rate || 1;
    document.getElementById('lb-winrate').innerHTML = byWR.map((r,i)=>{
      const rankClass = i===0?'gold':i===1?'silver':i===2?'bronze':'';
      const isMe = r.user_id === myId;
      const pct  = Math.round((r.win_rate/maxWR)*100);
      return `<div class="lb-row">
        <span class="lb-rank ${rankClass}">${i+1}</span>
        <div class="lb-bar-wrap"><div class="lb-bar" style="width:${pct}%"></div></div>
        <span class="lb-name">${r.display_name || r.email?.split('@')[0] || 'Trader'} ${isMe?'<span class="lb-you-badge">you</span>':''}</span>
        <div class="lb-meta">
          <span class="lb-wr">${Math.round(r.win_rate)}%</span>
          <span class="lb-pnl">${r.total_trades} trades</span>
        </div>
      </div>`;
    }).join('');

    // Build PnL ranking
    const byPnl = [...rows].sort((a,b)=>b.total_pnl-a.total_pnl);
    const maxPnl = Math.max(...byPnl.map(r=>Math.abs(r.total_pnl)), 1);
    document.getElementById('lb-pnl').innerHTML = byPnl.map((r,i)=>{
      const rankClass = i===0?'gold':i===1?'silver':i===2?'bronze':'';
      const isMe = r.user_id === myId;
      const pct  = Math.round((Math.abs(r.total_pnl)/maxPnl)*100);
      const pnlStr = r.total_pnl>=0 ? `+$${r.total_pnl.toFixed(0)}` : `-$${Math.abs(r.total_pnl).toFixed(0)}`;
      return `<div class="lb-row">
        <span class="lb-rank ${rankClass}">${i+1}</span>
        <div class="lb-bar-wrap"><div class="lb-bar" style="width:${pct}%"></div></div>
        <span class="lb-name">${r.display_name || r.email?.split('@')[0] || 'Trader'} ${isMe?'<span class="lb-you-badge">you</span>':''}</span>
        <div class="lb-meta">
          <span class="lb-wr ${r.total_pnl>=0?'win-col':'loss-col'}">${pnlStr}</span>
          <span class="lb-pnl">${r.total_trades} trades</span>
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    const err = `<div class="lb-empty">Could not load leaderboard.</div>`;
    document.getElementById('lb-winrate').innerHTML = err;
    document.getElementById('lb-pnl').innerHTML    = err;
    console.error(e);
  }
}

function saveLeaderboardOptIn() {
  const checked = document.getElementById('lb-opt-in').checked;
  localStorage.setItem('nxuu_lb_optin', checked);
}

// ── SETTINGS ──────────────────────────────────────────────────
async function saveDisplayName() {
  const input = document.getElementById('display-name-input');
  const btn   = document.getElementById('display-name-btn');
  const msg   = document.getElementById('display-name-msg');
  const name  = input.value.trim();
  if (!name) return;
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    await updateUserDisplayName(name);
    // Update header display
    document.getElementById('user-email').textContent = name;
    msg.textContent = 'Saved!'; msg.className = 'auth-msg success';
    setTimeout(()=>{ msg.textContent=''; msg.className='auth-msg'; }, 3000);
  } catch(e) {
    msg.textContent = e.message; msg.className = 'auth-msg error';
  } finally {
    btn.disabled = false; btn.textContent = 'Save';
  }
}

function renderSettings() {
  const stepsEl = document.getElementById('steps-manage-list');
  stepsEl.innerHTML = userSteps.length===0 ? `<div class="empty-state">No steps yet.</div>` :
    userSteps.map(s=>`<div class="manage-row"><div class="manage-row-info"><span class="manage-row-section">${s.section}</span><span class="manage-row-title">${s.title}</span></div><button class="delete-btn" onclick="removeStep('${s.id}')" type="button">✕</button></div>`).join('');
  const modelsEl = document.getElementById('models-manage-list');
  modelsEl.innerHTML = userModels.length===0 ? `<div class="empty-state">No models yet.</div>` :
    userModels.map(m=>`<div class="manage-row"><div class="manage-row-info"><span class="manage-row-title">${m.name}</span></div><button class="delete-btn" onclick="removeModel('${m.id}')" type="button">✕</button></div>`).join('');
  // Populate display name
  const dnInput = document.getElementById('display-name-input');
  if (dnInput) dnInput.value = getUserDisplayName();
  // Sync dark toggle
  const isDark = document.documentElement.getAttribute('data-theme')==='dark';
  const dt = document.getElementById('dark-mode-toggle'); if(dt) dt.checked=isDark;
  // Sync leaderboard opt-in
  const optIn = localStorage.getItem('nxuu_lb_optin')==='true';
  const lb = document.getElementById('lb-opt-in'); if(lb) lb.checked=optIn;
  // Populate starting balance
  const sbInput = document.getElementById('starting-balance-input');
  if(sbInput) sbInput.value = localStorage.getItem('nxuu_starting_balance') || '';
  refreshSyncKeyStatus();
}

async function addStep() {
  const section=document.getElementById('new-step-section').value.trim(), title=document.getElementById('new-step-title').value.trim();
  if(!section||!title)return alert('Please fill in both section and title.');
  try { await insertStep(section,title,userSteps.length); document.getElementById('new-step-section').value=''; document.getElementById('new-step-title').value=''; await loadSteps(); renderSettings(); }
  catch(e){ alert('Could not add step.'); }
}
async function removeStep(id) { if(!confirm('Delete this step?'))return; try{await deleteStep(id);await loadSteps();renderSettings();}catch(e){alert('Could not delete step.');} }
async function addModel() { const name=document.getElementById('new-model-name').value.trim(); if(!name)return alert('Please enter a model name.'); try{await insertModel(name);document.getElementById('new-model-name').value='';await loadModels();renderSettings();}catch(e){alert('Could not add model.');} }
async function removeModel(id) { if(!confirm('Delete this model?'))return; try{await deleteModel(id);await loadModels();renderSettings();}catch(e){alert('Could not delete model.');} }

// ── MT4/5 SYNC ────────────────────────────────────────────────
async function refreshSyncKeyStatus() {
  const statusEl = document.getElementById('sync-key-status');
  if (!statusEl) return;
  try {
    const exists = await hasSyncKey();
    statusEl.textContent = exists ? 'Sync key active' : 'No sync key yet';
  } catch(e) { statusEl.textContent = '—'; }
}

async function handleGenerateSyncKey() {
  if (!confirm('Generate a new sync key? Any previous key (and your EA config) will stop working.')) return;
  try {
    const key = await generateSyncKey();
    const box = document.getElementById('sync-key-reveal');
    box.innerHTML = `
      <div class="detail-notes-label">Your sync key (shown once — copy it now)</div>
      <div class="detail-notes-text" style="font-family:var(--font-mono);user-select:all;word-break:break-all;">${key}</div>
      <div class="form-hint" style="margin-top:6px;">Paste this into the EA's "Sync Key" input in MT4/5.</div>`;
    box.style.display = '';
    await refreshSyncKeyStatus();
  } catch(e) { alert('Could not generate sync key.'); }
}

async function handleRevokeSyncKey() {
  if (!confirm('Revoke sync key? The EA will stop syncing until you generate a new one.')) return;
  try { await revokeSyncKey(); document.getElementById('sync-key-reveal').style.display='none'; await refreshSyncKeyStatus(); }
  catch(e) { alert('Could not revoke key.'); }
}

// ── EXPORT ────────────────────────────────────────────────────
function exportCSV() {
  if(allTrades.length===0)return alert('No trades to export.');
  const headers=['Date','Result','R Value','PnL (USD)','Account','Model','Session','Notes'];
  const rows=allTrades.map(t=>[t.date,t.result,t.r_value||'',t.pnl_usd||'',t.account||'',t.model||'',t.session||'',(t.notes||'').replace(/,/g,' ')]);
  const csv=[headers,...rows].map(r=>r.join(',')).join('\n');
  const a=document.createElement('a'); a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv); a.download=`nxuu-trades-${new Date().toISOString().split('T')[0]}.csv`; a.click();
}

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initDarkMode();

  document.querySelectorAll('.tab-btn').forEach(btn=>{
    btn.addEventListener('click',()=>switchTab(btn.dataset.tab));
  });

  document.getElementById('resetBtn').addEventListener('click', resetChecklist);
  initForm();
  document.getElementById('submitBtn').addEventListener('click', submitTrade);
  document.getElementById('refreshBtn').addEventListener('click', loadTrades);
  document.getElementById('cal-prev').addEventListener('click',()=>{ calMonth--;if(calMonth<1){calMonth=12;calYear--;}renderCalendar(); });
  document.getElementById('cal-next').addEventListener('click',()=>{ calMonth++;if(calMonth>12){calMonth=1;calYear++;}renderCalendar(); });

  document.addEventListener('touchstart', unlockAudio, {once:true,passive:true});
  document.addEventListener('touchend',   unlockAudio, {once:true,passive:true});

  // Close modal on Escape
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeTradeModal(); });

  if (!isConfigured()) {
    document.getElementById('auth-screen').style.display = 'flex';
    return;
  }

  // Handle Supabase email/password-reset redirect (tokens in URL hash)
  const hash = window.location.hash;
  if (hash && hash.includes('access_token')) {
    const params       = new URLSearchParams(hash.replace('#',''));
    const accessToken  = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const type         = params.get('type');
    if (accessToken) {
      try {
        await setSessionFromTokens(accessToken, refreshToken);
        history.replaceState(null,'',window.location.pathname);
        if (type==='recovery') {
          // Show password-reset UI — for now just boot the app; user is logged in
          await bootApp();
          return;
        }
        if (type==='signup') {
          showAuthTab('signin');
          setAuthMsg(document.getElementById('signin-msg'),'Email confirmed! Signing you in…','success');
        }
        await bootApp();
        return;
      } catch(e) { console.error('Token restore failed:',e); }
    }
  }

  if (restoreSession()) { await bootApp(); }
  else { document.getElementById('auth-screen').style.display='flex'; }
});
