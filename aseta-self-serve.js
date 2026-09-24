(() => {
  const nav = document.querySelector('#main-nav');
  const menu = document.querySelector('.menu-toggle');
  const modal = document.querySelector('#demo-modal');
  const openButtons = document.querySelectorAll('[data-open-demo]');
  const closeButtons = document.querySelectorAll('[data-close-demo]');
  const steps = [...document.querySelectorAll('[data-step]')];
  const answers = {};
  let currentStep = 1;

  const updateAssessment = () => {
    steps.forEach((step) => { step.hidden = Number(step.dataset.step) !== currentStep; });
    document.querySelector('#step-number').textContent = currentStep;
    document.querySelector('#progress-bar').style.width = `${currentStep * 20}%`;
    document.querySelector('#prev-step').hidden = currentStep === 1;
    document.querySelector('#next-step').textContent = currentStep === steps.length ? 'Lihat rekomendasi' : 'Lanjut →';
    document.querySelector('#assessment-hint').textContent = 'Pilih satu jawaban untuk melanjutkan.';
  };

  const selectedValue = (step) => document.querySelector(`[data-step="${step}"] input:checked`)?.value;

  const showResult = () => {
    const large = answers.asset_count === 'large';
    const distributed = ['many', 'distributed'].includes(answers.locations);
    const maintenance = answers.goal === 'maintenance' || answers.problem === 'breakdown';
    const plan = large || distributed ? 'Aseta Scale' : maintenance ? 'Aseta Maintenance' : 'Aseta Foundation';
    const result = document.querySelector('#assessment-result');
    document.querySelector('#result-title').textContent = plan === 'Aseta Scale' ? 'Anda memiliki kebutuhan pengelolaan yang terstruktur.' : 'Anda dapat memulai dengan scope yang terukur.';
    document.querySelector('#result-copy').textContent = plan === 'Aseta Scale' ? 'Jumlah aset atau sebaran operasi Anda menunjukkan bahwa visibilitas terpusat, role, approval, dan reporting akan bernilai besar.' : 'Mulai dari asset register dan satu alur maintenance utama. Validasi manfaatnya sebelum memperluas cakupan ke lokasi atau modul lain.';
    document.querySelector('#result-plan').textContent = plan;
    document.querySelector('#result-reason').textContent = plan === 'Aseta Scale' ? 'Prioritaskan dashboard lintas lokasi, work order, preventive, dan kontrol akses.' : maintenance ? 'Prioritaskan preventive schedule, work order, overdue, dan riwayat pekerjaan.' : 'Prioritaskan asset register, lokasi, dokumen, dan struktur data yang rapi.';
    result.hidden = false;
    result.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  document.querySelector('#next-step')?.addEventListener('click', () => {
    const value = selectedValue(currentStep);
    if (!value) { document.querySelector('#assessment-hint').textContent = 'Pilih salah satu jawaban terlebih dahulu.'; return; }
    answers[steps[currentStep - 1].querySelector('input').name] = value;
    if (currentStep < steps.length) { currentStep += 1; updateAssessment(); } else showResult();
  });
  document.querySelector('#prev-step')?.addEventListener('click', () => { if (currentStep > 1) { currentStep -= 1; updateAssessment(); } });
  document.querySelector('#try-again')?.addEventListener('click', () => { currentStep = 1; Object.keys(answers).forEach((key) => { delete answers[key]; }); document.querySelectorAll('input[type="radio"]').forEach((input) => { input.checked = false; }); document.querySelector('#assessment-result').hidden = true; updateAssessment(); document.querySelector('#assessment').scrollIntoView({ behavior: 'smooth', block: 'center' }); });

  const setModal = (open) => { modal.hidden = !open; document.body.classList.toggle('modal-open', open); if (open) { renderDemo(); modal.querySelector('.modal-close')?.focus(); } };
  openButtons.forEach((button) => button.addEventListener('click', () => setModal(true)));
  closeButtons.forEach((button) => button.addEventListener('click', () => setModal(false)));
  modal?.addEventListener('click', (event) => { if (event.target === modal) setModal(false); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && modal && !modal.hidden) setModal(false); });

  // ===== Demo aplikasi interaktif =====
  const demoState = {
    view: 'dashboard',
    assets: [
      { id: 'AC-01', name: 'AC Central Tower', area: 'Gedung A · Lantai 3', criticality: 'Tinggi', condition: 82, pm: 'Jatuh tempo 2 hari', history: ['2026-08-04 Preventive — filter & coil', '2026-07-05 Preventive — filter & coil', '2026-06-02 Corrective — kebocoran freon'] },
      { id: 'PU-02', name: 'Pompa Utama Line 02', area: 'Produksi · Line 02', criticality: 'Kritis', condition: 61, pm: 'Terjadwal 12 Sep', history: ['2026-08-28 Corrective — seal bocor (WO-0821)', '2026-08-01 Preventive — pelumasan', '2026-07-02 Preventive — pelumasan'] },
      { id: 'GN-03', name: 'Genset 500 kVA', area: 'Utilitas', criticality: 'Kritis', condition: 74, pm: 'Terjadwal 20 Sep', history: ['2026-08-15 Preventive — ganti oli & filter', '2026-07-15 Preventive — ganti oli & filter'] },
      { id: 'FT-04', name: 'Forklift Elektrik 2', area: 'Warehouse', criticality: 'Sedang', condition: 55, pm: 'Belum ada jadwal PM', history: ['2026-08-20 Corrective — baterai drop', '2026-05-10 Corrective — sistem kemudi'] },
      { id: 'KV-05', name: 'Panel Distribusi Utama', area: 'Utilitas', criticality: 'Kritis', condition: 90, pm: 'Terjadwal 28 Sep', history: ['2026-08-10 Inspection — termografi OK'] }
    ],
    workOrders: [
      { id: 'WO-0821', asset: 'Pompa Utama Line 02', type: 'Corrective', due: 'Overdue 2 hari', priority: 'Kritis', tech: 'Belum ditugaskan', status: 'open', note: 'Seal bocor, ada tetesan di area operasi.' },
      { id: 'WO-0834', asset: 'AC Central Tower', type: 'Preventive', due: 'Jatuh tempo besok', priority: 'Tinggi', tech: 'Rizky', status: 'open', note: 'PM bulanan: filter, coil, cek freon.' },
      { id: 'WO-0840', asset: 'Forklift Elektrik 2', type: 'Corrective', due: '3 hari lagi', priority: 'Sedang', tech: 'Dewi', status: 'open', note: 'Baterai drop cepat, perlu pengecekan sel.' },
      { id: 'WO-0841', asset: 'Genset 500 kVA', type: 'Preventive', due: '20 Sep', priority: 'Sedang', tech: 'Fajar', status: 'open', note: 'PM triwulan: oli, filter, load test.' }
    ],
    pm: [
      { asset: 'AC Central Tower', every: 'Bulanan', next: '3 Sep', done: 9, overdue: 1 },
      { asset: 'Pompa Utama Line 02', every: 'Bulanan', next: '12 Sep', done: 10, overdue: 2 },
      { asset: 'Genset 500 kVA', every: 'Triwulan', next: '20 Sep', done: 3, overdue: 0 },
      { asset: 'Forklift Elektrik 2', every: '—', next: '—', done: 0, overdue: 0 },
      { asset: 'Panel Distribusi Utama', every: 'Semester', next: '28 Sep', done: 1, overdue: 0 }
    ]
  };
  const fmtDue = (d) => d;
  const escDemo = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const openWO = () => demoState.workOrders.filter((w) => w.status === 'open');
  const overdueWO = () => openWO().filter((w) => w.due.includes('Overdue'));
  const unassigned = () => openWO().filter((w) => w.tech === 'Belum ditugaskan');
  const criticalAssets = () => demoState.assets.filter((a) => a.criticality === 'Kritis' && a.condition < 70);
  const noPmAssets = () => demoState.assets.filter((a) => a.pm.includes('Belum'));
  const healthPct = () => Math.round((1 - (criticalAssets().length + noPmAssets().length * .5) / demoState.assets.length) * 100);
  const renderDemo = () => {
    const body = document.querySelector('#demo-body');
    if (!body) return;
    document.querySelectorAll('[data-demo-view]').forEach((b) => b.classList.toggle('active', b.dataset.demoView === demoState.view));
    const pageTitle = document.querySelector('#demo-page-title');
    if (pageTitle) pageTitle.textContent = ({ dashboard: 'Dashboard', assets: 'Aset', workorders: 'Work order', preventive: 'Preventive' })[demoState.view];
    if (demoState.view === 'dashboard') {
      const h = healthPct();
      body.innerHTML = `
      <div class="dd-kpis">
        <div class="dd-kpi"><small>Asset health</small><strong class="${h < 80 ? 'warn' : 'ok'}">${h}%</strong><em>${h < 80 ? `${criticalAssets().length} aset kritis perlu aksi` : 'Semua terkendali'}</em></div>
        <div class="dd-kpi"><small>Work order terbuka</small><strong class="${overdueWO().length ? 'warn' : 'ok'}">${openWO().length}</strong><em>${overdueWO().length ? `${overdueWO().length} overdue` : 'Tidak ada overdue'} · ${unassigned().length} belum ditugaskan</em></div>
        <div class="dd-kpi"><small>Cakupan PM</small><strong>${demoState.assets.length - noPmAssets().length}/${demoState.assets.length}</strong><em>${noPmAssets().length ? 'aset tanpa jadwal PM' : 'semua aset terjadwal'}</em></div>
      </div>
      <div class="dd-callout"><b>Keputusan hari ini:</b> ${unassigned().length ? `tugaskan ${unassigned().map((w) => w.id).join(', ')} — aset kritis tidak boleh menunggu` : 'semua WO sudah tertangani'}${noPmAssets().length ? `; buat jadwal PM untuk ${noPmAssets().map((a) => a.name).join(', ')}` : ''}.</div>
      <div class="dd-list"><div class="dd-list-head">Prioritas pekerjaan <span>urut criticality & SLA</span></div>
      ${openWO().sort((a, b) => (a.priority === 'Kritis' ? -1 : 1) - (b.priority === 'Kritis' ? -1 : 1)).slice(0, 4).map((w) => `
        <div class="dd-row"><span class="status-dot ${w.due.includes('Overdue') ? 'red' : 'amber'}"></span><div><strong>${w.id} · ${escDemo(w.asset)}</strong><small>${w.due} · ${w.type} · ${w.tech}</small></div><b>${w.priority}</b></div>`).join('') || '<div class="dd-empty">Semua work order selesai ✓</div>'}
      </div>`;
    } else if (demoState.view === 'assets') {
      body.innerHTML = `<div class="dd-list-head">Aset terdaftar <span>klik untuk detail</span></div>` + demoState.assets.map((a) => `
      <button class="dd-asset" type="button" data-asset="${a.id}">
        <span class="dd-asset-ava ${a.condition < 70 ? 'bad' : 'good'}">${Math.round(a.condition)}</span>
        <div><strong>${escDemo(a.name)}</strong><small>${escDemo(a.area)} · ${escDemo(a.criticality)} · ${escDemo(a.pm)}</small></div>
        <b class="chev">›</b>
      </button>`).join('');
    } else if (demoState.view === 'workorders') {
      body.innerHTML = `<div class="dd-list-head">Antrean work order <span>status ikut berubah saat Anda menindaklanjuti</span></div>` + demoState.workOrders.map((w) => `
      <div class="dd-wo ${w.status}">
        <div class="dd-wo-top"><span class="status-dot ${w.status === 'done' ? 'green' : w.due.includes('Overdue') ? 'red' : 'amber'}"></span><div><strong>${w.id} · ${escDemo(w.asset)}</strong><small>${w.due} · ${w.type} · Teknisi: ${escDemo(w.tech)}</small></div><b>${w.status === 'done' ? 'Selesai ✓' : escDemo(w.priority)}</b></div>
        <p>${escDemo(w.note)}</p>
        ${w.status === 'open' ? `<div class="dd-wo-actions">
          ${w.tech === 'Belum ditugaskan' ? ['Rizky', 'Dewi', 'Fajar'].map((t) => `<button type="button" class="dd-chip" data-assign="${w.id}:${t}">Tugaskan ${t}</button>`).join('') : ''}
          <button type="button" class="dd-chip primary" data-done="${w.id}">Tandai selesai</button>
        </div>` : ''}
      </div>`).join('');
    } else if (demoState.view === 'preventive') {
      body.innerHTML = `<div class="dd-list-head">Jadwal preventive <span>${noPmAssets().length} aset belum punya jadwal</span></div>` + demoState.pm.map((p) => `
      <div class="dd-pm"><div><strong>${escDemo(p.asset)}</strong><small>${p.every === '—' ? 'Belum ada jadwal' : `Setiap ${p.every.toLowerCase()} · berikutnya ${p.next}`} · selesai ${p.done}×${p.overdue ? ` · overdue ${p.overdue}×` : ''}</small></div>
      ${p.every === '—' ? `<button type="button" class="dd-chip primary" data-createpm="${escDemo(p.asset)}">Buat jadwal bulanan</button>` : `<b class="pm-ok">Aktif</b>`}</div>`).join('') +
      `<div class="dd-callout"><b>Keputusan:</b> aset tanpa PM adalah sumber breakdown reaktif di masa depan — mulai dari aset criticality tinggi.</div>`;
    }
    // detail aset
    body.querySelectorAll('[data-asset]').forEach((btn) => btn.addEventListener('click', () => {
      const a = demoState.assets.find((x) => x.id === btn.dataset.asset);
      body.innerHTML = `<button type="button" class="dd-back" data-back>← Kembali ke daftar aset</button>
      <div class="dd-detail"><div class="dd-detail-head"><div><strong>${escDemo(a.name)}</strong><small>${escDemo(a.area)} · ID ${a.id} · Criticality ${escDemo(a.criticality)}</small></div><span class="dd-cond ${a.condition < 70 ? 'bad' : 'good'}">Kondisi ${Math.round(a.condition)}%</span></div>
      <div class="dd-cond-bar"><i style="width:${a.condition}%"></i></div>
      <div class="dd-sub">Riwayat pekerjaan</div>
      ${a.history.map((hRow) => `<div class="dd-row"><span class="dd-hist-dot"></span><small>${escDemo(hRow)}</small></div>`).join('')}
      <div class="dd-callout"><b>Insight:</b> ${a.pm.includes('Belum') ? `aset ini belum punya jadwal PM padahal riwayat ${a.history.filter((x) => x.includes('Corrective')).length}× corrective — ini pola breakdown berulang.` : a.condition < 70 ? `kondisi menurun meski PM aktif — evaluasi interval PM atau siapkan penggantian komponen.` : `PM aktif dan kondisi stabil — pertahankan interval saat ini.`}</div></div>`;
      body.querySelector('[data-back]').addEventListener('click', renderDemo);
    }));
    // aksi work order
    body.querySelectorAll('[data-assign]').forEach((btn) => btn.addEventListener('click', () => {
      const [id, tech] = btn.dataset.assign.split(':');
      const w = demoState.workOrders.find((x) => x.id === id);
      if (w) { w.tech = tech; renderDemo(); }
    }));
    body.querySelectorAll('[data-done]').forEach((btn) => btn.addEventListener('click', () => {
      const w = demoState.workOrders.find((x) => x.id === btn.dataset.done);
      if (w) {
        w.status = 'done'; w.due = 'Selesai hari ini';
        const a = demoState.assets.find((x) => x.name === w.asset);
        if (a) { a.condition = Math.min(100, a.condition + (w.type === 'Corrective' ? 12 : 5)); a.history.unshift(`Hari ini ${w.type} — ${w.id} selesai`); }
        const p = demoState.pm.find((x) => x.asset === w.asset);
        if (p && w.type === 'Preventive') { p.done += 1; if (p.overdue) p.overdue -= 1; }
        renderDemo();
      }
    }));
    body.querySelectorAll('[data-createpm]').forEach((btn) => btn.addEventListener('click', () => {
      const a = demoState.assets.find((x) => x.name === btn.dataset.createpm);
      if (a) { a.pm = 'Terjadwal mulai bulan depan'; demoState.pm.push({ asset: a.name, every: 'Bulanan', next: 'Bulan depan', done: 0, overdue: 0 }); renderDemo(); }
    }));
  };
  document.querySelectorAll('[data-demo-view]').forEach((b) => b.addEventListener('click', () => { demoState.view = b.dataset.demoView; renderDemo(); }));

  const assetRange = document.querySelector('#asset-range');
  const hoursRange = document.querySelector('#hours-range');
  const fmtRp = (n) => {
    if (n >= 1e9) return `Rp${(n / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 2 })} M`;
    if (n >= 1e6) return `Rp${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
    if (n >= 1e3) return `Rp${(n / 1e3).toLocaleString('id-ID', { maximumFractionDigits: 0 })} rb`;
    return `Rp${n.toLocaleString('id-ID')}`;
  };
  const fmtHours = (h) => (h >= 1e6 ? `${(h / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} juta jam` : h >= 1000 ? `${(h / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} ribu jam` : `${Math.round(h).toLocaleString('id-ID')} jam`);

  // Tab simulator
  document.querySelectorAll('[data-calc-tab]').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('[data-calc-tab]').forEach((tab) => tab.classList.toggle('active', tab === button));
    document.querySelectorAll('[data-calc-panel]').forEach((panel) => { panel.hidden = panel.dataset.calcPanel !== button.dataset.calcTab; });
  }));

  // Kalkulator dampak finansial
  const dtRange = document.querySelector('#dt-range');
  const dtCostRange = document.querySelector('#dtcost-range');
  const repairRange = document.querySelector('#repair-range');
  const reduceRange = document.querySelector('#reduce-range');
  const financialInputs = [dtRange, dtCostRange, repairRange, reduceRange];
  let fin = { downtime: 12, costPerHour: 2500000, repair: 15000000, reduce: 30 };
  const updateFinancial = () => {
    if (!dtRange) return;
    fin = {
      downtime: Number(dtRange.value),
      costPerHour: Number(dtCostRange.value),
      repair: Number(repairRange.value),
      reduce: Number(reduceRange.value)
    };
    document.querySelector('#dt-output').textContent = `${fin.downtime} jam`;
    document.querySelector('#dtcost-output').textContent = fmtRp(fin.costPerHour);
    document.querySelector('#repair-output').textContent = fmtRp(fin.repair);
    document.querySelector('#reduce-output').textContent = `${fin.reduce}%`;
    const dtLoss = fin.downtime * fin.costPerHour * 12;
    const repairLoss = fin.repair * 12;
    const annualLoss = dtLoss + repairLoss;
    const annualSaving = annualLoss * (fin.reduce / 100);
    document.querySelector('#loss-result').textContent = fmtRp(annualLoss);
    document.querySelector('#saving-result').textContent = fmtRp(annualSaving);
    document.querySelector('#saving-month').textContent = fmtRp(annualSaving / 12);
    document.querySelector('#saving-3y').textContent = fmtRp(annualSaving * 3);
  };
  financialInputs.forEach((input) => input?.addEventListener('input', updateFinancial));

  // Salin ringkasan simulasi
  document.querySelector('#copy-summary')?.addEventListener('click', () => {
    const lines = [
      'Ringkasan simulasi dampak operasional (Aseta)',
      '',
      `Downtime per bulan: ${fin.downtime} jam`,
      `Biaya per jam downtime: ${fmtRp(fin.costPerHour)}`,
      `Perbaikan reaktif per bulan: ${fmtRp(fin.repair)}`,
      `Target pengurangan breakdown: ${fin.reduce}%`,
      '',
      `Estimasi kerugian per tahun: ${fmtRp(fin.downtime * fin.costPerHour * 12 + fin.repair * 12)}`,
      `Potensi penghematan per tahun: ${fmtRp((fin.downtime * fin.costPerHour * 12 + fin.repair * 12) * fin.reduce / 100)}`,
      '',
      'Catatan: simulasi berbasis input internal, bukan jaminan hasil atau penawaran harga.'
    ];
    navigator.clipboard?.writeText(lines.join('\n')).then(() => {
      const status = document.querySelector('#copy-status');
      status.hidden = false;
      setTimeout(() => { status.hidden = true; }, 2500);
    });
  });

  const updateCalculator = () => {
    const assets = Number(assetRange.value);
    const hours = Number(hoursRange.value);
    document.querySelector('#asset-output').textContent = assets.toLocaleString('id-ID');
    document.querySelector('#hours-output').textContent = `${hours} jam`;
    document.querySelector('#saved-hours').textContent = `${Math.max(1, Math.round(hours * .5))} jam/minggu`;
    document.querySelector('#focus-result').textContent = assets > 1000 ? 'Lintas lokasi & SLA' : hours > 12 ? 'Backlog & koordinasi' : 'Preventive & backlog';
  };
  assetRange?.addEventListener('input', updateCalculator); hoursRange?.addEventListener('input', updateCalculator);
  menu?.addEventListener('click', () => { const open = menu.getAttribute('aria-expanded') === 'true'; menu.setAttribute('aria-expanded', String(!open)); nav.classList.toggle('open', !open); });
  nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => { menu?.setAttribute('aria-expanded', 'false'); nav.classList.remove('open'); }));
  updateAssessment(); updateCalculator(); updateFinancial();
})();
