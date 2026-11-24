/**
 * Equiteam – „Ce nu ne învață nimeni despre bani?”
 * Test: SCAM sau LEGITIM – Nivel expert
 *
 * Backend Google Apps Script: servește pagina web și salvează rezultatele
 * fiecărui participant într-un Google Doc.
 */

/**
 * ID-ul Google Doc-ului în care se salvează rezultatele.
 * Îl găsești în link-ul documentului:
 *   https://docs.google.com/document/d/<AICI_ESTE_ID-UL>/edit
 *
 * Dacă lași valoarea de mai jos neschimbată (sau goală), scriptul creează
 * automat un document nou numit „Rezultate Test SCAM sau LEGITIM - Equiteam”
 * la prima completare și îl refolosește pentru toate completările următoare.
 */
const DOC_ID = "PUNE_AICI_ID_UL_DOCUMENTULUI_TAU_DOCS";

const DOC_ID_PLACEHOLDER = "PUNE_AICI_ID_UL_DOCUMENTULUI_TAU_DOCS";
const NUME_DOC_AUTOMAT = "Rezultate Test SCAM sau LEGITIM - Equiteam";
const CHEIE_DOC_ID = "EQUITEAM_DOC_ID";
const FUS_ORAR = "Europe/Bucharest";

/** Cheia de răspunsuri – trebuie să fie identică cu cea din index.html. */
const INTREBARI = [
  { titlu: "Transferul bancar neașteptat", corect: "A" },
  { titlu: "Oferta de colaborare și taxa de instruire", corect: "B" },
  { titlu: "Autentificarea în doi pași", corect: "A" },
  { titlu: "Achiziția unui produs second-hand", corect: "B" },
  { titlu: "Investiția printr-o platformă cunoscută", corect: "A" },
  { titlu: "Rambursarea unei plăți", corect: "B" }
];

const ETICHETE = { A: "SCAM", B: "LEGITIM" };

/** Etichetele rândurilor din sumarul statistic de la începutul documentului. */
const ET_PARTICIPANTI = "Participanți totali:";
const ET_MEDIE_INCREDERE = "Media încrederii inițiale:";
const ET_MEDIE_SCOR = "Media scorului real:";
const ET_ACTUALIZAT = "Ultima actualizare:";
const ET_TITLU_SUMAR = "SUMAR STATISTIC";

/**
 * Servește aplicația web.
 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile("index")
    .setTitle("SCAM sau LEGITIM · Equiteam")
    .addMetaTag("viewport", "width=device-width, initial-scale=1, viewport-fit=cover")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Salvează răspunsurile unui participant în Google Doc.
 *
 * @param {Object} payload {
 *   timestamp: string (ISO),
 *   incredereInitiala: number (1-10),
 *   raspunsuri: string[] (6 valori „A” sau „B”),
 *   scorTotal: number (0-6)
 * }
 * @return {Object} { ok: true, scorTotal, participantNr, docUrl }
 */
