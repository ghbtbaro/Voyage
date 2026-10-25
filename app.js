'use strict';
// Suivi des dépenses du voyage — PWA hors-ligne. Logique portée de la maquette v3.
const KEY = 'tripx.v1';
const DAY = 864e5;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const UNITLESS = { flex: 1, opacity: 1, fontWeight: 1, zIndex: 1, lineHeight: 1 };
const st = o => Object.keys(o).map(k => k.replace(/[A-Z]/g, m => '-' + m.toLowerCase()) + ':' + (typeof o[k] === 'number' && !UNITLESS[k] ? o[k] + 'px' : o[k])).join(';');

const todayUTC = () => { const n = new Date(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()); };

function seed() {
  const E = []; let id = 1;
  [['Vols Paris–Tokyo, retour Mexico', 'flights', 2180, 1, 'both'], ['Assurance voyage 5 mois', 'insurance', 780, 0, 'both'], ['Sacs & vêtements', 'gear', 640, 1, 'both'], ['Vaccins & santé', 'health', 210, 0, 'both'], ['Visa Vietnam', 'health', 150, 1, 'both'], ['Appareil photo', 'gear', 420, 1, 'you']]
    .forEach(p => E.push({ id: id++, ph: 'pre', l: p[0], c: p[1], a: p[2], py: p[3], f: p[4], day: 0, n: 1 }));
  const sh = { food: .27, stay: .36, transport: .2, act: .12, other: .05 };
  [[1, 30, 4380], [31, 28, 2540], [59, 11, 1650]].forEach(([d, n, t]) => { for (const c in sh) E.push({ id: id++, ph: 'trip', auto: 1, l: '', c, a: Math.round(t * sh[c]), py: .55, f: 'both', day: d, n }); });
  [[74, "Plein d'essence", 'transport', 24.4, 1, 'both', 1], [74, 'Déjeuner au café', 'food', 13.6, 0, 'both', 1], [73, 'Excursion à Milford Sound', 'act', 116.5, 0, 'both', 1], [73, 'Camping', 'stay', 49.4, 1, 'you', 1], [72, 'Courses', 'food', 64, 0, 'both', 1], [71, 'Trek Routeburn', 'act', 300, 1, 'both', 5], [70, 'Location du van', 'stay', 350, 1, 'both', 7]]
    .forEach(t => E.push({ id: id++, ph: 'trip', l: t[1], c: t[2], a: t[3], py: t[4], f: t[5], day: t[0], n: t[6] }));
  return E;
}

const DEFAULTS = () => ({
  tab: 'home', bview: 'trip', calMonth: 0, sel: 0, nameA: 'Alex', nameB: 'Sam', startISO: '2026-08-12', preBudget: 5000,
  legs: [{ n: 'Japon', d: 30, b: 140, c: 'JPY', r: 0.0061 }, { n: 'Vietnam', d: 28, b: 100, c: 'VND', r: 0.000037 }, { n: 'Nouvelle-Zélande', d: 32, b: 160, c: 'NZD', r: 0.555 }, { n: 'Pérou', d: 32, b: 115, c: 'PEN', r: 0.25 }, { n: 'Mexique', d: 30, b: 140, c: 'MXN', r: 0.049 }],
  tripCats: [{ k: 'food', l: 'Repas' }, { k: 'stay', l: 'Logement' }, { k: 'transport', l: 'Transport' }, { k: 'act', l: 'Activités' }, { k: 'other', l: 'Autre' }],
  preCats: [{ k: 'flights', l: 'Vols' }, { k: 'insurance', l: 'Assurance' }, { k: 'gear', l: 'Équipement' }, { k: 'health', l: 'Santé & visas' }, { k: 'other', l: 'Autre' }],
  newTrip: '', newPre: '', exps: seed(),
  phase: 'trip', amount: '', cur: 'LOC', cat: 'food', paidBy: 'you', forWhom: 'both', addDay: null, editId: null, hf: 'all', spread: false, spreadN: 5, note: '', saved: false,
});

