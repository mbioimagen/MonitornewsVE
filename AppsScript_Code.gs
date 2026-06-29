/**
 * DataMonitorVE — Apps Script (doGet + doPost)
 * doGet : sirve la hoja como JSON para la web (mismo formato que sources.json)
 * doPost: recibe cifras desde el script de tu laptop y las escribe en la hoja
 *
 * ── HOJA ──────────────────────────────────────────────────────────────────
 * Pestaña "cifras"  (fila 1 = encabezados exactos):
 *   metrica | label | tono | acumulativa | nota | fuente | valor | oficial | url | actualizado
 * Pestaña "infancia" (fila 1 = encabezados):
 *   org | tipo | resumen | url
 *
 * ── DESPLIEGUE ────────────────────────────────────────────────────────────
 * Implementar → Nueva implementación → "Aplicación web"
 *   Ejecutar como: Yo   ·   Quién accede: Cualquiera
 * Copia la URL .../exec  → va en la web (DATA_URL) y en el script (APPS_URL).
 *
 * IMPORTANTE: cambia SECRET por una clave tuya y úsala igual en el script.
 */

var SECRET = "17670moniorve2026507";

var CHILD_FRAMING =
  "No hay tráfico de niños confirmado por autoridades. Existen alertas de organismos " +
  "serios (UNICEF, Cecodap, Save the Children) sobre el RIESGO de separación familiar, " +
  "trata y apropiación irregular, con llamados a activar salvaguardas.";

var META = {
  fallecidos:    { label: "Fallecidos",              tono: "alert", acumulativa: true,  nota: "" },
  heridos:       { label: "Heridos",                 tono: "",      acumulativa: true,  nota: "" },
  desaparecidos: { label: "Desaparecidos",           tono: "amber", acumulativa: true,  nota: "Registros ciudadanos, no oficial." },
  edificaciones: { label: "Edificaciones afectadas", tono: "green", acumulativa: false, nota: "" }
};

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function toIso(v) {
  if (v instanceof Date) return v.toISOString();
  var d = new Date(v); return isNaN(d) ? new Date().toISOString() : d.toISOString();
}
function sheet(name) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name); }

function doGet() {
  var out = { updatedAt: new Date().toISOString(), metrics: {}, childProtection: { framing: CHILD_FRAMING, items: [] } };

  var sh = sheet("cifras");
  if (sh) {
    var rows = sh.getDataRange().getValues();
    var head = rows.shift().map(function (h) { return String(h).trim().toLowerCase(); });
    var c = {}; head.forEach(function (h, i) { c[h] = i; });
    rows.forEach(function (r) {
      var m = String(r[c["metrica"]] || "").trim(); if (!m) return;
      if (!out.metrics[m]) out.metrics[m] = {
        label: String(r[c["label"]] || m), tone: String(r[c["tono"]] || ""),
        cumulative: r[c["acumulativa"]] === true || String(r[c["acumulativa"]]).toUpperCase() === "TRUE",
        note: String(r[c["nota"]] || ""), sources: []
      };
      var v = Number(r[c["valor"]]); if (isNaN(v)) return;
      out.metrics[m].sources.push({
        name: String(r[c["fuente"]] || ""), value: v,
        official: r[c["oficial"]] === true || String(r[c["oficial"]]).toUpperCase() === "TRUE",
        url: String(r[c["url"]] || ""), updatedAt: toIso(r[c["actualizado"]])
      });
    });
    Object.keys(out.metrics).forEach(function (k) {
      out.metrics[k].sources.sort(function (a, b) { return new Date(b.updatedAt) - new Date(a.updatedAt); });
    });
  }

  var sc = sheet("infancia");
  if (sc) {
    var cr = sc.getDataRange().getValues();
    var ch = cr.shift().map(function (h) { return String(h).trim().toLowerCase(); });
    var cc = {}; ch.forEach(function (h, i) { cc[h] = i; });
    cr.forEach(function (r) {
      var org = String(r[cc["org"]] || "").trim(); if (!org) return;
      out.childProtection.items.push({
        org: org, type: String(r[cc["tipo"]] || ""),
        summary: String(r[cc["resumen"]] || ""), url: String(r[cc["url"]] || "")
      });
    });
  }
  return json(out);
}

// doPost espera { token, rows: [{ metrica, fuente, valor, oficial, url }] }
// UPSERT por (metrica + fuente).
function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json({ error: "json inválido" }); }
  if (!body || body.token !== SECRET) return json({ error: "token inválido" });
  if (!Array.isArray(body.rows)) return json({ error: "faltan rows" });

  var sh = sheet("cifras");
  if (!sh) return json({ error: "no existe la pestaña 'cifras'" });

  var data = sh.getDataRange().getValues();
  var head = data[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var c = {}; head.forEach(function (h, i) { c[h] = i; });
  var now = new Date();
  var updated = 0, added = 0;

  body.rows.forEach(function (row) {
    var metrica = String(row.metrica || "").trim().toLowerCase();
    var fuente  = String(row.fuente || "").trim();
    var valor   = Number(row.valor);
    if (!metrica || !fuente || isNaN(valor)) return;
    var meta = META[metrica] || { label: metrica, tono: "", acumulativa: false, nota: "" };

    var foundRow = -1;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][c["metrica"]]).trim().toLowerCase() === metrica &&
          String(data[i][c["fuente"]]).trim() === fuente) { foundRow = i; break; }
    }
    if (foundRow >= 0) {
      sh.getRange(foundRow + 1, c["valor"] + 1).setValue(valor);
      sh.getRange(foundRow + 1, c["oficial"] + 1).setValue(!!row.oficial);
      if (row.url) sh.getRange(foundRow + 1, c["url"] + 1).setValue(row.url);
      sh.getRange(foundRow + 1, c["actualizado"] + 1).setValue(now);
      updated++;
    } else {
      var newRow = [];
      newRow[c["metrica"]] = metrica;
      newRow[c["label"]] = meta.label;
      newRow[c["tono"]] = meta.tono;
      newRow[c["acumulativa"]] = meta.acumulativa;
      newRow[c["nota"]] = meta.nota;
      newRow[c["fuente"]] = fuente;
      newRow[c["valor"]] = valor;
      newRow[c["oficial"]] = !!row.oficial;
      newRow[c["url"]] = row.url || "";
      newRow[c["actualizado"]] = now;
      sh.appendRow(newRow);
      added++;
    }
  });
  return json({ ok: true, updated: updated, added: added });
}
