(() => {
  const nav = document.querySelector('#main-nav');
  const menu = document.querySelector('.menu-toggle');
  const modal = document.querySelector('#demo-modal');
  const openButtons = document.querySelectorAll('[data-open-demo]');
  const closeButtons = document.querySelectorAll('[data-close-demo]');
  const assessmentNeeds = [...document.querySelectorAll('#assessment input[data-need-id]')];
  const noNeedChoice = document.querySelector('#assessment input[data-no-need]');
  const result = document.querySelector('#assessment-result');
  const validation = document.querySelector('#assessment-validation');
  const updateExclusiveChoices = () => {
    const noNeedSelected = noNeedChoice.checked;
    assessmentNeeds.forEach((input) => {
      input.disabled = noNeedSelected;
      if (noNeedSelected) input.checked = false;
    });
    if (assessmentNeeds.some((input) => input.checked)) noNeedChoice.checked = false;
    result.hidden = true;
    validation.hidden = true;
  };
  assessmentNeeds.forEach((input) => input.addEventListener('change', updateExclusiveChoices));
  noNeedChoice?.addEventListener('change', updateExclusiveChoices);
  let assessmentStep = 1;
  const assessmentSteps = [...document.querySelectorAll('#assessment .assessment-step')];
  const assessmentProfileLines = () => [
    ['Jumlah aset', '#profile-assets'],
    ['Sistem saat ini', '#profile-system'],
    ['Jumlah cabang', '#profile-branches']
  ].map(([label, sel]) => {
    const el = document.querySelector(sel);
    return el?.value ? `${label}: ${el.value}` : '';
  }).filter(Boolean);
  const renderAssessmentStep = () => {
    assessmentSteps.forEach((fieldset) => { fieldset.hidden = Number(fieldset.dataset.step) !== assessmentStep; });
    const now = document.querySelector('#assessment-step-now');
    const total = document.querySelector('#assessment-step-total');
    const back = document.querySelector('#assessment-back');
    const next = document.querySelector('#assessment-next');
    const submit = document.querySelector('#assessment-submit');
    if (now) now.textContent = String(assessmentStep);
    if (total) total.textContent = String(assessmentSteps.length);
    if (back) back.hidden = assessmentStep === 1;
    if (next) next.hidden = assessmentStep >= assessmentSteps.length;
    if (submit) submit.hidden = assessmentStep < assessmentSteps.length;
    result.hidden = true;
    validation.hidden = true;
  };
  document.querySelector('#assessment-next')?.addEventListener('click', () => {
    if (assessmentStep === 2 && !noNeedChoice.checked && !assessmentNeeds.some((input) => input.checked)) {
      result.hidden = true;
      validation.textContent = 'Pilih minimal satu kebutuhan, atau pilih bahwa Anda belum membutuhkan Aseta.';
      validation.hidden = false;
      return;
    }
    assessmentStep = Math.min(assessmentStep + 1, assessmentSteps.length);
    renderAssessmentStep();
  });
  document.querySelector('#assessment-back')?.addEventListener('click', () => { assessmentStep = Math.max(assessmentStep - 1, 1); renderAssessmentStep(); });
  document.querySelector('#assessment-submit')?.addEventListener('click', () => {
    const selectedIds = assessmentNeeds.filter((input) => input.checked).map((input) => input.dataset.needId);
    const decision = window.AsetaAssessment.evaluate(selectedIds, noNeedChoice.checked);
    if (!decision.valid) {
      result.hidden = true;
      validation.textContent = 'Pilih minimal satu kebutuhan, atau pilih bahwa Anda belum membutuhkan Aseta.';
      validation.hidden = false;
      return;
    }
    if (assessmentProfileLines().length < 3) {
      result.hidden = true;
      validation.textContent = 'Lengkapi jumlah aset, sistem saat ini, dan jumlah cabang agar rekomendasi lebih pas.';
      validation.hidden = false;
      return;
    }
    const labels = {
      enterprise: 'Aseta Enterprise',
      essentials: 'Aseta Essentials',
      'not-needed': 'Belum membutuhkan Aseta'
    };
    document.querySelector('#result-plan').textContent = labels[decision.recommendation];
    document.querySelector('#result-reason').textContent = decision.reasons.join(' ');
    const roiSummary = document.querySelector('#roi-assessment-summary');
    roiSummary.hidden = noNeedChoice.checked;
    if (!noNeedChoice.checked) {
      roiSummary.textContent = fin.hasInvestment
        ? `Dari asumsi kalkulator: potensi biaya terhindarkan ${fmtRp(fin.annualSaving)}/tahun dibandingkan estimasi total biaya sistem tahun pertama ${fmtRp(fin.investment)}. ROI indikatif ${Math.round(fin.roi)}%, net benefit ${fmtRp(fin.netBenefit)} pada tahun pertama${Number.isFinite(fin.paybackMonths) ? `, balik modal sekitar ${fin.paybackMonths.toLocaleString('id-ID', { maximumFractionDigits: 1 })} bulan` : ''}. Target pengurangan breakdown ${fin.reduce}% adalah asumsi, bukan jaminan hasil.`
        : `Pilih jumlah aset untuk menghitung estimasi biaya paket; biaya ROI di luar cakupan acuan harga karena skala lebih dari 2.000 aset.`;
    }
    const assessmentCta = document.querySelector('#assessment-cta');
    assessmentCta.hidden = noNeedChoice.checked;
    validation.hidden = true;
    result.hidden = false;
    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

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
    if (pageTitle) pageTitle.textContent = ({ dashboard: 'Dashboard', assets: 'Aset', workorders: 'Maintenance', preventive: 'Preventive' })[demoState.view];
    if (demoState.view === 'dashboard') {
      const h = healthPct();
      body.innerHTML = `
      <div class="dd-kpis">
        <div class="dd-kpi"><small>Asset health</small><strong class="${h < 80 ? 'warn' : 'ok'}">${h}%</strong><em>${h < 80 ? `${criticalAssets().length} aset kritis perlu aksi` : 'Semua terkendali'}</em></div>
        <div class="dd-kpi"><small>Maintenance terbuka</small><strong class="${overdueWO().length ? 'warn' : 'ok'}">${openWO().length}</strong><em>${overdueWO().length ? `${overdueWO().length} overdue` : 'Tidak ada overdue'} · ${unassigned().length} belum ditugaskan</em></div>
        <div class="dd-kpi"><small>Cakupan PM</small><strong>${demoState.assets.length - noPmAssets().length}/${demoState.assets.length}</strong><em>${noPmAssets().length ? 'aset tanpa jadwal PM' : 'semua aset terjadwal'}</em></div>
      </div>
      <div class="dd-callout"><b>Keputusan hari ini:</b> ${unassigned().length ? `tugaskan ${unassigned().map((w) => w.id).join(', ')} — aset kritis tidak boleh menunggu` : 'semua maintenance sudah tertangani'}${noPmAssets().length ? `; buat jadwal PM untuk ${noPmAssets().map((a) => a.name).join(', ')}` : ''}.</div>
      <div class="dd-list"><div class="dd-list-heading"><h3>Prioritas maintenance</h3><p>Diurutkan berdasarkan tingkat criticality aset dan SLA pekerjaan.</p></div>
      ${openWO().sort((a, b) => (a.priority === 'Kritis' ? -1 : 1) - (b.priority === 'Kritis' ? -1 : 1)).slice(0, 4).map((w) => `
        <div class="dd-row dd-priority-row"><span class="status-dot ${w.due.includes('Overdue') ? 'red' : 'amber'}"></span><div class="dd-row-main"><strong>${w.id} · ${escDemo(w.asset)}</strong><small>${w.due} · ${w.type} · ${w.tech}</small></div><b class="dd-priority">${w.priority}</b></div>`).join('') || '<div class="dd-empty">Semua maintenance selesai ✓</div>'}
      </div>`;
    } else if (demoState.view === 'assets') {
      body.innerHTML = `<div class="dd-list-head">Aset terdaftar <span>klik untuk detail</span></div>` + demoState.assets.map((a) => `
      <button class="dd-asset" type="button" data-asset="${a.id}">
        <span class="dd-asset-ava ${a.condition < 70 ? 'bad' : 'good'}">${Math.round(a.condition)}</span>
        <div><strong>${escDemo(a.name)}</strong><small>${escDemo(a.area)} · ${escDemo(a.criticality)} · ${escDemo(a.pm)}</small></div>
        <b class="chev">›</b>
      </button>`).join('');
    } else if (demoState.view === 'workorders') {
      body.innerHTML = `<div class="dd-list-head">Daftar maintenance <span>status ikut berubah saat Anda menindaklanjuti</span></div>` + demoState.workOrders.map((w) => `
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
    // aksi maintenance
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
  const leadDialog = document.querySelector('#lead-dialog');
  const leadForm = document.querySelector('#simulator-lead-form');
  const leadError = document.querySelector('#lead-error');
  const leadNextStep = document.querySelector('#lead-next-step');
  const leadShareButton = document.querySelector('#share-whatsapp');
  const leadSharePdfButton = document.querySelector('#share-pdf');
  const leadShareStatus = document.querySelector('#share-status');
  const leadPhone = '6281217984959';
  let currentPdf = null;
  let leadShareText = '';
  let retryLeadRequestId = '';

  const normalizePhone = (value) => {
    let digits = value.replace(/\D/g, '');
    if (digits.startsWith('0062')) digits = digits.slice(2);
    if (digits.startsWith('62')) digits = digits.slice(2);
    if (digits.startsWith('0')) digits = digits.slice(1);
    return `62${digits}`;
  };
  const phoneInput = leadForm.querySelector('[name="phone"]');
  phoneInput.addEventListener('input', () => {
    let digits = phoneInput.value.replace(/\D/g, '');
    if (digits.startsWith('0062')) digits = digits.slice(4);
    else if (digits.startsWith('62')) digits = digits.slice(2);
    else if (digits.startsWith('0')) digits = digits.slice(1);
    phoneInput.value = digits;
  });
  const whatsappUrl = () => `https://wa.me/${leadPhone}?text=${encodeURIComponent(leadShareText)}`;
  const returnToLanding = () => {
    leadDialog.close();
    window.history.replaceState(null, '', '#top');
    const scrollBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    document.documentElement.style.scrollBehavior = scrollBehavior;
  };
  document.querySelector('#download-pdf')?.addEventListener('click', () => {
    leadError.hidden = true;
    leadNextStep.hidden = true;
    leadForm.hidden = false;
    leadDialog.showModal();
    leadForm.querySelector('[name="name"]').focus();
  });
  document.querySelector('[data-close-lead]')?.addEventListener('click', () => leadDialog.close());
  leadShareButton?.addEventListener('click', () => {
    window.open(whatsappUrl(), '_blank', 'noopener,noreferrer');
    returnToLanding();
  });
  leadSharePdfButton?.addEventListener('click', async () => {
    if (!currentPdf) return;
    const file = new File([currentPdf], `aseta-ringkasan-simulasi-${new Date().toISOString().slice(0, 10)}.pdf`, { type: 'application/pdf' });
    try {
      await navigator.share({ files: [file], text: leadShareText, title: 'Hasil simulasi Aseta' });
      leadShareStatus.textContent = 'Pilih WhatsApp pada menu berbagi untuk mengirim PDF dan sapaan.';
      returnToLanding();
    } catch (error) {
      if (error.name !== 'AbortError') leadShareStatus.textContent = 'Berbagi file tidak tersedia. PDF sudah diunduh; lampirkan manual di WhatsApp.';
    }
  });
  document.querySelector('#sales-contact-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const message = [
      'Halo tim Aseta, saya ingin mengetahui lebih lanjut tentang Aseta.',
      '',
      `Nama: ${data.get('name').trim()}`,
      `Jabatan: ${data.get('position').trim()}`,
      `Nama perusahaan: ${data.get('company').trim()}`,
      ...assessmentProfileLines(),
      `Potensi biaya terhindarkan / tahun: ${fmtRp(fin.annualSaving)}`,
      `Estimasi total biaya sistem tahun pertama: ${fin.hasInvestment ? fmtRp(fin.investment) : 'estimasi belum tersedia'}`,
      `Net benefit indikatif tahun pertama: ${fin.hasInvestment ? fmtRp(fin.netBenefit) : 'estimasi belum tersedia'}`,
      `ROI indikatif tahun pertama: ${fin.roi !== null ? `${Math.round(fin.roi)}%` : 'belum dihitung — biaya sistem belum diisi'}`,
      `Target pengurangan breakdown: ${fin.reduce}% (asumsi simulasi)`,
      attributionFields.utm_source ? `Sumber kampanye: ${[attributionFields.utm_source, attributionFields.utm_medium, attributionFields.utm_campaign, attributionFields.utm_content, attributionFields.utm_term].filter(Boolean).join(' / ')}` : ''
    ].filter(Boolean).join('\n');
    window.open(`https://wa.me/6281217984959?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  });


  // Kalkulator dampak finansial
  const dtRange = document.querySelector('#dt-range');
  const dtCostRange = document.querySelector('#dtcost-range');
  const repairRange = document.querySelector('#repair-range');
  const reduceRange = document.querySelector('#reduce-range');
  const subscriptionType = document.querySelector('#subscription-type');
  const enterpriseFeatures = document.querySelector('#enterprise-features');
  const qrHardware = document.querySelector('#qr-hardware');
  const rfidReader = document.querySelector('#rfid-reader');
  const rfidTagType = document.querySelector('#rfid-tag-type');
  const investmentOutput = document.querySelector('#investment-output');
  const investmentBreakdown = document.querySelector('#investment-breakdown');
  const financialInputs = [dtRange, dtCostRange, repairRange, reduceRange, assetRange, subscriptionType, enterpriseFeatures, qrHardware, rfidReader, rfidTagType];
  let fin = { downtime: 0, costPerHour: 0, repair: 0, reduce: 0, investment: 0 };
  const campaignAttribution = new URLSearchParams(window.location.search);
  const attributionFields = Object.fromEntries(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'].map((key) => [key, campaignAttribution.get(key) || '']));
  const estimateInvestment = () => {
    const assets = Number(assetRange.value);
    if (!assets) {
      investmentOutput.textContent = 'Pilih jumlah aset';
      investmentBreakdown.textContent = 'Geser jumlah aset untuk melihat estimasi langganan berdasarkan tier harga.';
      return 0;
    }
    if (assets >= 2000) {
      investmentOutput.textContent = 'Perlu dikonfirmasi';
      investmentBreakdown.textContent = 'Harga paket di atas 2.000 aset belum tersedia pada acuan ini.';
      return 0;
    }
    const tier = assets < 500 ? 0 : assets < 1000 ? 1 : 2;
    const subscription = (subscriptionType.value === 'rfid' ? [750000, 1200000, 2400000] : [525000, 750000, 1200000])[tier] * 12;
    const enterprise = Number(enterpriseFeatures.value) * 375000 * 12;
    const hardware = subscriptionType.value === 'qr'
      ? (qrHardware.checked ? 7610000 : 0)
      : (rfidReader.checked ? 19500000 : 0) + Math.ceil(assets / 100) * Number(rfidTagType.value);
    const total = subscription + enterprise + hardware;
    investmentOutput.textContent = fmtRp(total);
    investmentBreakdown.textContent = `Langganan 12 bulan ${fmtRp(subscription)} + ${subscriptionType.value === 'qr' ? `hardware & consumables ${fmtRp(hardware)}` : `Tag RFID ${fmtRp(Math.ceil(assets / 100) * Number(rfidTagType.value))}${rfidReader.checked ? ` + reader ${fmtRp(19500000)}` : ''}`} + Enterprise ${fmtRp(enterprise)}`;
    return total;
  };
  const updateEstimatorVisibility = () => {
    document.querySelector('#qr-options').hidden = subscriptionType.value !== 'qr';
    document.querySelector('#rfid-options').hidden = subscriptionType.value !== 'rfid';
  };
  const updateFinancial = () => {
    if (!dtRange) return;
    fin = {
      downtime: Number(dtRange.value),
      costPerHour: Number(dtCostRange.value),
      repair: Number(repairRange.value),
      reduce: Number(reduceRange.value),
      investment: estimateInvestment()
    };
    const assets = Number(assetRange.value);
    const tier = assets < 500 ? 0 : assets < 1000 ? 1 : 2;
    fin.subscription = fin.investment > 0 ? (subscriptionType.value === 'rfid' ? [750000, 1200000, 2400000] : [525000, 750000, 1200000])[tier] * 12 : 0;
    fin.enterprise = fin.investment > 0 ? Number(enterpriseFeatures.value) * 375000 * 12 : 0;
    fin.hardware = fin.investment > 0 ? fin.investment - fin.subscription - fin.enterprise : 0;
    document.querySelector('#dt-output').textContent = `${fin.downtime} jam`;
    document.querySelector('#dtcost-output').textContent = fmtRp(fin.costPerHour);
    document.querySelector('#repair-output').textContent = fmtRp(fin.repair);
    document.querySelector('#reduce-output').textContent = `${fin.reduce}%`;
    const dtLoss = fin.downtime * fin.costPerHour * 12;
    const repairLoss = fin.repair * 12;
    const annualLoss = dtLoss + repairLoss;
    const annualSaving = annualLoss * (fin.reduce / 100);
    fin.annualLoss = annualLoss;
    fin.annualSaving = annualSaving;
    fin.hasInvestment = fin.investment > 0;
    fin.netBenefit = fin.hasInvestment ? annualSaving - fin.investment : null;
    fin.roi = fin.hasInvestment ? (fin.netBenefit / fin.investment) * 100 : null;
    fin.paybackMonths = fin.hasInvestment && annualSaving > 0 ? fin.investment / (annualSaving / 12) : Infinity;
    document.querySelector('#loss-result').textContent = fmtRp(annualLoss);
    document.querySelector('#saving-result').textContent = fmtRp(annualSaving);
    document.querySelector('#saving-month').textContent = fmtRp(annualSaving / 12);
    document.querySelector('#saving-3y').textContent = fmtRp(annualSaving * 3);
    document.querySelector('#enterprise-features-output').textContent = `${enterpriseFeatures.value} fitur`;
    const netBenefit = fin.netBenefit;
    const roi = fin.roi;
    document.querySelector('#net-benefit-result').textContent = fin.hasInvestment ? fmtRp(netBenefit) : '—';
    document.querySelector('#roi-result').textContent = roi === null ? '—' : `${Math.round(roi).toLocaleString('id-ID')}%`;
    const payback = fin.paybackMonths;
    document.querySelector('#payback-result').textContent = !fin.hasInvestment
      ? 'Estimasi balik modal akan dihitung dari biaya paket'
      : Number.isFinite(payback)
        ? `Balik modal indikatif dalam ${payback.toLocaleString('id-ID', { maximumFractionDigits: 1 })} bulan`
        : 'Belum balik modal pada asumsi penghematan ini';
    const guidance = document.querySelector('#roi-guidance');
    guidance.textContent = !fin.hasInvestment
      ? 'Pilih jumlah aset untuk menghitung estimasi biaya paket dan ROI.'
      : netBenefit > 0
        ? 'Pada asumsi yang Anda masukkan, potensi biaya terhindarkan melebihi estimasi biaya tahun pertama. Validasi target dan scope sebelum mengambil keputusan.'
        : 'Pada asumsi yang Anda masukkan, potensi biaya terhindarkan belum menutup estimasi biaya tahun pertama. Tinjau kembali asumsi atau cek kebutuhan sebelum mengambil keputusan.';
    updateCorrelation();
  };
  financialInputs.forEach((input) => {
    input?.addEventListener('input', () => { updateEstimatorVisibility(); updateFinancial(); });
    input?.addEventListener('change', () => { updateEstimatorVisibility(); updateFinancial(); });
  });

  const generatePdf = async () => {
    await document.fonts?.ready;
    const canvas = document.createElement('canvas');
      canvas.width = 1860;
      canvas.height = 2631;
      const ctx = canvas.getContext('2d');
      ctx.scale(1.5, 1.5);
      const colors = { navy: '#173b78', blue: '#1c4488', gold: '#f3b000', ink: '#263449', muted: '#718096', line: '#dce4ee', pale: '#f4f7fb', white: '#ffffff' };
      const annualLoss = fin.annualLoss;
      const annualSaving = fin.annualSaving;
      const date = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
      const roundRect = (x, y, w, h, r, fill, stroke) => {
        ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
        ctx.beginPath();
      };
      const text = (value, x, y, size, color = colors.ink, weight = 400) => {
        ctx.font = `${weight} ${size}px Inter, Arial, sans-serif`;
        ctx.fillStyle = color;
        ctx.fillText(value, x, y);
      };
      const paragraph = (value, x, y, maxWidth, lineHeight, size, color = colors.muted, weight = 400) => {
        ctx.font = `${weight} ${size}px Inter, Arial, sans-serif`;
        ctx.fillStyle = color;
        let line = '';
        let row = 0;
        value.split(' ').forEach((word) => {
          const next = line ? `${line} ${word}` : word;
          if (ctx.measureText(next).width > maxWidth && line) {
            ctx.fillText(line, x, y + row++ * lineHeight);
            line = word;
          } else line = next;
        });
        if (line) ctx.fillText(line, x, y + row * lineHeight);
        return row + 1;
      };
      const money = (value) => fmtRp(value);
      ctx.fillStyle = colors.white;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = colors.navy;
      ctx.fillRect(0, 0, 1240, 390);
      ctx.fillStyle = colors.gold;
      ctx.fillRect(0, 386, canvas.width, 6);
      roundRect(92, 70, 56, 56, 14, colors.gold);
      text('A', 110, 109, 34, colors.navy, 800);
      text('ASETA  |  ASSET & MAINTENANCE MANAGEMENT', 170, 103, 20, '#d9e5f7', 700);
      text('Ringkasan Simulasi ROI', 92, 205, 49, colors.white, 700);
      text('Potensi biaya breakdown terhindarkan vs biaya sistem', 92, 253, 27, '#d9e5f7', 400);
      text(`Dibuat ${date}`, 92, 322, 20, '#d9e5f7', 400);
      text('HASIL UTAMA', 92, 454, 18, colors.blue, 700);
      roundRect(92, 482, 506, 218, 18, colors.pale, colors.line);
      roundRect(620, 482, 528, 218, 18, '#fff9e9', '#f4dfaa');
      text('Estimasi kerugian tahunan berdasarkan input', 122, 535, 19, colors.muted, 500);
      text(money(annualLoss), 122, 603, 48, '#b3543f', 700);
      paragraph('Proyeksi berdasarkan downtime dan biaya perbaikan reaktif yang Anda masukkan.', 122, 650, 435, 27, 17);
      text('Potensi biaya terhindarkan / tahun', 650, 535, 19, colors.muted, 500);
      text(money(annualSaving), 650, 603, 48, colors.blue, 700);
      paragraph(`Proyeksi jika target pengurangan breakdown ${fin.reduce}% tercapai melalui preventive maintenance.`, 650, 650, 455, 27, 17);
      text('ROI INDIKATIF TAHUN PERTAMA', 92, 762, 18, colors.blue, 700);
      roundRect(92, 790, 1056, 112, 16, colors.white, colors.line);
      ctx.fillStyle = colors.line; ctx.fillRect(620, 790, 2, 112);
      text('Net benefit tahun pertama', 126, 833, 18, colors.muted, 500);
      text(fin.hasInvestment ? money(fin.netBenefit) : 'Pilih jumlah aset untuk estimasi', 126, 873, fin.hasInvestment ? 28 : 18, colors.ink, 700);
      text('ROI indikatif · biaya sistem tahun pertama', 664, 833, 18, colors.muted, 500);
      text(fin.hasInvestment ? `${Math.round(fin.roi)}%  ·  ${money(fin.investment)}` : 'Pilih jumlah aset', 664, 873, 24, colors.ink, 700);
      text('ASUMSI DAN HASIL SIMULASI', 92, 975, 18, colors.blue, 700);
      const rows = [
        ['Downtime operasi per bulan', `${fin.downtime} jam`],
        ['Biaya per jam downtime', money(fin.costPerHour)],
        ['Biaya perbaikan reaktif per bulan', money(fin.repair)],
        ['Target pengurangan breakdown', `${fin.reduce}%`],
        ['Potensi biaya terhindarkan per tahun', money(fin.annualSaving)],
        ['Estimasi total biaya sistem tahun pertama', fin.hasInvestment ? money(fin.investment) : 'Pilih jumlah aset'],
        ['Net benefit indikatif tahun pertama', fin.hasInvestment ? money(fin.netBenefit) : 'Pilih jumlah aset'],
        ['ROI indikatif tahun pertama', fin.roi !== null ? `${Math.round(fin.roi)}%` : 'Pilih jumlah aset untuk estimasi'],
        ['Estimasi balik modal', !fin.hasInvestment ? 'Pilih jumlah aset untuk estimasi' : Number.isFinite(fin.paybackMonths) ? `${fin.paybackMonths.toLocaleString('id-ID', { maximumFractionDigits: 1 })} bulan` : 'Tidak tercapai pada asumsi ini']
      ];
      rows.forEach(([label, value], index) => {
        const y = 1019 + index * 38;
        if (index % 2 === 0) { ctx.fillStyle = colors.pale; ctx.fillRect(92, y - 22, 1056, 34); }
        text(label, 116, y + 5, 19, colors.ink, 500);
        ctx.font = '700 19px Inter, Arial, sans-serif';
        ctx.fillStyle = colors.ink;
        ctx.textAlign = 'right'; ctx.fillText(value, 1118, y + 5); ctx.textAlign = 'left';
      });
      text('METODE PERHITUNGAN', 92, 1360, 18, colors.blue, 700);
      paragraph('Kerugian tahunan = (downtime bulanan × biaya downtime per jam × 12) + (biaya perbaikan reaktif bulanan × 12). Potensi biaya terhindarkan = kerugian tahunan × target pengurangan breakdown.', 92, 1395, 1040, 23, 15, colors.muted);
      paragraph('ROI tahun pertama = (potensi biaya terhindarkan selama 12 bulan − estimasi total biaya sistem tahun pertama) ÷ estimasi total biaya sistem tahun pertama × 100%. Net benefit = potensi biaya terhindarkan − biaya sistem. Balik modal membandingkan biaya tahun pertama dengan potensi bulanan yang diasumsikan merata. Target diasumsikan tercapai sepenuhnya. Nilai waktu tidak dimonetisasi agar tidak dihitung ganda.', 92, 1455, 1056, 22, 14, colors.muted);
      ctx.strokeStyle = colors.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(92, 1570); ctx.lineTo(1148, 1570); ctx.stroke();
      text('CATATAN', 92, 1607, 15, colors.blue, 700);
      paragraph('Simulasi indikatif, bukan hasil aktual, jaminan penghematan, audit finansial, atau penawaran harga. Estimasi biaya sistem dihitung dari acuan harga QR/RFID yang tersedia dan pilihan pengguna; validasi asumsi dan scope ke tim Aseta sebelum mengambil keputusan.', 92, 1642, 1056, 22, 14, colors.muted);
      text('Aseta · Kelola aset dengan data. Jaga operasi tetap berjalan.', 92, 1730, 15, colors.navy, 700);

      const jpeg = Uint8Array.from(atob(canvas.toDataURL('image/jpeg', 0.94).split(',')[1]), (char) => char.charCodeAt(0));
      const encoder = new TextEncoder();
      const chunks = [];
      let length = 0;
      const append = (chunk) => { chunks.push(chunk); length += chunk.length; };
      const addText = (value) => { const chunk = encoder.encode(value); append(chunk); if (chunk.length !== value.length) throw new Error('Karakter di luar rentang ASCII pada struktur PDF.'); };
      addText('%PDF-1.4\n');
      const offsets = [0];
      const object = (id, content) => { offsets[id] = length; addText(`${id} 0 obj\n${content}\nendobj\n`); };
      object(1, '<< /Type /Catalog /Pages 2 0 R >>');
      object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
      object(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
      offsets[4] = length;
      addText(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
      append(jpeg);
      addText('\nendstream\nendobj\n');
      const stream = encoder.encode('q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n');
      offsets[5] = length;
      addText(`5 0 obj\n<< /Length ${stream.length} >>\nstream\n`);
      append(stream);
      addText('endstream\nendobj\n');
      const xref = length;
      addText(`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
      return new Blob(chunks, { type: 'application/pdf' });
  };
  const downloadPdf = (pdf) => {
    const url = URL.createObjectURL(pdf);
    const link = document.createElement('a');
    link.href = url;
    link.download = `aseta-ringkasan-simulasi-${new Date().toISOString().slice(0, 10)}.pdf`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const makeLeadRequestId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const submitLeadToSheet = (data, requestId) => new Promise((resolve, reject) => {
    const endpoint = leadForm.dataset.leadEndpoint.trim();
    if (!endpoint) { reject(new Error('Integrasi Google Sheets belum dikonfigurasi.')); return; }
    let scriptUrl;
    try { scriptUrl = new URL(endpoint, window.location.href); }
    catch (error) { reject(new Error('URL Google Apps Script tidak valid. Periksa konfigurasi integrasi.')); return; }
    if (!['script.google.com', '127.0.0.1', 'localhost'].includes(scriptUrl.hostname) || (scriptUrl.hostname === 'script.google.com' && scriptUrl.protocol !== 'https:')) {
      reject(new Error('URL Google Apps Script tidak valid. Periksa konfigurasi integrasi.')); return;
    }
    const attemptId = makeLeadRequestId();
    const frame = document.createElement('iframe');
    const form = document.createElement('form');
    const cleanup = () => { clearTimeout(timeout); window.removeEventListener('message', onMessage); frame.remove(); form.remove(); };
    const timeout = setTimeout(() => { cleanup(); reject(new Error('Respons Google Sheets tidak diterima. Coba lagi.')); }, 20000);
    const onMessage = (event) => {
      const origin = new URL(event.origin);
      if (event.source === window || !(origin.origin === scriptUrl.origin || origin.hostname.endsWith('-script.googleusercontent.com'))) return;
      const result = event.data;
      if (result?.type !== 'aseta-lead-result' || result.requestId !== requestId || result.attemptId !== attemptId) return;
      cleanup();
      if (result.status === 'success') { retryLeadRequestId = ''; resolve(); }
      else reject(new Error('Data belum tersimpan di Google Sheets. Coba lagi.'));
    };
    frame.name = `aseta-lead-${attemptId}`;
    frame.hidden = true;
    form.action = scriptUrl.href;
    form.method = 'post';
    form.target = frame.name;
    form.acceptCharset = 'UTF-8';
    form.hidden = true;
    const fields = {
      ...data,
      phone: normalizePhone(data.phone),
      ...attributionFields,
      request_id: requestId,
      attempt_id: attemptId,
      website: '',
      consent: 'yes',
      downtime: String(fin.downtime),
      downtime_cost_per_hour: String(fin.costPerHour),
      reactive_repair_cost_monthly: String(fin.repair),
      breakdown_reduction_target: String(fin.reduce),
      annual_loss: String(fin.downtime * fin.costPerHour * 12 + fin.repair * 12),
      annual_saving: String(fin.annualSaving),
      annual_investment_estimate: fin.hasInvestment ? String(fin.investment) : '',
      annual_net_benefit_estimate: fin.hasInvestment ? String(fin.netBenefit) : '',
      roi_estimate_percent: fin.roi === null ? '' : String(Math.round(fin.roi)),
      payback_months_estimate: fin.hasInvestment && Number.isFinite(fin.paybackMonths) ? String(fin.paybackMonths) : '',
      time_capacity_hours_per_year: String(Math.round(Number(hoursRange.value) * .5) * 48),
      source: window.location.href,
      submitted_at: new Date().toISOString()
    };
    Object.entries(fields).forEach(([name, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden'; input.name = name; input.value = value;
      form.append(input);
    });
    window.addEventListener('message', onMessage);
    document.body.append(frame, form);
    form.submit();
  });
  leadForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!leadForm.reportValidity()) return;
    const button = document.querySelector('#lead-submit');
    const originalLabel = button.textContent;
    const status = document.querySelector('#download-status');
    const data = Object.fromEntries(new FormData(leadForm).entries());
    const requestId = retryLeadRequestId || makeLeadRequestId();
    leadError.hidden = true;
    button.disabled = true;
    button.textContent = 'Menyimpan data…';
    try {
      await submitLeadToSheet(data, requestId);
      button.textContent = 'Menyiapkan PDF…';
      try {
        currentPdf = await generatePdf();
      } catch (error) {
        retryLeadRequestId = requestId;
        throw new Error('Data sudah tersimpan. PDF gagal dibuat, silakan kirim ulang untuk mencoba kembali.');
      }
      downloadPdf(currentPdf);
      const message = [
        'Halo tim Aseta, saya baru saja menyelesaikan simulasi ROI pengelolaan aset dan ingin membahas langkah penerapannya.',
        '',
        `Nama: ${data.name.trim()}`,
        `Perusahaan: ${data.company.trim()}`,
        `Jabatan: ${data.position.trim()}`,
        ...assessmentProfileLines(),
        `WhatsApp: +${normalizePhone(data.phone)}`,
        `Estimasi kerugian operasional / tahun: ${fmtRp(fin.annualLoss)}`,
        `Potensi biaya terhindarkan / tahun: ${fmtRp(fin.annualSaving)}`,
        `Estimasi total biaya sistem tahun pertama: ${fin.hasInvestment ? fmtRp(fin.investment) : 'estimasi belum tersedia'}`,
        `Net benefit indikatif tahun pertama: ${fin.hasInvestment ? fmtRp(fin.netBenefit) : 'estimasi belum tersedia'}`,
        `ROI indikatif tahun pertama: ${fin.roi !== null ? `${Math.round(fin.roi)}%` : 'belum dihitung — biaya sistem belum diisi'}`,
        `Balik modal indikatif: ${fin.hasInvestment && Number.isFinite(fin.paybackMonths) ? `${fin.paybackMonths.toLocaleString('id-ID', { maximumFractionDigits: 1 })} bulan` : 'estimasi belum tersedia'}`,
        '',
        'Saya akan melampirkan PDF hasil simulasi pada chat ini.'
      ].join('\n');
      leadShareText = message;
      leadForm.hidden = true;
      leadNextStep.hidden = false;
      if (navigator.canShare?.({ files: [new File([currentPdf], 'aseta-ringkasan-simulasi.pdf', { type: 'application/pdf' })] })) {
        leadSharePdfButton.hidden = false;
      }
      status.textContent = 'Lead tersimpan dan PDF berhasil diunduh ✓';
      status.hidden = false;
    } catch (error) {
      if (error.message.startsWith('Data belum tersimpan di Google Sheets') || error.message.startsWith('Respons Google Sheets tidak diterima')) retryLeadRequestId = requestId;
      leadError.textContent = error.message || 'Data belum berhasil disimpan. Silakan coba lagi.';
      leadError.hidden = false;
      button.disabled = false;
      button.textContent = originalLabel;
    }
  });

  const updateCorrelation = () => {
    const el = document.querySelector('#time-correlation');
    if (!el) return;
    const hours = Number(document.querySelector('#hours-range')?.value || 0);
    const annual = Math.round(hours * .5) * 48;
    el.textContent = hours > 0
      ? `Dengan asumsi separuh waktu rekap/koordinasi dapat dialihkan, proyeksinya ${annual.toLocaleString('id-ID')} jam/tahun. Ini bukan pengukuran penghematan aktual.`
      : 'Masukkan jam kerja manual yang benar-benar terjadi untuk melihat proyeksi waktu yang dapat dialihkan.';
  };
  const updateCalculator = () => {
    const assets = Number(assetRange.value);
    const hours = Number(hoursRange.value);
    document.querySelector('#asset-output').textContent = assets.toLocaleString('id-ID');
    document.querySelector('#hours-output').textContent = `${hours} jam`;
    document.querySelector('#saved-hours').textContent = `${Math.round(hours * .5)} jam/minggu`;
    document.querySelector('#focus-result').textContent = assets > 1000 ? 'Lintas lokasi & SLA' : hours > 12 ? 'Backlog & koordinasi' : 'Preventive & backlog';
    updateCorrelation();
  };
  assetRange?.addEventListener('input', updateCalculator); hoursRange?.addEventListener('input', updateCalculator);
  menu?.addEventListener('click', () => { const open = menu.getAttribute('aria-expanded') === 'true'; menu.setAttribute('aria-expanded', String(!open)); nav.classList.toggle('open', !open); });
  nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => { menu?.setAttribute('aria-expanded', 'false'); nav.classList.remove('open'); }));
  renderAssessmentStep(); updateCalculator(); updateFinancial();
})();
