const STORAGE_KEY = 'miniTripPlanner.v1';

const $ = (sel) => document.querySelector(sel);
const el = (tag, props = {}, children = []) => {
  const n = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (k === 'html') n.innerHTML = v;
    else n.setAttribute(k, v);
  });
  [].concat(children).forEach(c => {
    if (c == null) return;
    n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return n;
};

let state = {
  info: { dest: '', startDate: '', endDate: '', budgetCap: '' },
  plans: [], // {date, title, time, place}
  pack: [],  // {id, name, done}
  expenses: [], // {id, name, cat, amt}
  notes: ''
};

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const d = new Date();
  $('#savedAt').textContent = `保存: ${d.toLocaleString()}`;
  updateDerived();
}

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      state = Object.assign(state, parsed);
    } catch {}
  } else {
    // 初期持ち物テンプレ
    state.pack = [
      {id: uid(), name: 'パスポート/身分証', done: false},
      {id: uid(), name: '財布/カード', done: false},
      {id: uid(), name: 'モバイルバッテリー/充電器', done: false},
      {id: uid(), name: '薬/常備品', done: false},
    ];
  }
}

function uid() { return Math.random().toString(36).slice(2, 9); }

function bindInfo() {
  const dest = $('#dest'), sd = $('#startDate'), ed = $('#endDate'), cap = $('#budgetCap');
  dest.value = state.info.dest || '';
  sd.value = state.info.startDate || '';
  ed.value = state.info.endDate || '';
  cap.value = state.info.budgetCap || '';

  const onInfo = () => {
    state.info = {
      dest: dest.value.trim(),
      startDate: sd.value,
      endDate: ed.value,
      budgetCap: cap.value
    };
    updateMapsLink();
    save();
  };

  [dest, sd, ed, cap].forEach(i => i.addEventListener('input', onInfo));
  updateMapsLink();
  updateDerived();
}

