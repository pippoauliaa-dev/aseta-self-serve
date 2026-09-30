"""Generate the internal Aseta assessment decision-map PDF (not for publication).

Reads the real browser evaluator from aseta-assessment-rules.js, renders every
possible state into a temporary HTML matrix, and prints it to PDF with headless
Chrome. Output defaults to %USERPROFILE%/Downloads/ (outside the repository).
"""

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RULES_PATH = ROOT / "aseta-assessment-rules.js"
DEFAULT_OUTPUT = Path(os.environ.get("USERPROFILE", str(Path.home()))) / "Downloads" / "aseta-assessment-decision-map-internal.pdf"

HEAD = """<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>Peta Keputusan Assessment Aseta (Internal)</title>
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;margin:30px;color:#1e293b}
  h1{font-size:19px;margin:0 0 4px}
  .meta{font-size:11px;color:#64748b;margin-bottom:12px}
  .summary{font-size:11px;line-height:1.6;background:#f1f5f9;border:1px solid #cbd5e1;padding:10px 12px;margin-bottom:12px;white-space:pre-wrap}
  table{border-collapse:collapse;width:100%;font-size:9px}
  th,td{border:1px solid #cbd5e1;padding:3px 5px;text-align:left;vertical-align:top}
  th{background:#1c4488;color:#fff}
  tr{page-break-inside:avoid}
  .mask{white-space:nowrap;font-family:Consolas,monospace}
  .enterprise{color:#1c4488;font-weight:700}
  .essentials{color:#047857;font-weight:700}
  .not-needed{color:#b45309;font-weight:700}
  .invalid{color:#b91c1c;font-weight:700}
</style>
</head>
<body>
<h1>Peta Keputusan Assessment Aseta — Internal</h1>
<div class="meta">Dokumen internal. Bukan untuk dipublikasikan atau ditautkan dari halaman publik.
Klasifikasi berdasarkan perbandingan fitur yang disediakan pengguna, belum divalidasi terhadap produksi.</div>
<div class="summary" id="decision-summary"></div>
<table>
<thead><tr><th>#</th><th>State</th><th>Fitur terpilih</th><th>Rekomendasi</th><th>Alasan</th></tr></thead>
<tbody id="decision-rows"></tbody>
</table>
<script src="RULES_SRC"></script>
<script>
(() => {
  const api = window.AsetaAssessment;
  const featureIds = api.needs.map((n) => n.id);
  const labelOf = (id) => (api.needs.find((n) => n.id === id) || {}).label || id;
  const labels = { enterprise: 'Aseta Enterprise', essentials: 'Aseta Essentials',
                   'not-needed': 'Belum membutuhkan Aseta', invalid: 'Invalid' };
  const rows = [];
  const totals = { enterprise: 0, essentials: 0, 'not-needed': 0, invalid: 0 };
  const push = (stateLabel, selectedIds, result) => {
    const rec = result.valid ? result.recommendation : 'invalid';
    totals[rec] += 1;
    rows.push({
      state: stateLabel,
      features: selectedIds.length ? selectedIds.map(labelOf).join('; ') : '(tidak ada)',
      recommendation: rec,
      display: labels[rec],
      reasons: result.reasons.join(' ') || '-'
    });
  };
  for (let mask = 0; mask < 512; mask += 1) {
    const selectedIds = featureIds.filter((_, i) => mask & (1 << i));
    push('mask ' + mask.toString(2).padStart(9, '0'), selectedIds, api.evaluate(selectedIds, false));
  }
  push('no-need', [], api.evaluate([], true));
  document.getElementById('decision-summary').textContent =
    'Total states: ' + rows.length + '\\n' +
    'Enterprise: ' + totals.enterprise + ' | Essentials: ' + totals.essentials +
    ' | Not-needed: ' + totals['not-needed'] + ' | Invalid: ' + totals.invalid + '\\n' +
    'Precedence: validasi input -> no-need eksklusif -> fitur Enterprise terpilih -> Essentials. ' +
    'Tidak ada ambang jumlah aset atau harga.';
  document.getElementById('decision-rows').innerHTML = rows.map((row, i) =>
    '<tr data-state-row="1"><td>' + (i + 1) + '</td><td>' + row.state + '</td><td>' + row.features +
    '</td><td class="' + row.recommendation + '">' + row.display + '</td><td>' + row.reasons + '</td></tr>'
  ).join('');
})();
</script>
</body>
</html>
"""


def chrome_executable():
    candidates = [
        os.environ.get("CHROME_PATH"),
        shutil.which("chrome"),
        shutil.which("chrome.exe"),
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.join(os.environ.get("LOCALAPPDATA", ""), "Google", "Chrome", "Application", "chrome.exe"),
    ]
    return next((c for c in candidates if c and Path(c).is_file()), None)


def main():
    parser = argparse.ArgumentParser(description="Generate the internal assessment decision-map PDF.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="PDF output path (outside the repository)")
    parser.add_argument("--html-output", type=Path, default=None, help="Also write the diagnostic HTML matrix here")
    args = parser.parse_args()

    chrome = chrome_executable()
    if not chrome:
        sys.exit("Google Chrome not found; set CHROME_PATH to chrome.exe")

    rules_src = RULES_PATH.resolve().as_uri()
    html = HEAD.replace("RULES_SRC", rules_src)
    # file:// PDF printing works from a temp file next to nothing else
    with tempfile.TemporaryDirectory(prefix="aseta-decision-map-") as tmp:
        html_path = Path(tmp) / "decision-map.html"
        html_path.write_text(html, encoding="utf-8")
        if args.html_output:
            args.html_output.parent.mkdir(parents=True, exist_ok=True)
            args.html_output.write_text(html, encoding="utf-8")
        args.output.parent.mkdir(parents=True, exist_ok=True)
        profile = Path(tmp) / "chrome-profile"
        process = subprocess.run(
            [chrome, "--headless", "--disable-gpu", f"--user-data-dir={profile}",
             "--no-pdf-header-footer", f"--print-to-pdf={args.output}", html_path.as_uri()],
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=120,
            check=False,
        )
        if process.returncode != 0:
            sys.exit(process.stderr or process.stdout or "chrome failed")
    if not args.output.is_file() or args.output.stat().st_size < 1024:
        sys.exit("PDF was not written or is too small")
    print(f"PDF written: {args.output} ({args.output.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
