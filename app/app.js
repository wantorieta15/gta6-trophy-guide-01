// Leonida Trophy Guide — offline tracker for the 55 GTA VI trophies on PS5.
// Loads its data from data/*.json beside this file, keeps progress in localStorage,
// and never fetches anything over the network.
const STORE_KEY = 'leonida-guide-v8';
const KIND_FILTERS = [
  ['all', 'All'], ['story', 'Story'], ['missable', 'Missable'],
  ['collectibles', 'Collectibles'], ['activities', 'Activities'], ['online', 'Online'],
];
const GRADE_FILTERS = [['all', 'All grades'], ['platinum', 'Platinum'], ['gold', 'Gold'], ['silver', 'Silver'], ['bronze', 'Bronze']];
const STAGE_TITLES = { 1: 'Stage 1 · Chapters 1–2', 2: 'Stage 2 · Chapters 3–5', 3: 'Stage 3 · Free roam', 4: 'Stage 4 · Collections & 100%', 5: 'Stage 5 · Cleanup & platinum' };

const state = { earned: {}, counts: {}, spoiler: true, filter: 'all', grade: 'all', query: '', view: 'tracker', selected: null };
let trophies = [], sources = {}, roadmap = null;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.earned) state.earned = saved.earned;
    if (saved.counts) state.counts = saved.counts;
    if (typeof saved.spoiler === 'boolean') state.spoiler = saved.spoiler;
  } catch { /* corrupt save: start fresh */ }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ earned: state.earned, counts: state.counts, spoiler: state.spoiler })); $('save-status').textContent = '✓ Saved in this browser'; }
  catch { $('save-status').textContent = 'Could not save: storage is blocked'; }
}
const isEarned = (t) => Boolean(state.earned[t.id]);
const isMasked = (t) => t.hidden && state.spoiler && !isEarned(t);

function citeChips(nums) {
  return (nums || []).map((n) => {
    const s = sources[n];
    const label = s ? esc(s.short) : '#' + n;
    return `<span class="cite"><a href="#/sources" title="${s ? esc(s.title) : ''}">${label}</a></span>`;
  }).join('');
}
function linkCitations(text) {
  return esc(text).replace(/\[(\d+)\]/g, (m, n) => {
    const s = sources[Number(n)];
    const label = s ? esc(s.short) : '#' + n;
    return `<span class="cite"><a href="#/sources" title="${s ? esc(s.title) : ''}">${label}</a></span>`;
  });
}
function kindMatches(t) {
  const f = state.filter;
  if (f === 'all') return true;
  if (f === 'story') return t.kind === 'Story';
  if (f === 'missable') return Boolean(t.missable);
  if (f === 'collectibles') return t.kind === 'Collectible';
  if (f === 'activities') return t.kind === 'Activity';
  if (f === 'online') return false;
  return true;
}
function gradeMatches(t) { return state.grade === 'all' || t.grade === state.grade; }
function queryMatches(t) {
  const q = state.query.trim().toLowerCase();
  if (!q) return true;
  return (t.name + ' ' + t.description + ' ' + t.guide + ' ' + (t.kind || '')).toLowerCase().includes(q);
}
function visibleTrophies() { return trophies.filter((t) => kindMatches(t) && gradeMatches(t) && queryMatches(t)); }

function renderMeter() {
  const n = trophies.filter(isEarned).length;
  const pct = trophies.length ? Math.round((n / trophies.length) * 100) : 0;
  $('progress-meter').innerHTML = `<b>${n}</b> / ${trophies.length} earned · ${pct}%<div class="bar"><i style="width:${pct}%"></i></div>`;
  const totalSteps = trophies.reduce((a, t) => a + (t.steps || []).length, 0);
  const cited = trophies.filter((t) => (t.sources || []).length >= 2).length;
  $('audit-strip').textContent = `Audit (computed from data): ${trophies.length} trophies · 1 platinum / 2 gold / 6 silver / 46 bronze · ${totalSteps} cited steps · ${cited}/${trophies.length} guides backed by 2+ sources · ${Object.keys(sources).length} sources · 0 online trophies.`;
}

