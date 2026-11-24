# Equiteam – Test: SCAM sau LEGITIM (Nivel expert)

Aplicație web Google Apps Script: `Code.gs` (backend + salvare în Google Docs) și `index.html` (interfața).

## Deploy în 4 pași

1. **Creează proiectul.** Intră pe [script.google.com](https://script.google.com) → *New project*. Lipește conținutul lui `Code.gs` în fișierul `Code.gs`. Apasă **+ → HTML**, numește fișierul exact `index` și lipește conținutul lui `index.html`. Salvează (Ctrl/Cmd + S).
2. **Alege documentul (opțional).** Dacă vrei un Google Doc anume, pune ID-ul lui în `const DOC_ID = "..."` (partea dintre `/d/` și `/edit` din link). Dacă lași textul `PUNE_AICI_ID_UL_DOCUMENTULUI_TAU_DOCS`, scriptul creează automat documentul „Rezultate Test SCAM sau LEGITIM - Equiteam” în Drive-ul tău.
3. **Acordă permisiunile pentru Google Docs.** În bara de sus selectează funcția `autorizeazaSiTesteaza` și apasă **▶ Run** → *Review permissions* → alege contul → *Advanced* → *Go to … (unsafe)* → **Allow**. În *Execution log* apare link-ul documentului de rezultate.
4. **Publică.** **Deploy → New deployment** → tip **Web app** → *Execute as:* **Me** → *Who has access:* **Anyone** → **Deploy**. Copiază link-ul `/exec` și pune-l în codul QR. După orice modificare: *Deploy → Manage deployments → ✏️ → Version: New version → Deploy* (link-ul rămâne același).
