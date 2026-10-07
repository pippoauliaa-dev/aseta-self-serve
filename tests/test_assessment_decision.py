import html.parser
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import unittest
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUNNER_PATH = "/__assessment_test_runner__.html"
BROWSER_RUNNER_PATH = "/__assessment_browser_test_runner__.html"
EXPECTED_NEEDS = {
    "register": "essentials",
    "stock-audit": "essentials",
    "location-pic": "essentials",
    "basic-relocation": "essentials",
    "depreciation": "enterprise",
    "maintenance": "enterprise",
    "borrowing-disposal": "enterprise",
    "cross-branch-approval": "enterprise",
    "erp-integration": "enterprise",
}

RUNNER_HTML = """<!doctype html>
<meta charset="utf-8">
<pre id="assessment-report"></pre>
<script src="/aseta-assessment-rules.js"></script>
<script>
(() => {
  const publish = (report) => {
    document.querySelector('#assessment-report').textContent = JSON.stringify(report);
  };
  const api = window.AsetaAssessment;
  if (!api || !Array.isArray(api.needs) || typeof api.evaluate !== 'function') {
    publish({ error: 'AsetaAssessment interface unavailable' });
    return;
  }
  try {
    const featureIds = api.needs.map((need) => need.id);
    const featureStates = [];
    for (let mask = 0; mask < 512; mask += 1) {
      const selectedIds = featureIds.filter((_, index) => mask & (1 << index));
      featureStates.push({ mask, selectedIds, result: api.evaluate(selectedIds, false) });
    }
    publish({
      needs: api.needs,
      noNeedId: api.noNeedId,
      featureStates,
      noNeedState: api.evaluate([], true),
      mixedNoNeedStates: featureIds.map((id) => api.evaluate([id], true)),
      unknownState: api.evaluate(['unknown-feature'], false),
      knownAndUnknownState: api.evaluate([featureIds[0], 'unknown-feature'], false)
    });
  } catch (error) {
    publish({ error: `${error.name}: ${error.message}` });
  }
})();
</script>
"""

BROWSER_FLOW_SCRIPT = r"""<script>
(() => {
  const report = {};
  const main = document.querySelector('main');
  const assessment = document.querySelector('#assessment');
  const needs = [...document.querySelectorAll('#assessment input[type="checkbox"][data-need-id]')];
  const noNeed = document.querySelector('#assessment input[data-no-need]');
  const submit = document.querySelector('#assessment-submit');
  const result = document.querySelector('#assessment-result');
  const title = document.querySelector('#result-plan');
  const reason = document.querySelector('#result-reason');
  const validation = document.querySelector('#assessment-validation');
  const firstSection = [...(main?.children || [])].find((child) => child.tagName === 'SECTION');
  report.firstMainSection = firstSection?.id || (firstSection?.classList.contains('conversion-intro') ? 'conversion-intro' : null);
  if (!report.firstMainSection && document.querySelector('main > .conversion-intro')) report.firstMainSection = 'conversion-intro';
  report.h1Count = document.querySelectorAll('h1').length;
  report.needIds = needs.map((input) => input.dataset.needId);
  report.hasNoNeedChoice = Boolean(noNeed);
  report.hasSubmit = Boolean(submit);
  report.hasResult = Boolean(result && title && reason);
  report.hasValidation = Boolean(validation);
  if (noNeed && needs.length && submit && result && title && reason && validation) {
    document.querySelector('#assessment-next').click();
    document.querySelector('#assessment-next').click();
    report.emptyValidationVisible = !validation.hidden && Boolean(validation.textContent.trim());
    report.emptyHasNoRecommendation = result.hidden || !title.textContent.trim();
    document.querySelector('#assessment-back').click();
    noNeed.click();
    report.noNeedClearsFeatures = needs.every((input) => !input.checked);
    report.noNeedDisablesFeatures = needs.every((input) => input.disabled);
    noNeed.click();
    report.featureClearsNoNeed = !noNeed.checked && needs.every((input) => !input.disabled);
    document.querySelector('#assessment-back').click();
    needs.find((input) => input.dataset.needId === 'register').click();
    document.querySelector('#assessment-next').click();
    document.querySelector('#assessment-next').click();
    document.querySelector('#profile-assets').value = '201–1.000';
    document.querySelector('#profile-system').value = 'Spreadsheet (Excel/Google Sheets)';
    document.querySelector('#profile-branches').value = '2–5 cabang';
    submit.click();
    report.essentialsLabel = title.textContent.trim();
    report.essentialsReason = reason.textContent.trim();
    document.querySelector('#assessment-back').click();
    document.querySelector('#assessment-back').click();
    needs.find((input) => input.dataset.needId === 'register').click();
    needs.find((input) => input.dataset.needId === 'depreciation').click();
    needs.find((input) => input.dataset.needId === 'maintenance').click();
    document.querySelector('#assessment-next').click();
    document.querySelector('#assessment-next').click();
    document.querySelector('#profile-assets').value = '201–1.000';
    document.querySelector('#profile-system').value = 'Spreadsheet (Excel/Google Sheets)';
    document.querySelector('#profile-branches').value = '2–5 cabang';
    submit.click();
    report.enterpriseLabel = title.textContent.trim();
    report.enterpriseReason = reason.textContent.trim();
  }
  const leadForm = document.querySelector('#simulator-lead-form');
  report.requiredLeadFields = ['name', 'email', 'company', 'position', 'phone', 'consent']
    .filter((name) => leadForm?.querySelector(`[name="${name}"]`)?.required);
  report.preservedIds = ['simulator', 'download-pdf', 'download-status', 'lead-dialog',
    'simulator-lead-form', 'lead-error', 'lead-next-step', 'share-whatsapp', 'share-pdf',
    'demo-modal', 'sales-contact-form'].filter((id) => document.getElementById(id));
  document.body.insertAdjacentHTML('beforeend', `<pre id="assessment-report">${JSON.stringify(report)}</pre>`);
})();
</script>
"""


class RunnerHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if self.path == BROWSER_RUNNER_PATH:
            html = (ROOT / "index.html").read_text(encoding="utf-8")
            html = html.replace('<script src="aseta-self-serve-v2.js"></script>', '<script src="/aseta-self-serve-v2.js"></script>')
            body = html.replace("</body>", f"{BROWSER_FLOW_SCRIPT}</body>").encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path == RUNNER_PATH:
            body = RUNNER_HTML.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def log_message(self, *_args):
        pass


class ReportParser(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_report = False
        self.parts = []

    def handle_starttag(self, tag, attrs):
        self.in_report = tag == "pre" and dict(attrs).get("id") == "assessment-report"

    def handle_endtag(self, tag):
        if tag == "pre":
            self.in_report = False

    def handle_data(self, data):
        if self.in_report:
            self.parts.append(data)


def chrome_executable():
    candidates = [
        os.environ.get("CHROME_PATH"),
        shutil.which("chrome"),
        shutil.which("chrome.exe"),
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.join(os.environ.get("LOCALAPPDATA", ""), "Google", "Chrome", "Application", "chrome.exe"),
    ]
    return next((candidate for candidate in candidates if candidate and Path(candidate).is_file()), None)


class AssessmentDecisionTests(unittest.TestCase):
    def test_all_assessment_decision_states(self):
        chrome = chrome_executable()
        if not chrome:
            self.skipTest("Google Chrome was not found; set CHROME_PATH to chrome.exe")

        server = ThreadingHTTPServer(("127.0.0.1", 0), RunnerHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            url = f"http://127.0.0.1:{server.server_port}{RUNNER_PATH}"
            with tempfile.TemporaryDirectory(prefix="aseta-assessment-chrome-") as profile:
                process = subprocess.run(
                    [
                        chrome,
                        "--headless",
                        "--disable-gpu",
                        f"--user-data-dir={profile}",
                        "--dump-dom",
                        url,
                    ],
                    capture_output=True,
                    text=True,
                    timeout=30,
                    check=False,
                )
            self.assertEqual(process.returncode, 0, process.stderr)
            parser = ReportParser()
            parser.feed(process.stdout)
            self.assertTrue(parser.parts, process.stdout[-2000:])
            report = json.loads("".join(parser.parts))
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

        self.assertNotIn("error", report, report.get("error"))
        self.assertEqual(report["noNeedId"], "no-need")
        needs = report["needs"]
        self.assertEqual(
            [(need["id"], need["tier"]) for need in needs],
            list(EXPECTED_NEEDS.items()),
        )
        self.assertTrue(all(isinstance(need.get("label"), str) and need["label"] for need in needs))

        feature_states = report["featureStates"]
        self.assertEqual(len(feature_states), 512)
        totals = {"enterprise": 0, "essentials": 0, "not-needed": 0, "invalid": 0}
        valid_count = 0
        for state in feature_states:
            mask = state["mask"]
            selected_ids = state["selectedIds"]
            result = state["result"]
            expected_ids = [
                need_id
                for index, need_id in enumerate(EXPECTED_NEEDS)
                if mask & (1 << index)
            ]
            self.assertEqual(selected_ids, expected_ids)
            selected_enterprise = [
                need["label"]
                for need in needs
                if need["id"] in selected_ids and need["tier"] == "enterprise"
            ]
            selected_essentials = [
                need["label"]
                for need in needs
                if need["id"] in selected_ids and need["tier"] == "essentials"
            ]
            reasons = result.get("reasons", [])
            if isinstance(reasons, str):
                reasons = [reasons]
            reason_text = " ".join(reasons)

            if selected_enterprise:
                self.assertTrue(result["valid"], mask)
                valid_count += 1
                self.assertEqual(result["recommendation"], "enterprise", mask)
                for label in selected_enterprise:
                    self.assertIn(label, reason_text, mask)
                self.assertIn("Essentials", reason_text, mask)
                totals["enterprise"] += 1
            elif selected_essentials:
                self.assertTrue(result["valid"], mask)
                valid_count += 1
                self.assertEqual(result["recommendation"], "essentials", mask)
                for label in selected_essentials:
                    self.assertIn(label, reason_text, mask)
                totals["essentials"] += 1
            else:
                self.assertFalse(result["valid"], mask)
                self.assertIsNone(result["recommendation"], mask)
                totals["invalid"] += 1

        self.assertEqual(
            totals,
            {"enterprise": 496, "essentials": 15, "not-needed": 0, "invalid": 1},
        )
        self.assertEqual(sum(totals.values()), 512)
        self.assertEqual(valid_count, 511)
        self.assertEqual(totals["invalid"], 1)

        single_states = {state["selectedIds"][0]: state["result"] for state in feature_states if len(state["selectedIds"]) == 1}
        self.assertEqual(len(single_states), 9)
        for need_id, tier in EXPECTED_NEEDS.items():
            self.assertTrue(single_states[need_id]["valid"], need_id)
            self.assertEqual(single_states[need_id]["recommendation"], tier, need_id)

        no_need = report["noNeedState"]
        self.assertTrue(no_need["valid"])
        valid_count += 1
        self.assertEqual(no_need["recommendation"], "not-needed")
        self.assertEqual(len(report["mixedNoNeedStates"]), 9)
        for result in report["mixedNoNeedStates"]:
            self.assertFalse(result["valid"])
            self.assertIsNone(result["recommendation"])
        for key in ("unknownState", "knownAndUnknownState"):
            self.assertFalse(report[key]["valid"], key)
            self.assertIsNone(report[key]["recommendation"], key)

        totals["not-needed"] = 1
        totals["invalid"] = 1
        self.assertEqual(
            totals,
            {"enterprise": 496, "essentials": 15, "not-needed": 1, "invalid": 1},
        )
        self.assertEqual(sum(totals.values()), 513)
        self.assertEqual(valid_count, 512)

        index_html = (ROOT / "index.html").read_text(encoding="utf-8")
        rules_tag = '<script src="aseta-assessment-rules.js"></script>'
        app_tag = '<script src="aseta-self-serve-v2.js"></script>'
        self.assertIn(rules_tag, index_html)
        self.assertIn(app_tag, index_html)
        self.assertLess(index_html.index(rules_tag), index_html.index(app_tag))

    def test_calculator_first_assessment_browser_flow(self):
        chrome = chrome_executable()
        if not chrome:
            self.skipTest("Google Chrome was not found; set CHROME_PATH to chrome.exe")

        server = ThreadingHTTPServer(("127.0.0.1", 0), RunnerHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            url = f"http://127.0.0.1:{server.server_port}{BROWSER_RUNNER_PATH}"
            with tempfile.TemporaryDirectory(prefix="aseta-assessment-browser-") as profile:
                process = subprocess.run(
                    [chrome, "--headless", "--disable-gpu", f"--user-data-dir={profile}", "--dump-dom", url],
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    timeout=30,
                    check=False,
                )
            self.assertEqual(process.returncode, 0, process.stderr)
            parser = ReportParser()
            parser.feed(process.stdout)
            self.assertTrue(parser.parts, process.stdout[-2000:])
            report = json.loads("".join(parser.parts))
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

        self.assertEqual(report["firstMainSection"], "conversion-intro")
        self.assertEqual(report["h1Count"], 1)
        self.assertEqual(report["needIds"], list(EXPECTED_NEEDS))
        self.assertTrue(report["hasNoNeedChoice"])
        self.assertTrue(report["hasSubmit"])
        self.assertTrue(report["hasResult"])
        self.assertTrue(report["hasValidation"])
        self.assertTrue(report["noNeedClearsFeatures"])
        self.assertTrue(report["noNeedDisablesFeatures"])
        self.assertTrue(report["featureClearsNoNeed"])
        self.assertTrue(report["emptyValidationVisible"])
        self.assertTrue(report["emptyHasNoRecommendation"])
        self.assertEqual(report["essentialsLabel"], "Aseta Essentials")
        self.assertIn("Registrasi/tagging aset", report["essentialsReason"])
        self.assertEqual(report["enterpriseLabel"], "Aseta Enterprise")
        self.assertIn("Depresiasi otomatis aset", report["enterpriseReason"])
        self.assertIn("Preventive/corrective maintenance", report["enterpriseReason"])
        self.assertEqual(
            report["requiredLeadFields"],
            ["name", "email", "company", "position", "phone", "consent"],
        )
        self.assertEqual(
            report["preservedIds"],
            ["simulator", "download-pdf", "download-status", "lead-dialog", "simulator-lead-form",
             "lead-error", "lead-next-step", "share-whatsapp", "share-pdf", "demo-modal", "sales-contact-form"],
        )


    def test_generate_decision_map_pdf(self):
        chrome = chrome_executable()
        if not chrome:
            self.skipTest("Google Chrome was not found; set CHROME_PATH to chrome.exe")

        generator = ROOT / "tools" / "generate_assessment_decision_map.py"
        with tempfile.TemporaryDirectory(prefix="aseta-decision-map-") as tmp:
            tmp_path = Path(tmp)
            pdf_path = tmp_path / "decision-map.pdf"
            html_path = tmp_path / "decision-map.html"
            process = subprocess.run(
                [sys.executable, str(generator), "--output", str(pdf_path), "--html-output", str(html_path)],
                capture_output=True,
                text=True,
                encoding="utf-8",
                timeout=120,
                check=False,
            )
            self.assertEqual(process.returncode, 0, process.stderr or process.stdout)
            self.assertTrue(pdf_path.is_file(), "generator did not write the PDF")
            pdf_header = pdf_path.read_bytes()[:5]
            self.assertEqual(pdf_header, b"%PDF-")
            self.assertGreater(pdf_path.stat().st_size, 50_000, "PDF is suspiciously small")
            self.assertTrue(html_path.is_file(), "generator did not write the diagnostic HTML")

            with tempfile.TemporaryDirectory(prefix="aseta-decision-map-profile-") as profile:
                rendered = subprocess.run(
                    [chrome, "--headless", "--disable-gpu", f"--user-data-dir={profile}",
                     "--dump-dom", html_path.as_uri()],
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    timeout=60,
                    check=False,
                )
            self.assertEqual(rendered.returncode, 0, rendered.stderr)
            body_without_scripts = re.sub(r"<script>.*?</script>", "", rendered.stdout, flags=re.S)
            self.assertEqual(body_without_scripts.count('data-state-row="1"'), 513, "expected 513 state rows")
            for fragment in (
                "496", "15", "Aseta Enterprise", "Aseta Essentials",
                "Belum membutuhkan Aseta", "invalid",
            ):
                self.assertIn(fragment, rendered.stdout)


if __name__ == "__main__":
    unittest.main()