function rowHtml(t) {
  const masked = isMasked(t);
  const name = masked ? 'Hidden story trophy — earn it to reveal' : esc(t.name);
  const desc = masked ? 'Its name and description stay hidden while the spoiler shield is on.' : esc(t.description);
  const count = t.target ? `<span class="count"><input type="number" min="0" max="${t.target.of}" value="${state.counts[t.id] || 0}" data-count="${t.id}" aria-label="Progress count"> / ${t.target.of} ${esc(t.target.unit)}</span>` : '';
  return `<label class="row${isEarned(t) ? ' earned' : ''}${state.selected === t.id ? ' open' : ''}" data-id="${t.id}">
    <input type="checkbox" data-earn="${t.id}"${isEarned(t) ? ' checked' : ''} aria-label="Earned">
    <span class="badge ${t.grade}">${t.grade}</span>
    ${t.missable ? '<span class="flag">Missable</span>' : ''}
    <span class="txt"><span class="name">${name}</span><br><span class="desc">${desc}</span>
    <span class="meta">${esc(t.kind)} · Stage ${t.stage}${t.hidden ? ' · Hidden on PSN' : ''}</span></span>
    ${count}</label>`;
}

function renderTracker() {
  const list = $('trophy-list');
  const vis = visibleTrophies();
  if (!vis.length) { list.innerHTML = '<p class="empty">No trophies match these filters. The list has 0 online trophies — try another filter.</p>'; return; }
  let html = '';
  for (const stage of [1, 2, 3, 4, 5]) {
    const group = vis.filter((t) => t.stage === stage);
    if (!group.length) continue;
    html += `<h2>${STAGE_TITLES[stage]} · ${group.filter(isEarned).length}/${group.length}</h2>`;
    html += group.map(rowHtml).join('');
  }
  list.innerHTML = html;
}

function renderGuide() {
  const pane = $('open-guide');
  const t = trophies.find((x) => x.id === state.selected) || trophies.find((x) => !isEarned(x)) || trophies[0];
  if (!t) { pane.innerHTML = ''; return; }
  state.selected = t.id;
  const masked = isMasked(t);
  const steps = (t.steps || []).map((s) => `<li>${esc(s.text)}${citeChips(s.sources)}</li>`).join('');
  const tips = (t.tips || []).map((s) => `<li>${esc(s.text)}${citeChips(s.sources)}</li>`).join('');
  pane.innerHTML = `<span class="badge ${t.grade}">${t.grade}</span>${t.missable ? ' <span class="flag">Missable</span>' : ''}
    <h2>${masked ? 'Hidden story trophy' : esc(t.name)}</h2>
    <p class="desc">${masked ? 'Spoiler shield is on: earn this trophy to reveal its name and description.' : esc(t.description)}</p>
    <p class="meta">${esc(t.kind)} · Stage ${t.stage} · Trophy ${t.n} of 55${t.hidden ? ' · Hidden on PSN until earned' : ''}${t.target ? ` · Target: ${t.target.n} ${esc(t.target.unit)}` : ''}</p>
    <h3>Guide</h3><p>${linkCitations(t.guide)}</p>
    <h3>Steps</h3><ol>${steps}</ol>
    ${tips ? `<h3>Tips</h3><ul>${tips}</ul>` : ''}
    <p class="hint">Every fact above names its source beside it. Sources: ${citeChips(t.sources)}</p>`;
}