function updateMapsLink() {
  const dest = state.info.dest?.trim();
  const a = $('#mapsLink');
  if (dest) {
    a.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dest)}`;
    a.style.pointerEvents = 'auto';
    a.style.opacity = 1;
  } else {
    a.href = '#';
    a.style.pointerEvents = 'none';
    a.style.opacity = 0.5;
  }
}

function updateDerived() {
  const { startDate, endDate, budgetCap } = state.info;
  const daysEl = $('#tripDays');
  if (startDate && endDate) {
    const s = new Date(startDate), e = new Date(endDate);
    const diff = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
    daysEl.textContent = `旅行日数: ${diff > 0 ? diff : '-'} 日`;
  } else {
    daysEl.textContent = '旅行日数: -';
  }

  // Budget summary
  const total = state.expenses.reduce((a, b) => a + (Number(b.amt) || 0), 0);
  $('#totalSpent').textContent = total.toLocaleString();
  if (budgetCap) {
    const remain = Number(budgetCap) - total;
    $('#remainBudget').textContent = remain.toLocaleString();
  } else {
    $('#remainBudget').textContent = '-';
  }
}

function renderPlans() {
  const root = $('#plans');
  root.innerHTML = '';
  if (!state.plans.length) {
    root.appendChild(el('div', {class:'muted'}, '予定はまだありません。右上から追加してください。'));
  }
  state.plans.forEach((p, idx) => {
    const row = el('div', {class:'plan'}, [
      el('input', {type:'date', value:p.date || '', oninput:e=>{p.date=e.target.value; save();}}),
      el('input', {type:'text', placeholder:'タイトル（例: 伏見稲荷）', value:p.title || '', oninput:e=>{p.title=e.target.value; save();}}),
      el('input', {type:'text', placeholder:'時間（例: 10:00）', value:p.time || '', oninput:e=>{p.time=e.target.value; save();}}),
      el('input', {type:'text', placeholder:'場所/集合（例: 稲荷駅）', value:p.place || '', oninput:e=>{p.place=e.target.value; save();}}),
      el('button', {class:'btn btn-danger', onclick:()=>{ state.plans.splice(idx,1); renderPlans(); save(); }}, '削除')
    ]);
    root.appendChild(row);
  });
}

function renderPack() {
  const root = $('#packList');
  root.innerHTML = '';
  if (!state.pack.length) {
    root.appendChild(el('div', {class:'muted'}, '持ち物はまだありません。上の入力から追加してください。'));
  }
  state.pack.forEach((it, idx) => {
    const row = el('div', {class:'item item-row'}, [
      el('label', {}, [
        el('input', {type:'checkbox', checked: it.done ? 'checked': null, onchange:(e)=>{ it.done = e.target.checked; save(); }}),
        el('span', {}, it.name)
      ]),
      el('button', {class:'btn btn-danger', onclick:()=>{ state.pack.splice(idx,1); renderPack(); save(); }}, '削除')
    ]);
    root.appendChild(row);
  });
}

function renderExpenses() {
  const root = $('#expenses');
  root.innerHTML = '';
  if (!state.expenses.length) {
    root.appendChild(el('div', {class:'muted'}, '支出はまだありません。上の入力から追加してください。'));
  }
  state.expenses.forEach((ex, idx) => {
    const row = el('div', {class:'expense'}, [
      el('input', {type:'text', value: ex.name || '', placeholder:'項目', oninput:e=>{ex.name=e.target.value; save();}}),
      el('input', {type:'text', value: ex.cat || '', placeholder:'カテゴリ', oninput:e=>{ex.cat=e.target.value; save();}}),
      el('input', {type:'number', min:'0', step:'100', value: ex.amt || '', placeholder:'金額', oninput:e=>{ex.amt=Number(e.target.value||0); save();}}),
      el('button', {class:'btn btn-danger', onclick:()=>{ state.expenses.splice(idx,1); renderExpenses(); save(); }}, '削除')
    ]);
    root.appendChild(row);
  });
}

function wireControls() {
  $('#addPlan').addEventListener('click', () => {
    state.plans.push({ date: state.info.startDate || '', title:'', time:'', place:'' });
    renderPlans();
    save();
  });

  $('#addItem').addEventListener('click', () => {
    const v = $('#newItem').value.trim();
    if (!v) return;
    state.pack.push({ id: uid(), name: v, done: false });
    $('#newItem').value = '';
    renderPack();
    save();
  });

  $('#addExp').addEventListener('click', () => {
    const name = $('#expName').value.trim();
    const cat = $('#expCat').value.trim();
    const amt = Number($('#expAmt').value || 0);
    if (!name && !cat && !amt) return;
    state.expenses.push({ id: uid(), name, cat, amt });
    $('#expName').value = ''; $('#expCat').value = ''; $('#expAmt').value = '';
    renderExpenses();
    save();
  });

  $('#notes').addEventListener('input', (e) => { state.notes = e.target.value; save(); });

  $('#exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = el('a', {href:url, download:`trip-${Date.now()}.json`});
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });

  $('#importFile').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result||'{}'));
        if (!data || typeof data !== 'object') throw new Error('invalid');
        state = Object.assign(state, data);
        hydrateAll();
        save();
      } catch {
        alert('読み込みに失敗しました。JSONファイルを確認してください。');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  });

  $('#clearBtn').addEventListener('click', () => {
    if (!confirm('本当に全データを削除しますか？')) return;
    localStorage.removeItem(STORAGE_KEY);
    state = { info:{dest:'',startDate:'',endDate:'',budgetCap:''}, plans:[], pack:[], expenses:[], notes:'' };
    hydrateAll();
    save();
  });
}

function hydrateAll() {
  bindInfo();
  renderPlans();
  renderPack();
  renderExpenses();
  $('#notes').value = state.notes || '';
}

function main() {
  load();
  hydrateAll();
  wireControls();
  // 初期保存表示
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) $('#savedAt').textContent = `保存: ${new Date().toLocaleString()}`;
}

document.addEventListener('DOMContentLoaded', main);