let S;
try { S = Object.assign(DEFAULTS(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { S = DEFAULTS(); }
S.saved = false;
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

const P = { mint: { bg: 'oklch(0.94 0.06 165)', fg: 'oklch(0.36 0.08 165)', bar: 'oklch(0.78 0.13 165)' }, amber: { bg: 'oklch(0.95 0.08 90)', fg: 'oklch(0.4 0.09 70)', bar: 'oklch(0.83 0.14 85)' }, coral: { bg: 'oklch(0.93 0.06 25)', fg: 'oklch(0.42 0.14 25)', bar: 'oklch(0.72 0.15 25)' }, sky: { bg: 'oklch(0.94 0.04 240)', fg: 'oklch(0.4 0.1 245)', bar: 'oklch(0.78 0.1 240)' }, lav: { bg: 'oklch(0.94 0.05 290)', fg: 'oklch(0.4 0.12 290)', bar: 'oklch(0.75 0.11 290)' }, grey: { bg: 'oklch(0.95 0.01 270)', fg: 'oklch(0.4 0.02 270)', bar: 'oklch(0.85 0.02 270)' } };
const pill = k => st({ background: P[k].bg, color: P[k].fg });
const TONE = p => p > 100 ? 'coral' : p >= 80 ? 'amber' : 'mint';
const LC = i => 'oklch(0.88 0.08 ' + [25, 85, 160, 240, 300][i % 5] + ')';
const MS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MF = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const f0 = n => Math.round(n).toLocaleString('fr-FR') + ' €';
const f2 = n => (Math.round(n * 100) / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' €';
const IC = { food: 'M6 2v8M9 2v8M12 2v8M9 10v12', stay: 'M2 12h20v8H2zM2 16h20M6 12V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4', transport: 'M3 10h18v7H3zM5 10l2-5h10l2 5M7 17v2M17 17v2', act: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M14.5 9.5L10 10l-.5 4.5L14 14z', other: 'M6 8h12l-1 12H7zM9 8V6a3 3 0 0 1 6 0v2', flights: 'M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z', insurance: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', gear: 'M3 7l4-4h10l4 4-3 3-2-1v12H8V9l-2 1z', health: 'M12 5v14M5 12h14' };
const TAG = 'M20 12l-8 8-9-9V3h8z';
const svg = (d, sz = 16, col = 'var(--a700)', sw = 1.5) => `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" style="flex:none"><path d="${d}"/></svg>`;
const seg = (opts, cur, act, cls = '') => `<div class="seg ${cls}">${opts.map(([v, l]) => `<button type="button" class="${cur === v ? 'on' : ''}" data-a="${act}" data-v="${esc(v)}">${l}</button>`).join('')}</div>`;
const bar = (p, c) => `<div style="${st({ position: 'absolute', top: 0, bottom: 0, left: 0, width: Math.min(100, p) + '%', background: c || 'var(--a600)', borderRadius: 99 })}"></div>`;
const barFlow = (p, c) => st({ height: '100%', width: Math.min(100, p) + '%', background: c || 'var(--a600)', borderRadius: 99 });
const num = v => parseInt(String(v).replace(/\D/g, ''), 10) || 0;

function calc() {
  const s = S, exps = s.exps || [];
  const START = Date.parse(s.startISO) || Date.UTC(2026, 7, 12);
  const today = Math.floor((todayUTC() - START) / DAY) + 1;
  const A = s.nameA || 'Premier', B = s.nameB || 'Second';
  const dObj = d => new Date(START + (d - 1) * DAY);
  const dt = d => { const x = dObj(d); return x.getUTCDate() + ' ' + MS[x.getUTCMonth()]; };
  let t0 = 1; const L = s.legs.map((l, i) => { const o = { ...l, i, s: t0, e: t0 + l.d - 1, tot: l.d * l.b }; t0 += l.d; return o; });
  const tot = L.reduce((a, l) => a + l.d, 0);
  const cur = (() => { const i = L.findIndex(l => today >= l.s && today <= l.e); return i >= 0 ? i : today > L[L.length - 1].e ? L.length - 1 : 0; })();
  const cl = L[cur];
  const trip = exps.filter(e => e.ph === 'trip'), pre = exps.filter(e => e.ph === 'pre');
  const sum = a => a.reduce((x, e) => x + e.a, 0);
  const preSpent = sum(pre), tripSpent = sum(trip), PRE_B = s.preBudget;
  const tripBudget = L.reduce((a, l) => a + l.tot, 0), totBudget = PRE_B + tripBudget;
  const D = {}; trip.forEach(e => { for (let k = 0; k < e.n; k++) D[e.day + k] = (D[e.day + k] || 0) + e.a / e.n; });
  const legSpent = l => { let t = 0; for (let d = l.s; d <= l.e; d++) t += D[d] || 0; return t; };
  const CL = { food: 'Repas', stay: 'Logement', transport: 'Transport', act: 'Activités', other: 'Autre', flights: 'Vols', insurance: 'Assurance', gear: 'Équipement', health: 'Santé & visas' };
  [...s.tripCats, ...s.preCats].forEach(c => { CL[c.k] = c.l; if (!IC[c.k]) IC[c.k] = TAG; });
  let yS = 0, yP = 0, all = 0;
  exps.forEach(e => { yS += e.a * (e.f === 'you' ? 1 : e.f === 'both' ? .5 : 0); yP += e.a * e.py; all += e.a; });
  return { s, exps, START, today, A, B, dObj, dt, L, tot, cur, cl, trip, pre, preSpent, tripSpent, PRE_B, tripBudget, totBudget, D, legSpent, CL, yS, yP, all, bal: yP - yS, sum };
}

const vHome = V => {
  const { s, A, B, L, cl, D, today, dObj, preSpent, tripSpent, PRE_B, tripBudget, totBudget, legSpent, yS, yP, all, bal, trip, CL } = V;
  const dayBud = cl.b, daySp = D[today] || 0;
  let cumB = 0, cumS = 0; L.forEach(l => { cumB += Math.max(0, Math.min(l.d, today - l.s + 1)) * l.b; });
  for (let d = 1; d <= today; d++) cumS += D[d] || 0;
  const margin = cumB - cumS;
  const dp = daySp / dayBud, lp = legSpent(cl) / cl.tot, tp = (preSpent + tripSpent) / totBudget, pp = preSpent / PRE_B;
  const alerts = [];
  const mk = (k, icon, title, text) => alerts.push({ k, icon, title, text });
  const W = 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', OK = 'M20 6L9 17l-5-5', I = 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 8v4M12 16h.01';
  if (dp > 1) mk('coral', I, 'Budget du jour dépassé', 'Vous avez dépassé de ' + f0(daySp - dayBud) + " aujourd'hui. Pensez à lisser les grosses dépenses.");
  else if (dp >= .8) mk('amber', W, 'Plus que ' + f0(dayBud - daySp) + " pour aujourd'hui", 'Vous avez utilisé ' + Math.round(dp * 100) + ' % du budget du jour.');
  if (lp > 1) mk('coral', I, cl.n + " : budget d'étape dépassé", f0(legSpent(cl) - cl.tot) + " au-dessus du budget de l'étape.");
  else if (lp >= .8) mk('amber', W, cl.n + ' : ' + Math.round(lp * 100) + ' % du budget utilisé', 'Il reste ' + f0(cl.tot - legSpent(cl)) + ' pour ' + Math.max(0, cl.e - today) + ' jours.');
  if (pp > 1) mk('coral', I, 'Avant-voyage : budget dépassé', f0(preSpent - PRE_B) + ' de plus que prévu.');
  if (tp > 1) mk('coral', I, 'Budget total dépassé', f0(preSpent + tripSpent - totBudget) + ' au-dessus du budget global.');
  else if (tp >= .9) mk('amber', W, 'Budget global bientôt atteint', Math.round(tp * 100) + ' % déjà dépensés.');
  if (margin < 0) mk('amber', W, 'En retard sur le rythme', f0(-margin) + ' de plus que prévu depuis le départ.');
  if (alerts.length < 2 && margin >= 0) mk('mint', OK, 'Tout est sous contrôle', 'Vous avez ' + f0(margin) + " d'avance sur le budget depuis le départ.");
  const d0 = Math.max(1, today - 6), days = []; for (let d = d0; d < d0 + 10; d++) days.push(d);
  const maxV = Math.max(dayBud * 1.4, ...days.map(d => D[d] || 0));
  const bars = days.map(d => ({
    style: st({ width: '100%', height: ((D[d] || 0) / maxV * 100) + '%', borderRadius: '8px 8px 3px 3px', background: (D[d] || 0) > dayBud ? (d > today ? 'oklch(0.85 0.09 25)' : P.coral.bar) : d === today ? 'var(--a700)' : d > today ? 'var(--a200)' : 'var(--a400)' }),
    lbl: st({ flex: 1, textAlign: 'center', fontSize: 10, color: d === today ? 'var(--text)' : 'var(--muted)', fontWeight: d === today ? 700 : 400 }), label: dObj(d).getUTCDate(),
  }));
  const ring = (preSpent + tripSpent) / totBudget;
  const ago = d => d === 0 ? 'Avant le voyage' : today - d === 0 ? "Aujourd'hui" : today - d === 1 ? 'Hier' : today - d < 0 ? 'Dans ' + (d - today) + ' j' : 'Il y a ' + (today - d) + ' j';
  const recent = V.exps.filter(e => !e.auto).sort((a, b) => (b.day - a.day) || (b.id - a.id)).slice(0, 6);
  return `<div class="col">
  <div class="row sp" style="align-items:flex-start"><div><div class="h1">Notre voyage</div><div class="meta" style="margin-top:2px">${esc(L.map(l => l.n.replace('Nouvelle-Zélande', 'N.-Zélande')).join(' → '))}</div></div>
    <span class="tag" style="${st({ flex: 'none', background: 'oklch(0.94 0.04 240)', color: 'oklch(0.4 0.1 245)' })}">Jour&nbsp;${today}/${V.tot}</span></div>
  <div style="display:flex;flex-direction:column;gap:8px">${alerts.slice(0, 3).map(a => `<div class="row" style="${st({ gap: 12, padding: '12px 14px', borderRadius: 20, background: P[a.k].bg, color: P[a.k].fg })}"><div style="flex:none;width:36px;height:36px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center">${svg(a.icon, 20, P[a.k].fg, 2)}</div><div style="min-width:0"><div style="font-size:14px;font-weight:800">${esc(a.title)}</div><div style="font-size:12px;line-height:1.35">${esc(a.text)}</div></div></div>`).join('')}</div>
  <div class="card" style="border-radius:26px;background:linear-gradient(135deg,oklch(0.94 0.045 290),oklch(0.94 0.045 225));box-shadow:0 12px 30px -14px oklch(0.45 0.12 270/.5)">
    <div class="row sp" style="margin-bottom:6px"><div><div class="kick">Total dépensé · avant + pendant</div><div style="font-size:32px;font-weight:800;line-height:1.15;margin-top:2px">${f0(preSpent + tripSpent)}</div><div style="font-size:13px;color:var(--muted)">sur&nbsp;${f0(totBudget)}</div></div>
      <svg width="88" height="88" viewBox="0 0 88 88" style="flex:none"><circle cx="44" cy="44" r="35" fill="none" stroke="#fff" stroke-width="10"/><circle cx="44" cy="44" r="35" fill="none" stroke="${P[TONE(ring * 100)].bar}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${Math.min(1, ring) * 219.9} 219.9" transform="rotate(-90 44 44)"/><text x="44" y="50" text-anchor="middle" font-size="17" font-weight="800" fill="#2b2b45">${Math.round(ring * 100)} %</text></svg></div>
    <div style="height:8px;display:flex;background:oklch(0.94 0.015 270);border-radius:99px;overflow:hidden"><div style="${st({ width: preSpent / totBudget * 100 + '%', background: 'var(--a900)' })}"></div><div style="${st({ width: tripSpent / totBudget * 100 + '%', background: 'var(--a500)' })}"></div></div>
    <div class="meta" style="display:flex;gap:14px;margin-top:4px"><span><i style="display:inline-block;width:8px;height:8px;background:var(--a900);margin-right:5px"></i>Avant</span><span><i style="display:inline-block;width:8px;height:8px;background:var(--a500);margin-right:5px"></i>Pendant</span></div></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    ${[['Avant le voyage', preSpent, PRE_B, 'pre'], ['Pendant le voyage', tripSpent, tripBudget, 'trip']].map(([k, sp, b, v]) => `<div class="card click" data-a="openBudget" data-v="${v}" style="border-radius:24px;padding:12px"><div class="kick">${k}</div><div style="font-size:22px;font-weight:700;margin-top:2px">${f0(sp)}</div><div class="meta">sur&nbsp;${f0(b)}</div><div class="track" style="height:5px;margin-top:8px"><div style="${barFlow(sp / b * 100, P[TONE(sp / b * 100)].bar)}"></div></div></div>`).join('')}</div>
  <div class="card"><div class="row sp"><div class="kick">Budget du jour · ${esc(cl.n)}</div><span class="tag" style="${pill(daySp > dayBud ? 'coral' : daySp >= .8 * dayBud ? 'amber' : 'mint')}">${daySp > dayBud ? 'Dépassé' : daySp >= .8 * dayBud ? 'Presque atteint' : 'Dans le budget'}</span></div>
    <div style="display:flex;align-items:baseline;gap:8px;margin:2px 0 12px"><span style="font-size:26px;font-weight:700">${f0(daySp)}</span><span style="font-size:13px;color:var(--muted)">sur&nbsp;${f0(dayBud)} / jour</span></div>
    <div style="position:relative;height:84px;display:flex;align-items:flex-end;gap:5px"><div style="${st({ position: 'absolute', left: 0, right: 0, bottom: dayBud / maxV * 100 + '%', borderTop: '1px dashed var(--a900)', zIndex: 1, pointerEvents: 'none' })}"><span style="position:absolute;right:0;top:-13px;font-size:9px;color:var(--a900)">budget</span></div>${bars.map(b => `<div style="flex:1;height:100%;display:flex;align-items:flex-end"><div style="${b.style}"></div></div>`).join('')}</div>
    <div style="display:flex;gap:5px;margin-top:4px">${bars.map(b => `<div style="${b.lbl}">${b.label}</div>`).join('')}</div>
    <div class="meta" style="margin-top:10px">Marge cumulée depuis le départ : <strong style="color:var(--text)">${(margin >= 0 ? '+' : '−') + f0(Math.abs(margin))}</strong></div></div>
  <div class="card"><div class="kick">Étape actuelle</div><div class="title" style="margin:3px 0 8px">${esc(cl.n)}&nbsp;· Jour&nbsp;${Math.max(1, today - cl.s + 1)}&nbsp;sur&nbsp;${cl.d}</div><div class="track">${bar((today - cl.s + 1) / cl.d * 100)}</div>
    <div class="meta" style="margin-top:8px">${f0(legSpent(cl))}&nbsp;dépensés sur&nbsp;${f0(cl.tot)}&nbsp;· reste&nbsp;${f0(Math.max(0, (cl.tot - legSpent(cl)) / Math.max(1, cl.e - today)))}/jour</div></div>
  <div class="card"><div class="kick">Qui a dépensé</div>
    <div style="height:10px;display:flex;margin:8px 0 4px;border:1px solid var(--divider);border-radius:99px;overflow:hidden"><div style="${st({ width: yS / Math.max(1, all) * 100 + '%', background: 'var(--a600)' })}"></div><div style="flex:1;background:var(--a300)"></div></div>
    <div class="row sp" style="font-size:12px"><span><i style="display:inline-block;width:8px;height:8px;background:var(--a600);margin-right:5px"></i>${esc(A)}&nbsp;· part de&nbsp;${f0(yS)}</span><span><i style="display:inline-block;width:8px;height:8px;background:var(--a300);margin-right:5px"></i>${esc(B)}&nbsp;· part de&nbsp;${f0(all - yS)}</span></div>
    <div class="meta" style="margin:4px 0 6px">Réellement payé : ${esc(A)} ${f0(yP)} · ${esc(B)} ${f0(all - yP)}</div>
    <span class="tag" style="align-self:flex-start;${pill('lav')}">${bal >= 0 ? esc(B) + ' doit ' + f0(bal) + ' à ' + esc(A) : esc(A) + ' doit ' + f0(-bal) + ' à ' + esc(B)}</span></div>
  <div><div class="kick" style="margin-bottom:4px">Récent</div>${recent.map(e => rowHtml(V, e, ago(e.day))).join('') || '<div class="meta" style="padding:10px 0">Aucune dépense pour le moment.</div>'}</div></div>`;
};

function rowHtml(V, e, agoText) {
  const { A, B, CL } = V;
  const who = (e.py >= 1 ? 'Payé par ' + A : e.py <= 0 ? 'Payé par ' + B : 'Payé à deux') + ' · ' + (e.f === 'both' ? 'Partagé' : e.f === 'you' ? 'Juste ' + A : 'Juste ' + B);
  return `<div class="item">${svg(IC[e.c] || IC.other)}<div style="flex:1;min-width:0"><div style="font-size:13px">${esc(e.l || CL[e.c] || 'Autre')}</div><div class="meta">${esc((agoText ? agoText + ' · ' : '') + who)}</div>${e.n > 1 ? `<span class="tag" style="margin-top:4px;${pill('lav')}">Lissé sur ${e.n} j · ${f2(e.a / e.n)}/j</span>` : ''}</div><div style="font-size:13px;flex:none" class="mono">${f2(e.a)}</div><button type="button" class="del" aria-label="Supprimer" data-a="delExp" data-v="${e.id}">&times;</button></div>`;
}

const vAdd = V => {
  const { s, A, B, L, cl, dt, tot, today } = V;
  const isTrip = s.phase === 'trip';
  const addDay = Math.min(tot, Math.max(1, s.addDay == null ? today : s.addDay));
  const cats = (isTrip ? s.tripCats : s.preCats);
  const amt = parseFloat(String(s.amount).replace(',', '.')) || 0;
  const al = L.find(l => addDay >= l.s && addDay <= l.e) || cl, loc = isTrip && s.cur === 'LOC';
  const eur = loc ? amt * al.r : amt, n = isTrip && s.spread ? s.spreadN : 1;
  const payer = s.paidBy === 'you' ? A : B, other = s.paidBy === 'you' ? B : A;
  const self = (s.forWhom === 'you' && s.paidBy === 'you') || (s.forWhom === 'partner' && s.paidBy === 'partner');
  const shareText = s.forWhom === 'both' ? payer + ' paie, partagé 50/50 — ' + other + ' doit la moitié.' : self ? payer + ' paie pour soi — pas de partage.' : payer + ' avance tout — ' + other + ' doit la totalité.';
  const stepper = (less, more, mid) => `<div class="row"><button type="button" class="btn btn-sec btn-icon" data-a="${less}">&minus;</button><div style="flex:1;text-align:center;font-size:18px;font-weight:700">${mid}</div><button type="button" class="btn btn-sec btn-icon" data-a="${more}">+</button></div>`;
  return `<div class="col" style="gap:16px"><div class="h1">${s.editId ? 'Modifier la dépense' : 'Ajouter une dépense'}</div>
  ${seg([['pre', 'Avant le voyage'], ['trip', 'Pendant le voyage']], s.phase, 'setPhase')}
  <div><label class="lbl" style="margin-bottom:5px">Montant</label><div class="row" style="gap:8px"><input class="input" type="text" inputmode="decimal" placeholder="0,00" value="${esc(s.amount)}" data-c="amount" style="flex:1;min-width:0;font-size:20px;font-weight:700">
    ${isTrip ? seg([['LOC', esc(al.c)], ['EUR', 'EUR']], s.cur, 'setCur', 'fit') : ''}</div>
    <div class="meta" style="font-size:12px;margin-top:6px">${loc ? '≈ ' + f2(eur) + ' · 1 ' + esc(al.c) + ' = ' + String(al.r).replace('.', ',') + ' € (taux modifiable dans Plan)' : 'Montant en euros'}</div></div>
  <div><label class="lbl">Catégorie</label><div class="catgrid">${cats.map(c => `<button type="button" class="cat ${s.cat === c.k ? 'on' : ''}" data-a="setCat" data-v="${esc(c.k)}">${svg(IC[c.k] || TAG, 18, 'currentColor')}<span>${esc(c.l)}</span></button>`).join('')}</div></div>
  ${isTrip ? `<div class="col" style="gap:16px"><div><label class="lbl">Date de la dépense (touchez pour ouvrir le calendrier)</label><input class="input" type="date" value="${V.dObj(addDay).toISOString().slice(0, 10)}" data-c="addDate" style="height:48px;font-size:16px;font-weight:700"><div class="meta" style="font-size:12px;margin-top:6px">${dt(addDay)} · Jour ${addDay}${(L.find(l => addDay >= l.s && addDay <= l.e) || {}).n ? ' · ' + esc(L.find(l => addDay >= l.s && addDay <= l.e).n) : ''}</div></div>
    <div class="card" style="border-radius:24px;padding:12px;gap:0"><label class="lbl">Imputation sur le budget</label>${seg([['off', 'Un seul jour'], ['on', 'Lisser sur plusieurs jours']], s.spread ? 'on' : 'off', 'setSpread')}
    ${s.spread ? `<div style="margin-top:12px">${stepper('spreadLess', 'spreadMore', s.spreadN + '&nbsp;jours')}<div style="font-size:12px;margin-top:10px;line-height:1.45"><strong>${f2(eur / n)}</strong> par jour, du&nbsp;${dt(addDay)}&nbsp;au&nbsp;${dt(addDay + s.spreadN - 1)}.</div><div class="meta" style="margin-top:2px">Le budget du jour est impacté de&nbsp;${f2(eur / n)}&nbsp;au lieu de&nbsp;${f2(eur)}.</div></div>` : ''}</div></div>` : ''}
  <div><label class="lbl">Payé par</label>${seg([['you', esc(A)], ['partner', esc(B)]], s.paidBy, 'setPaid')}</div>
  <div><label class="lbl">Pour</label>${seg([['you', esc(A)], ['partner', esc(B)], ['both', 'Les deux']], s.forWhom, 'setFor')}<div class="meta" style="margin-top:6px">${esc(shareText)}</div></div>
  <div class="field"><label>Note (facultatif)</label><input class="input" type="text" placeholder="ex. Trek de 5 jours" value="${esc(s.note)}" data-c="note"></div>
  <button type="button" class="btn btn-primary" data-a="save">${s.saved ? 'Enregistré ✓' : amt > 0 ? (s.editId ? 'Enregistrer les modifications' : 'Enregistrer') : 'Saisissez un montant'}</button>${s.editId ? '<button type="button" class="btn btn-sec" style="height:44px" data-a="cancelEdit">Annuler la modification</button>' : ''}</div>`;
};

const vHistory = V => {
  const { s, L, exps, dt, CL, sum } = V;
  const legOf = d => L.find(l => d >= l.s && d <= l.e);
  const hist = exps.filter(e => s.hf === 'all' || (s.hf === 'pre' ? e.ph === 'pre' : e.ph === 'trip' && (legOf(e.day) || {}).i === s.hf)).sort((a, b) => (b.ph === 'pre' ? -1 : b.day) - (a.ph === 'pre' ? -1 : a.day) || b.id - a.id);
  const chip = (k, name) => `<button type="button" data-a="histFilter" data-v="${k}" style="${st({ padding: '8px 12px', minHeight: 36, borderRadius: 999, fontSize: 12, cursor: 'pointer', border: 'none', fontWeight: s.hf === k ? 800 : 600, background: s.hf === k ? 'var(--a700)' : '#fff', color: s.hf === k ? '#fff' : 'var(--text)' })}">${esc(name)}</button>`;
  const title = s.hf === 'all' ? 'Toutes les dépenses' : s.hf === 'pre' ? 'Avant le voyage' : (L[s.hf] || {}).n;
  const who = e => (e.py >= 1 ? 'Payé par ' + V.A : e.py <= 0 ? 'Payé par ' + V.B : 'Payé à deux') + ' · ' + (e.f === 'both' ? 'Partagé' : e.f === 'you' ? 'Juste ' + V.A : 'Juste ' + V.B);
  return `<div class="col"><div><div class="h1" style="font-weight:800">Historique</div><div class="meta">Touchez une dépense pour la corriger.</div></div>
  <div style="display:flex;flex-wrap:wrap;gap:6px">${chip('all', 'Tout')}${chip('pre', 'Avant le voyage')}${L.map(l => chip(l.i, l.n)).join('')}</div>
  <div class="card" style="padding:12px 14px;border-radius:22px;gap:0"><div class="row sp" style="align-items:baseline"><span class="kick">${esc(title)}</span><span style="font-size:18px;font-weight:800">${f0(sum(hist))}</span></div><div class="meta">${hist.length} dépense${hist.length > 1 ? 's' : ''}</div></div>
  <div>${hist.map(e => `<div data-a="editExp" data-v="${e.id}" style="display:flex;align-items:center;gap:10px;padding:10px 4px;border-bottom:1px solid var(--divider);cursor:pointer"><div style="flex:none;width:34px;height:34px;border-radius:50%;background:var(--a100);display:flex;align-items:center;justify-content:center">${svg(IC[e.c] || IC.other, 16, 'var(--a700)', 1.8)}</div><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700">${esc(e.l || CL[e.c] || 'Autre')}</div><div class="meta">${esc(e.ph === 'pre' ? 'Avant le voyage' : dt(e.day) + ' · ' + ((legOf(e.day) || {}).n || '') + (e.auto ? " · cumul de l'étape" : ''))}</div><div class="meta">${esc(who(e))}</div>${e.n > 1 ? `<span class="tag" style="margin-top:4px;${pill('lav')}">Lissé sur ${e.n} j · ${f2(e.a / e.n)}/j</span>` : ''}</div><div class="mono" style="font-size:13px;font-weight:700;flex:none">${f2(e.a)}</div><button type="button" class="del" aria-label="Supprimer" data-a="delExp" data-v="${e.id}">&times;</button></div>`).join('')}</div></div>`;
};

const vBudget = V => {
  const { s, A, B, L, cur, tot, pre, trip, preSpent, tripSpent, PRE_B, tripBudget, legSpent, CL, exps } = V;
  const part = (w, list) => list.reduce((x, e) => x + e.a * (e.f === w ? 1 : e.f === 'both' ? .5 : 0), 0);
  const people = `<div class="card" style="padding:12px 14px"><div class="kick" style="margin-bottom:8px">Part dépensée par personne</div><div style="display:grid;grid-template-columns:1.2fr 1fr 1fr 1fr;gap:4px 6px;align-items:baseline">
    <div></div>${['Avant', 'Pendant', 'Total'].map(h => `<div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);text-align:right">${h}</div>`).join('')}
    ${[['you', A], ['partner', B]].map(([w, nm]) => `<div style="font-size:13px;font-weight:700;padding-top:6px;overflow:hidden;text-overflow:ellipsis">${esc(nm)}</div><div class="mono" style="font-size:12px;text-align:right;padding-top:6px">${f0(part(w, pre))}</div><div class="mono" style="font-size:12px;text-align:right;padding-top:6px">${f0(part(w, trip))}</div><div class="mono" style="font-size:16px;font-weight:700;text-align:right;padding-top:4px">${f0(part(w, exps))}</div>`).join('')}</div></div>`;
  let body;
  if (s.bview === 'pre') {
    body = `<div class="card"><div class="kick">Préparation du voyage</div><div style="display:flex;align-items:baseline;gap:8px;margin:2px 0 8px"><span style="font-size:28px;font-weight:700">${f0(preSpent)}</span><span style="font-size:13px;color:var(--muted)">sur&nbsp;${f0(PRE_B)}</span></div><div class="track"><div style="${barFlow(preSpent / PRE_B * 100, P[TONE(preSpent / PRE_B * 100)].bar)}"></div></div><div class="meta" style="margin-top:8px">Reste&nbsp;${f0(PRE_B - preSpent)}&nbsp;·&nbsp;${pre.length}&nbsp;dépenses</div></div>
    <div>${pre.slice().reverse().map(e => rowHtml(V, e, '')).join('')}</div>`;
  } else {
    const tc = {}; trip.forEach(e => tc[e.c] = (tc[e.c] || 0) + e.a);
    const tcMax = Math.max(1, ...Object.values(tc));
    body = `<div class="card"><div class="kick">Pendant le voyage · ${tot}&nbsp;jours</div><div style="display:flex;align-items:baseline;gap:8px;margin:2px 0 8px"><span style="font-size:28px;font-weight:700">${f0(tripSpent)}</span><span style="font-size:13px;color:var(--muted)">sur&nbsp;${f0(tripBudget)}</span></div><div class="track"><div style="${barFlow(tripSpent / tripBudget * 100, P[TONE(tripSpent / tripBudget * 100)].bar)}"></div></div><div class="meta" style="margin-top:8px">Budget journalier moyen&nbsp;${f0(tripBudget / tot)}</div></div>
    <div style="display:flex;flex-direction:column;gap:9px"><div class="kick">Par étape</div>${L.map(l => {
      const sp = legSpent(l), stt = l.i < cur ? 'done' : l.i === cur ? 'cur' : 'next', over = sp > l.tot;
      const tk = over ? 'coral' : stt === 'next' ? 'grey' : stt === 'cur' ? (sp / l.tot >= .8 ? 'amber' : 'sky') : 'mint';
      const tag = stt === 'cur' ? 'En cours' : stt === 'next' ? 'À venir' : over ? '+' + f0(sp - l.tot) + ' de dépassement' : f0(l.tot - sp) + ' sous budget';
      return `<div class="card" style="border-radius:20px;padding:12px 14px;opacity:${stt === 'next' ? .65 : 1}"><div class="row sp" style="gap:6px"><span class="title" style="font-size:15px">${esc(l.n)}</span><span class="tag" style="${pill(tk)}">${tag}</span></div><div class="track" style="height:6px;margin-top:6px"><div style="${barFlow(sp / l.tot * 100, P[TONE(sp / l.tot * 100)].bar)}"></div></div><div class="meta" style="margin-top:6px">${f0(sp)} sur ${f0(l.tot)} · jour ${l.s}–${l.e} · ${f0(l.b)}/j</div></div>`;
    }).join('')}</div>
    <div style="display:flex;flex-direction:column;gap:9px"><div class="kick">Par catégorie</div>${s.tripCats.map(c => `<div class="row"><span>${svg(IC[c.k] || TAG)}</span><span style="font-size:12px;width:70px;flex:none">${esc(c.l)}</span><div class="track" style="flex:1;height:5px">${bar((tc[c.k] || 0) / tcMax * 100)}</div><span class="meta" style="width:92px;text-align:right;flex:none">${f0(tc[c.k] || 0)}&nbsp;·&nbsp;${Math.round((tc[c.k] || 0) / Math.max(1, tripSpent) * 100)} %</span></div>`).join('')}</div>`;
  }
  return `<div class="col" style="gap:16px"><div class="h1">Budget</div>${seg([['pre', 'Avant'], ['trip', 'Pendant']], s.bview, 'openBudget')}${people}${body}</div>`;
};

const vPlan = V => {
  const { s, L, cur, tot, dt, dObj, START, today } = V;
  const sl = L[Math.min(s.sel, L.length - 1)];
  const base = dObj(1), mBase = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + s.calMonth, 1));
  const first = (mBase.getUTCDay() + 6) % 7, dim = new Date(Date.UTC(mBase.getUTCFullYear(), mBase.getUTCMonth() + 1, 0)).getUTCDate();
  let cells = ''; for (let i = 0; i < first; i++) cells += '<div style="height:38px"></div>';
  for (let dd = 1; dd <= dim; dd++) {
    const idx = Math.round((Date.UTC(mBase.getUTCFullYear(), mBase.getUTCMonth(), dd) - START) / DAY) + 1;
    const leg = L.find(l => idx >= l.s && idx <= l.e), isSel = leg && leg.i === s.sel, can = idx >= sl.s;
    cells += `<div data-a="pickDay" data-v="${idx}" style="${st({ height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, userSelect: 'none', cursor: can ? 'pointer' : 'default', borderRadius: 12, background: leg ? LC(leg.i) : 'transparent', color: leg ? 'var(--text)' : 'var(--muted)', opacity: leg && !isSel ? .5 : 1, fontWeight: isSel ? 700 : 400, outline: idx === today ? '2px solid var(--a900)' : (leg && idx === leg.e && isSel ? '2px solid var(--a900)' : 'none'), outlineOffset: -2 })}">${dd}</div>`;
  }
  const stepper = (less, more, mid, wmid) => `<div class="row" style="gap:8px"><button type="button" class="btn btn-sec btn-icon" data-a="${less}">&minus;</button>${mid}<button type="button" class="btn btn-sec btn-icon" data-a="${more}">+</button></div>`;
  return `<div class="col"><div><div class="h1">Plan du voyage</div><div class="meta">Départ&nbsp;${dt(1)}&nbsp;· retour&nbsp;${dt(tot)} ${dObj(tot).getUTCFullYear()}&nbsp;·&nbsp;${tot}&nbsp;jours</div></div>
  <div style="display:flex;flex-wrap:wrap;gap:6px">${L.map(l => `<button type="button" class="chip ${l.i === s.sel ? 'on' : ''}" data-a="selLeg" data-v="${l.i}"><span style="width:12px;height:12px;flex:none;border-radius:50%;background:${LC(l.i)}"></span>${esc(l.n)}</button>`).join('')}</div>
  <div class="card" style="padding:12px"><div class="row sp" style="margin-bottom:8px"><button type="button" class="btn btn-ghost btn-icon" data-a="monthPrev">&lsaquo;</button><div style="font-size:17px;font-weight:700;text-transform:capitalize">${MF[mBase.getUTCMonth()]} ${mBase.getUTCFullYear()}</div><button type="button" class="btn btn-ghost btn-icon" data-a="monthNext">&rsaquo;</button></div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:3px">${'LMMJVSD'.split('').map(c => `<div style="text-align:center;font-size:10px;color:var(--muted)">${c}</div>`).join('')}</div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px">${cells}</div>
    <div class="meta" style="margin-top:10px">Touchez une date pour fixer le dernier jour de « ${esc(sl.n)} ». Les étapes suivantes se décalent.</div></div>
  <div class="card"><div class="row sp"><div class="title" style="flex:1">Étape</div><span class="tag" style="${pill(sl.i < cur ? 'grey' : sl.i === cur ? 'sky' : 'lav')}">${sl.i < cur ? 'Terminé' : sl.i === cur ? 'En cours' : 'À venir'}</span></div>
    <div class="meta" style="font-size:12px;margin:2px 0 12px">Du&nbsp;${dt(sl.s)}&nbsp;au&nbsp;${dt(sl.e)}</div>
    <div class="field" style="margin-bottom:12px"><label>Pays / nom de l'étape</label><input class="input" type="text" value="${esc(sl.n)}" data-c="legName"></div>
    <div class="row sp" style="margin-bottom:10px"><span style="font-size:12px">Durée du séjour</span>${stepper('daysLess', 'daysMore', `<span style="width:64px;text-align:center;font-size:18px;font-weight:700">${sl.d}&nbsp;j</span>`)}</div>
    <div class="row sp"><span style="font-size:12px">Budget par jour</span>${stepper('budLess', 'budMore', `<input class="input" type="text" inputmode="numeric" value="${sl.b || ''}" data-c="daily" style="width:84px;text-align:center;font-size:18px;font-weight:700;padding:0 4px"><span style="font-size:12px">€</span>`)}</div>
    <div style="display:grid;grid-template-columns:1fr 1.4fr;gap:10px;margin-top:14px"><div class="field"><label>Monnaie</label><input class="input" type="text" maxlength="3" value="${esc(sl.c)}" data-c="legCode"></div><div class="field"><label>Taux : 1 ${esc(sl.c)} = ... €</label><input class="input" type="text" inputmode="decimal" value="${String(sl.r).replace('.', ',')}" data-c="legRate"></div></div>
    <div class="row sp" style="margin-top:14px;padding-top:10px;border-top:1px solid var(--divider)"><span class="meta" style="font-size:12px">Budget de l'étape</span><span style="font-size:20px;font-weight:700">${f0(sl.tot)}</span></div>
    <div class="row" style="gap:8px;margin-top:14px"><button type="button" class="btn btn-sec" style="flex:1" data-a="addLeg">+ Ajouter une étape</button><button type="button" class="btn btn-ghost" data-a="delLeg">Supprimer</button></div></div></div>`;
};

const vSettings = V => {
  const { s, A, B, tot, dt, dObj, today } = V;
  const catEditor = (title, list, kind, nv) => `<div class="card" style="gap:8px"><div class="kick">${title}</div>${list.map(c => `<div class="row" style="gap:6px">${svg(IC[c.k] || TAG)}<input class="input" type="text" value="${esc(c.l)}" data-c="catName" data-kind="${kind}" data-k="${esc(c.k)}" style="flex:1;min-width:0"><button type="button" class="del" aria-label="Supprimer la catégorie" data-a="delCat" data-kind="${kind}" data-v="${esc(c.k)}">&times;</button></div>`).join('')}
    <div class="row" style="gap:8px;margin-top:4px"><input class="input" type="text" placeholder="Nouvelle catégorie" value="${esc(nv)}" data-c="new${kind}" style="flex:1;min-width:0"><button type="button" class="btn btn-sec" data-a="addCat" data-kind="${kind}">Ajouter</button></div></div>`;
  return `<div class="col" style="gap:16px"><div class="h1">Réglages</div>
  <div class="card" style="gap:12px"><div class="kick">Participants</div><div class="field"><label>Premier prénom</label><input class="input" type="text" value="${esc(s.nameA)}" data-c="nameA"></div><div class="field"><label>Second prénom</label><input class="input" type="text" value="${esc(s.nameB)}" data-c="nameB"></div></div>
  <div class="card" style="gap:12px"><div class="kick">Dates du voyage</div><div class="field"><label>Date de départ</label><input class="input" type="date" value="${esc(s.startISO)}" data-c="start"></div><div class="field"><label>Date de retour</label><input class="input" type="date" value="${dObj(tot).toISOString().slice(0, 10)}" data-c="end"></div>
    <div class="meta" style="font-size:12px">Retour le ${dt(tot)} ${dObj(tot).getUTCFullYear()} · ${tot} jours · aujourd'hui = jour ${today}</div><div class="meta">La durée de chaque étape se règle dans l'onglet Plan.</div></div>
  <div class="card"><div class="kick">Budgets</div><div class="row sp" style="margin-top:10px"><span style="font-size:12px">Avant le voyage</span><div class="row" style="gap:8px"><button type="button" class="btn btn-sec btn-icon" data-a="preLess">&minus;</button><input class="input" type="text" inputmode="numeric" value="${s.preBudget || ''}" data-c="preBudget" style="width:84px;text-align:center;font-size:18px;font-weight:700;padding:0 4px"><span style="font-size:12px">€</span><button type="button" class="btn btn-sec btn-icon" data-a="preMore">+</button></div></div>
    <div class="meta" style="margin-top:10px">Budget journalier et taux de change : par étape, dans l'onglet Plan.</div></div>
  ${catEditor('Catégories · pendant le voyage', s.tripCats, 'Trip', s.newTrip)}${catEditor('Catégories · avant le voyage', s.preCats, 'Pre', s.newPre)}
  <div class="card" style="gap:10px"><div class="kick">Données</div><div class="meta" style="font-size:12px">Tout est enregistré sur ce téléphone, sans connexion. Pensez à exporter une sauvegarde de temps en temps.</div>
    <button type="button" class="btn btn-sec" data-a="exportData">Exporter une sauvegarde</button><button type="button" class="btn btn-sec" data-a="importData">Importer une sauvegarde</button><input type="file" id="importFile" accept="application/json,.json" hidden>
    <button type="button" class="btn btn-sec btn-danger" data-a="clearExps">Supprimer toutes les dépenses (exemples)</button></div></div>`;
};

const TABS = [['home', 'Accueil', '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>'], ['add', 'Ajouter', '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>'], ['history', 'Historique', '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'], ['budget', 'Budget', '<line x1="5" y1="20" x2="5" y2="12"/><line x1="12" y1="20" x2="12" y2="7"/><line x1="19" y1="20" x2="19" y2="14"/>'], ['plan', 'Plan', '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'], ['settings', 'Réglages', '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>']];

function render() {
  const main = document.getElementById('main'), y = main.scrollTop;
  const V = calc();
  main.innerHTML = { home: vHome, add: vAdd, history: vHistory, budget: vBudget, plan: vPlan, settings: vSettings }[S.tab](V);
  main.scrollTop = y;
  document.getElementById('tabs').innerHTML = TABS.map(([k, l, p]) => `<button type="button" class="${S.tab === k ? 'on' : ''}" data-a="tab" data-v="${k}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${p}</svg><span>${l}</span></button>`).join('');
}
const set = (patch, keepScroll = true) => { Object.assign(S, patch); persist(); const m = document.getElementById('main'); const y = m.scrollTop; render(); if (!keepScroll) m.scrollTop = 0; };
const setLeg = (i, patch) => set({ legs: S.legs.map((l, k) => k === i ? { ...l, ...patch } : l) });
const curSel = () => Math.min(S.sel, S.legs.length - 1);
const addDayNow = V => Math.min(V.tot, Math.max(1, S.addDay == null ? V.today : S.addDay));

const A = {
  tab: v => set({ tab: v }, false),
  openBudget: v => set({ tab: 'budget', bview: v }, false),
  delExp: v => set({ exps: S.exps.filter(e => String(e.id) !== v) }),
  histFilter: v => set({ hf: v === 'all' || v === 'pre' ? v : +v }),
  editExp: v => { const e = S.exps.find(x => String(x.id) === v); if (!e) return; set({ tab: 'add', editId: e.id, phase: e.ph, cur: 'EUR', amount: String(Math.round(e.a * 100) / 100).replace('.', ','), cat: e.c, paidBy: e.py >= .5 ? 'you' : 'partner', forWhom: e.f, addDay: e.ph === 'trip' ? e.day : S.addDay, spread: e.n > 1, spreadN: e.n > 1 ? e.n : 5, note: e.l || '', saved: false }, false); },
  cancelEdit: () => set({ editId: null, amount: '', note: '', spread: false, addDay: null, tab: 'history' }, false),
  setPhase: v => set({ phase: v, cat: v === 'pre' ? S.preCats[0].k : S.tripCats[0].k, cur: v === 'pre' ? 'EUR' : 'LOC' }),
  setCur: v => set({ cur: v }), setCat: v => set({ cat: v }), setPaid: v => set({ paidBy: v }), setFor: v => set({ forWhom: v }), setSpread: v => set({ spread: v === 'on' }),
  dayPrev: () => { const V = calc(); set({ addDay: Math.max(1, addDayNow(V) - 1) }); },
  dayNext: () => { const V = calc(); set({ addDay: Math.min(V.tot, addDayNow(V) + 1) }); },
  spreadLess: () => set({ spreadN: Math.max(2, S.spreadN - 1) }), spreadMore: () => set({ spreadN: Math.min(30, S.spreadN + 1) }),
  save: () => {
    const V = calc(), isTrip = S.phase === 'trip';
    const amt = parseFloat(String(S.amount).replace(',', '.')) || 0;
    if (amt <= 0 || S.saved) return;
    const day = addDayNow(V), al = V.L.find(l => day >= l.s && day <= l.e) || V.cl;
    const eur = isTrip && S.cur === 'LOC' ? amt * al.r : amt;
    const e = { id: Date.now(), ph: S.phase, l: S.note, c: S.cat, a: eur, py: S.paidBy === 'you' ? 1 : 0, f: S.forWhom, day: isTrip ? day : 0, n: isTrip && S.spread ? S.spreadN : 1 };
    const id = S.editId;
    set({ exps: id ? S.exps.map(x => x.id === id ? { ...e, id, auto: x.auto } : x) : [...S.exps, e], saved: true });
    setTimeout(() => set({ saved: false, amount: '', note: '', spread: false, addDay: null, editId: null, tab: id ? 'history' : 'home' }, false), 900);
  },
  selLeg: v => set({ sel: +v }),
  monthPrev: () => set({ calMonth: Math.max(0, S.calMonth - 1) }), monthNext: () => set({ calMonth: Math.min(12, S.calMonth + 1) }),
  pickDay: v => { const i = curSel(), sl = calc().L[i], idx = +v; if (idx >= sl.s) setLeg(i, { d: Math.min(90, Math.max(1, idx - sl.s + 1)) }); },
  daysLess: () => setLeg(curSel(), { d: Math.max(1, S.legs[curSel()].d - 1) }), daysMore: () => setLeg(curSel(), { d: Math.min(90, S.legs[curSel()].d + 1) }),
  budLess: () => setLeg(curSel(), { b: Math.max(20, S.legs[curSel()].b - 5) }), budMore: () => setLeg(curSel(), { b: S.legs[curSel()].b + 5 }),
  addLeg: () => set({ legs: [...S.legs, { n: 'Nouvelle étape', d: 14, b: 100, c: 'EUR', r: 1 }], sel: S.legs.length }),
  delLeg: () => { if (S.legs.length > 1) set({ legs: S.legs.filter((_, k) => k !== curSel()), sel: 0 }); },
  preLess: () => set({ preBudget: Math.max(0, S.preBudget - 250) }), preMore: () => set({ preBudget: S.preBudget + 250 }),
  addCat: (v, el) => { const kind = el.dataset.kind, f = 'new' + kind, list = kind === 'Trip' ? 'tripCats' : 'preCats'; if (S[f].trim()) set({ [list]: [...S[list], { k: 'c' + Date.now(), l: S[f].trim() }], [f]: '' }); },
  delCat: (v, el) => { const list = el.dataset.kind === 'Trip' ? 'tripCats' : 'preCats'; if (S[list].length > 1) set({ [list]: S[list].filter(c => c.k !== v) }); },
  clearExps: () => { if (confirm('Supprimer toutes les dépenses enregistrées ?')) set({ exps: [] }); },
  exportData: async () => {
    const blob = new Blob([JSON.stringify(S)], { type: 'application/json' }), name = 'voyage-sauvegarde-' + new Date().toISOString().slice(0, 10) + '.json';
    const file = new File([blob], name, { type: 'application/json' });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; } } catch (e) { if (e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  },
  importData: () => document.getElementById('importFile').click(),
};

const C = {
  amount: v => { S.amount = v.replace(/[^0-9.,]/g, ''); persist(); },
  note: v => { S.note = v; persist(); },
  addDate: v => { const t = Date.parse(v); if (t) set({ addDay: Math.max(1, Math.floor((t - calc().START) / DAY) + 1) }); },
  nameA: v => set({ nameA: v }), nameB: v => set({ nameB: v }),
  start: v => v && set({ startISO: v }),
  end: v => { const V = calc(), t = Date.parse(v); if (!t) return; let delta = Math.floor((t - V.START) / DAY) + 1 - V.tot; const legs = S.legs.map(l => ({ ...l })); for (let k = legs.length - 1; k >= 0 && delta !== 0; k--) { const nd = Math.max(1, Math.min(120, legs[k].d + delta)); delta -= nd - legs[k].d; legs[k].d = nd; if (delta > 0) break; } set({ legs }); },
  preBudget: v => set({ preBudget: num(v) }),
  daily: v => setLeg(curSel(), { b: num(v) }),
  legName: v => setLeg(curSel(), { n: v }), legCode: v => setLeg(curSel(), { c: v.toUpperCase().slice(0, 3) }),
  legRate: v => { const r = parseFloat(v.replace(',', '.')); if (r > 0) setLeg(curSel(), { r }); else render(); },
  newTrip: v => { S.newTrip = v; persist(); }, newPre: v => { S.newPre = v; persist(); },
  catName: (v, el) => { const list = el.dataset.kind === 'Trip' ? 'tripCats' : 'preCats'; set({ [list]: S[list].map(c => c.k === el.dataset.k ? { ...c, l: v } : c) }); },
};

const app = document.getElementById('app');
app.addEventListener('click', e => { const el = e.target.closest('[data-a]'); if (el && A[el.dataset.a]) A[el.dataset.a](el.dataset.v, el); });
// Saisie du montant / de la note : mise à jour en direct, sans perdre le focus ni le curseur.
app.addEventListener('input', e => {
  const el = e.target, c = el.dataset.c;
  if (c !== 'amount' && c !== 'note') return;
  const pos = el.selectionStart;
  C[c](el.value);
  render();
  const n = document.querySelector('[data-c="' + c + '"]');
  if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (_) {} }
});
app.addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'importFile') {
    const f = el.files[0]; if (!f) return;
    f.text().then(t => { const d = JSON.parse(t); if (!d.legs || !d.exps) throw 0; if (confirm('Remplacer les données actuelles par cette sauvegarde ?')) { S = Object.assign(DEFAULTS(), d, { tab: 'home' }); persist(); render(); } }).catch(() => alert('Fichier de sauvegarde invalide.'));
    return;
  }
  if (el.dataset.c && C[el.dataset.c]) C[el.dataset.c](el.value, el);
});
render();
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
