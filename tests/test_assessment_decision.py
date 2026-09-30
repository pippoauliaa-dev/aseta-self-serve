import html.parser
import json
import os
import shutil
import subprocess
import tempfile
import threading
import unittest
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUNNER_PATH = "/__assessment_test_runner__.html"
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


class RunnerHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
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
        app_tag = '<script src="aseta-self-serve.js"></script>'
        self.assertIn(rules_tag, index_html)
        self.assertIn(app_tag, index_html)
        self.assertLess(index_html.index(rules_tag), index_html.index(app_tag))


if __name__ == "__main__":
    unittest.main()
