# Aseta Self-Serve

Landing page interaktif Aseta untuk self-assessment dan simulasi nilai asset & maintenance management.

## Demo online

Setelah GitHub Pages aktif, halaman dapat dibuka di:

`https://pippoauliaa-dev.github.io/aseta-self-serve/#simulator`

## Konfigurasi endpoint Google Sheets di halaman

Setelah deployment Apps Script siap, ganti nilai `data-lead-endpoint=""` pada form `#simulator-lead-form` di `index.html` dengan URL `/exec` yang diberikan Apps Script. Tanpa URL ini, situs akan menolak unduh PDF dan menunjukkan pesan bahwa integrasi belum dikonfigurasi.

## Menjalankan lokal

Buka `index.html` di browser, atau jalankan static server sederhana:

```bash
python -m http.server 8000
```

Lalu buka <http://localhost:8000/#simulator>.

Semua kalkulasi berjalan di browser. Data yang digunakan pada dashboard adalah data demo.

## Aktifkan pencatatan lead ke Google Sheets

Alur form simulator mencatat lead sebelum PDF diunduh. Siapkan endpoint-nya satu kali:

1. Buat Google Sheet baru khusus lead. Salin ID dari URL antara `/d/` dan `/edit`.
2. Buka <https://script.google.com>, buat proyek Apps Script, lalu ganti isi `Code.gs` dengan `google-apps-script/Code.gs` dari repo ini.
3. Tambahkan file HTML baru bernama `Response`, lalu salin isi `google-apps-script/Response.html`.
4. Buka **Project Settings → Script Properties → Add script property**. Isi `LEADS_SHEET_ID` sebagai property dan ID sheet sebagai value.
5. Di Apps Script, pilih **Deploy → New deployment → Web app**. Jalankan sebagai akun pemilik script, beri akses **Anyone**, lalu deploy dan setujui otorisasi Google Sheets.
6. Salin URL `/exec` deployment. Masukkan URL itu ke atribut `data-lead-endpoint` pada `#simulator-lead-form` di `index.html`, lalu deploy ulang GitHub Pages.
7. Uji form live. Baris pertama tab `Leads` dibuat otomatis. Jangan membagikan akses edit sheet kepada publik.
8. Setiap kali kode Apps Script berubah, pilih **Deploy → Manage deployments → Edit → New version → Deploy** agar deployment publik memakai versi terbaru.

Endpoint memeriksa asal situs dan persetujuan, mengunci penulisan paralel, mencegah duplikasi saat retry, menetralkan input formula spreadsheet, dan membalas lewat iframe terbatas asal. Endpoint publik berpotensi disalahgunakan untuk spam atau kuota Apps Script; pantau Sheet/Apps Script dan hentikan deployment jika trafik mencurigakan.

Nomor WhatsApp penerima saat ini memakai nomor tim Aseta yang sudah ada di halaman. Browser membuka chat dengan sapaan terisi. Di perangkat yang mendukung Web Share API untuk berbagi file, customer juga dapat memilih **Bagikan PDF ke WhatsApp**; WhatsApp tetap meminta customer memilih chat dan mengirim. Jika fitur share file tidak tersedia, customer melampirkan PDF yang sudah diunduh secara manual.

## Tes alur lead

Tes browser membutuhkan Playwright dan Chromium tersedia pada environment Python aktif:

```bash
python -m unittest discover -s tests -p test_lead_flow.py -v
```
