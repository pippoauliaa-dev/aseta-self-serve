(() => {
  const needs = [
    { id: 'register', label: 'Registrasi/tagging aset (RFID / QR Code / barcode)', tier: 'essentials' },
    { id: 'stock-audit', label: 'Stock opname atau audit fisik melalui scanner', tier: 'essentials' },
    { id: 'location-pic', label: 'Pelacakan lokasi aset dan penanggung jawab/PIC', tier: 'essentials' },
    { id: 'basic-relocation', label: 'Mutasi atau relokasi aset biasa', tier: 'essentials' },
    { id: 'depreciation', label: 'Depresiasi otomatis aset', tier: 'enterprise' },
    { id: 'maintenance', label: 'Preventive/corrective maintenance dan penanganan ticket/work-order', tier: 'enterprise' },
    { id: 'borrowing-disposal', label: 'Peminjaman dan disposal/write-off aset formal', tier: 'enterprise' },
    { id: 'cross-branch-approval', label: 'Approval mutasi lintas cabang / multi-branch control', tier: 'enterprise' },
    { id: 'erp-integration', label: 'Integrasi dengan ERP/accounting via API', tier: 'enterprise' }
  ];
  const noNeedId = 'no-need';
  const needsById = new Map(needs.map((need) => [need.id, need]));
  const invalid = (reasons = []) => ({ valid: false, recommendation: null, reasons });

  const evaluate = (selectedIds, noNeedSelected) => {
    if (!Array.isArray(selectedIds)) return invalid();
    if (noNeedSelected && selectedIds.length) return invalid();
    if (selectedIds.some((id) => !needsById.has(id))) return invalid(['Pilihan kebutuhan tidak dikenal.']);
    if (noNeedSelected) {
      return {
        valid: true,
        recommendation: 'not-needed',
        reasons: ['Proses saat ini masih terkendali dan belum ada rencana perubahan.']
      };
    }
    if (!selectedIds.length) return invalid();

    const selectedNeeds = needs.filter((need) => selectedIds.includes(need.id));
    const enterpriseNeeds = selectedNeeds.filter((need) => need.tier === 'enterprise');
    if (enterpriseNeeds.length) {
      return {
        valid: true,
        recommendation: 'enterprise',
        reasons: [
          ...enterpriseNeeds.map((need) => need.label),
          'Aseta Enterprise mencakup kapabilitas Aseta Essentials.'
        ]
      };
    }
    return {
      valid: true,
      recommendation: 'essentials',
      reasons: selectedNeeds.map((need) => need.label)
    };
  };

  window.AsetaAssessment = { needs, noNeedId, evaluate };
})();