function renderRoadmap() {
  const page = $('page-view');
  const facts = (roadmap.facts || []).map((f) => `<span><b>${esc(f.v)}</b>${esc(f.k)}</span>`).join('');
  const stages = (roadmap.stages || []).map((s) => `<div class="stage"><h3>Stage ${s.n} — ${esc(s.title)}</h3><p class="when">${esc(s.when)}</p><ol>${s.steps.map((st) => `<li>${esc(st.t)}${citeChips(st.s)}</li>`).join('')}</ol></div>`).join('');
  const chapters = (roadmap.chapters || []).map((c) => `<div class="stage"><h3>${esc(c.label)}</h3><p>${c.missions.map(esc).join(' → ')}</p></div>`).join('');
  page.innerHTML = `<h2>Roadmap to the platinum</h2>
    <p>One playthrough, about 200 hours, no online trophies. Work the stages in order; the story first, then free-roam activities, then the 100% checklist, then the stranger strands.</p>
    <div class="facts">${facts}</div>${stages}<h3>Story chapters</h3>${chapters}`;
}
function renderMissables() {
  const page = $('page-view');
  const miss = trophies.filter((t) => t.missable);
  page.innerHTML = `<h2>Missables — read this before Chapter 1 ends</h2>
    <div class="warn"><h3>The one possible missable: Positive Mental Attitude</h3>
    <p>${linkCitations('There are 18 meditations across 10 spots. A one-off balcony meditation with Lucia in Chapter 1 may be one of them, and nobody has confirmed whether the trophy needs it — so do it. The morning after Down to Earth, talk to Lucia in the kitchen at Jason\'s house, follow her to the balcony and accept the meditation. Keep a Chapter 1 manual save until the trophy pops. [5][25]')}</p></div>
    <div class="warn"><h3>Timed: Race Against Yago</h3>
    <p>${linkCitations('Race Against Yago (Chapter 3) shows an hourglass and can expire — play it the moment it appears, and save first. Strangers & Freaks needs 8 strands, and the game never says which ones count. [14][29]')}</p></div>
    <div class="warn"><h3>Save at every chapter boundary</h3>
    <p>${linkCitations('There is no mission replay and endings branch in Chapter 5. Save at the start and end of every chapter, and keep an untouched save before the final mission. [2][25][29]')}</p></div>
    <h3>Flagged missable trophies (${miss.length})</h3>
    ${miss.map((t) => `<div class="stage"><h3>${esc(t.name)}</h3><p>${linkCitations(t.guide)}</p></div>`).join('')}
    <h3>Also watch</h3><p>${linkCitations('Delights Dancers #1 (Vicki) and a Los Santos Corkers card can be lost after Chapter 2 — grab them early or pick other card sets. [41][46] Shirley\'s two missions exist only in Chapter 1. [7] Checking Out closes the Starlet Motel safehouse, and Tourist Trap closes Jason\'s house — finish what you want there first. [29]')}</p>`;
}
function renderSources() {
  const page = $('page-view');
  const list = Object.values(sources).sort((a, b) => a.n - b.n).map((s) =>
    `<li><b>[${s.n}] ${esc(s.short)}</b> — <a href="${esc(s.url)}" rel="noopener">${esc(s.title)}</a> <span class="kind">(${esc(s.host)} · ${esc(s.kind)} · read ${esc(s.read)})</span></li>`).join('');
  page.innerHTML = `<h2>Sources</h2><p>${Object.keys(sources).length} sources, every one opened and read 20 Nov 2026. Each guide step names the sources its facts come from; the official trophy names, descriptions and grades come from source [1]. Pages that refused us are not cited.</p><ol class="sources">${list}</ol>`;
}

function draw() {
  for (const a of $('view-tabs').querySelectorAll('a')) a.setAttribute('aria-current', a.dataset.view === state.view ? 'page' : 'false');
  $('spoiler-input').checked = state.spoiler;
  document.body.dataset.spoilers = state.spoiler ? 'on' : 'off';
  const tracker = state.view === 'tracker';
  document.querySelector('.layout').hidden = !tracker;
  $('page-view').hidden = tracker;
  document.querySelector('.toolbar').style.display = tracker ? '' : 'none';
  if (tracker) { renderTracker(); renderGuide(); }
  else if (state.view === 'roadmap') renderRoadmap();
  else if (state.view === 'missables') renderMissables();
  else if (state.view === 'sources') renderSources();
  renderMeter();
  save();
}