function salveazaRaspuns(payload) {
  const date = valideazaPayload_(payload);

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (err) {
    throw new Error("Serverul este ocupat. Te rugăm să încerci din nou în câteva secunde.");
  }

  try {
    const doc = obtineDocument_();
    const body = doc.getBody();

    asiguraSumar_(body);

    const props = PropertiesService.getScriptProperties();
    const cheieStatistici = "STATS_" + doc.getId();
    const statistici = citesteStatistici_(props, cheieStatistici);

    statistici.participanti += 1;
    statistici.sumaIncredere += date.incredereInitiala;
    statistici.sumaScor += date.scorTotal;

    adaugaIntrare_(body, date, statistici.participanti);
    actualizeazaSumar_(body, statistici);

    doc.saveAndClose();
    props.setProperty(cheieStatistici, JSON.stringify(statistici));

    return {
      ok: true,
      scorTotal: date.scorTotal,
      participantNr: statistici.participanti
    };
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/*  Funcții interne                                                    */
/* ------------------------------------------------------------------ */

/**
 * Verifică datele primite și recalculează scorul pe server,
 * ca să nu depindem de valoarea trimisă de browser.
 */
function valideazaPayload_(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Date lipsă.");
  }

  const incredere = Number(payload.incredereInitiala);
  if (!Number.isInteger(incredere) || incredere < 1 || incredere > 10) {
    throw new Error("Nivelul de încredere trebuie să fie între 1 și 10.");
  }

  const raspunsuri = payload.raspunsuri;
  if (!Array.isArray(raspunsuri) || raspunsuri.length !== INTREBARI.length) {
    throw new Error("Trebuie să existe exact " + INTREBARI.length + " răspunsuri.");
  }
  for (let i = 0; i < raspunsuri.length; i++) {
    if (raspunsuri[i] !== "A" && raspunsuri[i] !== "B") {
      throw new Error("Răspuns invalid la întrebarea " + (i + 1) + ".");
    }
  }

  let scor = 0;
  for (let i = 0; i < INTREBARI.length; i++) {
    if (raspunsuri[i] === INTREBARI[i].corect) scor++;
  }

  let moment = new Date(payload.timestamp);
  if (isNaN(moment.getTime())) moment = new Date();

  return {
    moment: moment,
    incredereInitiala: incredere,
    raspunsuri: raspunsuri.slice(),
    scorTotal: scor
  };
}

/**
 * Deschide documentul din DOC_ID sau pe cel creat automat anterior.
 * Dacă nu există niciunul, creează un document nou și îi reține ID-ul.
 */
function obtineDocument_() {
  const idConfigurat = String(DOC_ID || "").trim();
  if (idConfigurat && idConfigurat !== DOC_ID_PLACEHOLDER) {
    return DocumentApp.openById(idConfigurat);
  }

  const props = PropertiesService.getScriptProperties();
  const idSalvat = props.getProperty(CHEIE_DOC_ID);
  if (idSalvat) {
    try {
      return DocumentApp.openById(idSalvat);
    } catch (err) {
      // Documentul a fost șters sau nu mai este accesibil: creăm altul.
      props.deleteProperty("STATS_" + idSalvat);
    }
  }

  const doc = DocumentApp.create(NUME_DOC_AUTOMAT);
  props.setProperty(CHEIE_DOC_ID, doc.getId());
  return doc;
}

/**
 * Creează antetul și sumarul statistic la începutul documentului,
 * dacă acestea nu există deja.
 */
function asiguraSumar_(body) {
  if (body.findText(ET_TITLU_SUMAR)) return;

  const textExistent = body.getText().trim();

  const titlu = body.insertParagraph(0, "Rezultate Test: SCAM sau LEGITIM – Nivel expert");
  titlu.setHeading(DocumentApp.ParagraphHeading.TITLE);
  stilText_(titlu, { culoare: "#14452F", bold: true });

  const subtitlu = body.insertParagraph(1, "Equiteam · „Ce nu ne învață nimeni despre bani?”");
  subtitlu.setHeading(DocumentApp.ParagraphHeading.SUBTITLE);
  stilText_(subtitlu, { culoare: "#E87A3E" });

  const hSumar = body.insertParagraph(2, ET_TITLU_SUMAR);
  hSumar.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  stilText_(hSumar, { culoare: "#14452F", bold: true });

  body.insertParagraph(3, ET_PARTICIPANTI + " 0");
  body.insertParagraph(4, ET_MEDIE_INCREDERE + " –");
  body.insertParagraph(5, ET_MEDIE_SCOR + " –");
  body.insertParagraph(6, ET_ACTUALIZAT + " –");

  const hRezultate = body.insertParagraph(7, "RĂSPUNSURI INDIVIDUALE");
  hRezultate.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  stilText_(hRezultate, { culoare: "#14452F", bold: true });

  body.insertParagraph(8, "---").setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  // Un document nou are un paragraf gol la final; îl eliminăm dacă e cazul.
  if (!textExistent) {
    const ultim = body.getChild(body.getNumChildren() - 1);
    if (ultim.getType() === DocumentApp.ElementType.PARAGRAPH &&
        ultim.asParagraph().getText() === "" &&
        body.getNumChildren() > 1) {
      ultim.removeFromParent();
    }
  }
}

/**
 * Citește statisticile cumulate pentru documentul curent.
 */
function citesteStatistici_(props, cheie) {
  const brut = props.getProperty(cheie);
  if (brut) {
    try {
      const s = JSON.parse(brut);
      if (typeof s.participanti === "number") return s;
    } catch (err) {
      // Valoare coruptă: pornim de la zero.
    }
  }
  return { participanti: 0, sumaIncredere: 0, sumaScor: 0 };
}

/**
 * Rescrie rândurile sumarului statistic.
 */
function actualizeazaSumar_(body, s) {
  const medieIncredere = s.participanti ? (s.sumaIncredere / s.participanti) : 0;
  const medieScor = s.participanti ? (s.sumaScor / s.participanti) : 0;
  const acum = Utilities.formatDate(new Date(), FUS_ORAR, "dd.MM.yyyy HH:mm:ss");

  seteazaRand_(body, ET_PARTICIPANTI, String(s.participanti));
  seteazaRand_(body, ET_MEDIE_INCREDERE, formatNumar_(medieIncredere) + " / 10");
  seteazaRand_(body, ET_MEDIE_SCOR,
    formatNumar_(medieScor) + " / 6 (" + formatNumar_(medieScor / 6 * 100) + "% corecte)");
  seteazaRand_(body, ET_ACTUALIZAT, acum);
}

/**
 * Găsește paragraful care începe cu eticheta dată și îi înlocuiește valoarea.
 * Eticheta este scrisă bold, valoarea normal.
 */
function seteazaRand_(body, eticheta, valoare) {
  const gasit = body.findText(escapeRegex_(eticheta));
  if (!gasit) return;

  let el = gasit.getElement();
  while (el && el.getType() !== DocumentApp.ElementType.PARAGRAPH) {
    el = el.getParent();
  }
  if (!el) return;

  const paragraf = el.asParagraph();
  paragraf.setText(eticheta + " " + valoare);
  const text = paragraf.editAsText();
  text.setBold(false);
  text.setForegroundColor("#102A1E");
  text.setBold(0, eticheta.length - 1, true);
}

/**
 * Adaugă la finalul documentului intrarea unui participant.
 */
function adaugaIntrare_(body, d, numar) {
  const data = Utilities.formatDate(d.moment, FUS_ORAR, "dd.MM.yyyy HH:mm:ss");

  const titlu = body.appendParagraph("Participant #" + numar);
  titlu.setHeading(DocumentApp.ParagraphHeading.HEADING3);
  stilText_(titlu, { culoare: "#14452F", bold: true });

  randEtichetat_(body, "Dată / oră:", data);
  randEtichetat_(body, "Scor:", d.scorTotal + " / 6 corecte");
  randEtichetat_(body, "Încredere inițială:", d.incredereInitiala + " / 10");

  for (let i = 0; i < INTREBARI.length; i++) {
    const ales = d.raspunsuri[i];
    const corect = INTREBARI[i].corect;
    const ok = ales === corect;
    const linie = (ok ? "✓ " : "✗ ") +
      "Q" + (i + 1) + " – " + INTREBARI[i].titlu +
      ": a ales " + ales + " (" + ETICHETE[ales] + ")" +
      (ok ? "" : " · corect: " + corect + " (" + ETICHETE[corect] + ")");

    const item = body.appendListItem(linie);
    item.setGlyphType(DocumentApp.GlyphType.BULLET);
    const text = item.editAsText();
    text.setBold(false);
    text.setForegroundColor("#102A1E");
    text.setForegroundColor(0, 0, ok ? "#1E6B47" : "#C0392B");
    text.setBold(0, 0, true);
  }

  const sep = body.appendParagraph("---");
  sep.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  stilText_(sep, { culoare: "#E87A3E", bold: false });
}

function randEtichetat_(body, eticheta, valoare) {
  const p = body.appendParagraph(eticheta + " " + valoare);
  p.setHeading(DocumentApp.ParagraphHeading.NORMAL);
  const text = p.editAsText();
  text.setBold(false);
  text.setForegroundColor("#102A1E");
  text.setBold(0, eticheta.length - 1, true);
  return p;
}

function stilText_(paragraf, opt) {
  const text = paragraf.editAsText();
  if (!text.getText().length) return;
  if (opt.culoare) text.setForegroundColor(opt.culoare);
  if (typeof opt.bold === "boolean") text.setBold(opt.bold);
}

function formatNumar_(n) {
  return (Math.round(n * 100) / 100).toFixed(2).replace(".", ",");
}

function escapeRegex_(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Rulează această funcție o dată din editor (▶ Run) ca să acorzi
 * permisiunile pentru Google Docs înainte de Deploy. Creează/deschide
 * documentul și afișează link-ul în jurnal (View → Logs / Execution log).
 */
function autorizeazaSiTesteaza() {
  const doc = obtineDocument_();
  asiguraSumar_(doc.getBody());
  const url = doc.getUrl();
  doc.saveAndClose();
  Logger.log("Documentul de rezultate: " + url);
}
