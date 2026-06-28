// DataMonitorVE — backend agregador transparente
// Promedia varias fuentes por métrica, separa OFICIAL vs INDEPENDIENTE
// (para exponer divergencias/manipulación), y sirve un JSON a la web.
//
// Ejecutar:  npm install && npm start
// Endpoints:
//   GET  /api/stats              -> métricas con promedios + todas las fuentes
//   GET  /api/usgs               -> réplicas recientes en Venezuela (proxy USGS)
//   GET  /api/child-protection   -> alertas oficiales de protección infantil
//   POST /api/sources/:metric    -> upsert de una fuente (requiere token Bearer)
//   GET  /health
//
// NOTA: la actualización en vivo se logra llamando POST /api/sources/:metric
// con la última cifra de cada medio (desde un cron, un panel admin, o a mano).
// El promedio se recalcula solo y las fuentes rotan por recencia.

import express from "express";
import cors from "cors";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, "sources.json");
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "cambia-este-token";
const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());                 // CORS abierto: la web estática puede consumirlo
app.use(express.json());

async function loadData() {
  return JSON.parse(await readFile(DATA_FILE, "utf8"));
}
async function saveData(d) {
  d.updatedAt = new Date().toISOString();
  await writeFile(DATA_FILE, JSON.stringify(d, null, 2));
}

// --- Cálculo de promedios con proveniencia -------------------------------
function summarize(metric) {
  const srcs = (metric.sources || []).slice()
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const vals = srcs.map(s => s.value).filter(v => typeof v === "number");
  const off  = srcs.filter(s => s.official).map(s => s.value);
  const ind  = srcs.filter(s => !s.official).map(s => s.value);
  const avg  = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

  return {
    label: metric.label,
    cumulative: !!metric.cumulative,
    note: metric.note || null,
    // Para cifras acumulativas, "latest" (la más reciente) suele ser el mejor
    // valor a destacar; "average" sirve para conciliar fuentes simultáneas.
    latest: srcs[0]?.value ?? null,
    average: avg(vals),
    officialAverage: avg(off),
    independentAverage: avg(ind),
    min: vals.length ? Math.min(...vals) : null,
    max: vals.length ? Math.max(...vals) : null,
    count: srcs.length,
    sources: srcs   // ya ordenadas por recencia -> la UI rota mostrando las últimas
  };
}

app.get("/health", (_, res) => res.json({ ok: true }));

app.get("/api/stats", async (_, res) => {
  try {
    const d = await loadData();
    const metrics = {};
    for (const [k, m] of Object.entries(d.metrics)) metrics[k] = summarize(m);
    res.json({ event: d.event, updatedAt: d.updatedAt, metrics });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.get("/api/child-protection", async (_, res) => {
  try { res.json((await loadData()).childProtection); }
  catch (e) { res.status(500).json({ error: String(e) }); }
});

// Proxy de USGS (zona Venezuela). La web podría llamar a USGS directamente,
// pero centralizar aquí permite cachear y unificar el origen.
app.get("/api/usgs", async (_, res) => {
  try {
    const start = new Date(Date.now() - 30 * 864e5).toISOString();
    const url = "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&eventtype=earthquake"
      + `&starttime=${start}&minlatitude=0.5&maxlatitude=13&minlongitude=-73.5&maxlongitude=-59.5`
      + "&orderby=time&limit=25";
    const r = await fetch(url);
    res.json(await r.json());
  } catch (e) { res.status(502).json({ error: String(e) }); }
});

// Upsert de una fuente: actualiza/inserta {name, value, url, official}.
// Así se mantienen frescas las cifras sin scraping frágil de prosa.
app.post("/api/sources/:metric", async (req, res) => {
  if (req.get("authorization") !== `Bearer ${ADMIN_TOKEN}`)
    return res.status(401).json({ error: "token inválido" });
  const { metric } = req.params;
  const { name, value, url, official } = req.body || {};
  if (!name || typeof value !== "number")
    return res.status(400).json({ error: "se requiere name (string) y value (number)" });
  try {
    const d = await loadData();
    if (!d.metrics[metric]) return res.status(404).json({ error: "métrica desconocida" });
    const list = d.metrics[metric].sources;
    const now = new Date().toISOString();
    const i = list.findIndex(s => s.name === name);
    const entry = { name, value, url: url || "", official: !!official, updatedAt: now };
    if (i >= 0) list[i] = entry; else list.push(entry);
    await saveData(d);
    res.json({ ok: true, metric, entry, summary: summarize(d.metrics[metric]) });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.listen(PORT, () => console.log(`DataMonitorVE backend en :${PORT}`));