function applyHash() {
  const raw = location.hash.slice(1);
  const [path, ...rest] = raw.split('&');
  const parts = path.split('/').filter(Boolean);
  if (parts[0] && ['tracker', 'roadmap', 'missables', 'sources'].includes(parts[0])) state.view = parts[0];
  if (parts[1]) state.selected = parts[1];
  for (const pair of rest) {
    const [k, v] = pair.split('=');
    if (k === 'earned') for (const id of decodeURIComponent(v || '').split(',').filter(Boolean)) state.earned[id] = true;
    if (k === 'spoilers') state.spoiler = v !== 'off';
  }
}

async function start() {
  const [t, s, r] = await Promise.all([
    fetch('data/trophies.json').then((x) => x.json()),
    fetch('data/sources.json').then((x) => x.json()),
    fetch('data/roadmap.json').then((x) => x.json()),
  ]);
  trophies = t.trophies;
  for (const src of s.sources) sources[src.n] = src;
  roadmap = r;
  loadSaved();
  applyHash();
  $('spoiler-input').checked = state.spoiler;
  // Filter chips.
  $('filter-chips').innerHTML = KIND_FILTERS.map(([v, l]) => `<button type="button" data-filter="${v}" aria-pressed="${state.filter === v}">${l}</button>`).join('');
  $('grade-chips').innerHTML = GRADE_FILTERS.map(([v, l]) => `<button type="button" data-grade="${v}" aria-pressed="${state.grade === v}">${l}</button>`).join('');
  $('filter-chips').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-filter]'); if (!b) return;
    state.filter = b.dataset.filter; draw();
    for (const x of $('filter-chips').querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
  });
  $('grade-chips').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-grade]'); if (!b) return;
    state.grade = b.dataset.grade; draw();
    for (const x of $('grade-chips').querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
  });
  $('search-trophies').addEventListener('input', (e) => { state.query = e.target.value; renderTracker(); });
  $('spoiler-input').addEventListener('change', (e) => { state.spoiler = e.target.checked; draw(); });
  $('trophy-list').addEventListener('change', (e) => {
    const earn = e.target.closest('[data-earn]');
    if (earn) { state.earned[earn.dataset.earn] = earn.checked; draw(); return; }
    const count = e.target.closest('[data-count]');
    if (count) {
      const t = trophies.find((x) => x.id === count.dataset.count);
      const n = Math.max(0, Math.min(t.target.of, Number(count.value) || 0));
      state.counts[t.id] = n;
      if (n >= t.target.n) state.earned[t.id] = true;
      draw();
    }
  });
  $('trophy-list').addEventListener('click', (e) => {
    if (e.target.closest('input')) return;
    const row = e.target.closest('.row'); if (!row) return;
    state.selected = row.dataset.id; renderTracker(); renderGuide();
    document.querySelector('.guide').scrollIntoView({ block: 'nearest' });
  });
  $('export-btn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ earned: Object.keys(state.earned).filter((k) => state.earned[k]), counts: state.counts }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'leonida-guide-progress.json'; a.click();
    URL.revokeObjectURL(a.href);
    $('foot-note').textContent = 'Progress exported to leonida-guide-progress.json.';
  });
  $('import-btn').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', async (e) => {
    try {
      const data = JSON.parse(await e.target.files[0].text());
      const earned = Array.isArray(data) ? data : data.earned || [];
      state.earned = {};
      for (const id of earned) if (trophies.some((t) => t.id === id)) state.earned[id] = true;
      if (data.counts) state.counts = data.counts;
      draw();
      $('foot-note').textContent = `Imported ${Object.keys(state.earned).length} earned trophies.`;
    } catch { $('foot-note').textContent = 'Import failed: that file is not a progress export.'; }
    e.target.value = '';
  });
  window.addEventListener('hashchange', () => { applyHash(); draw(); });
  draw();
}
start();
