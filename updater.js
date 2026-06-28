// updater.js — refresco automático SOLO donde es fiable.
// USGS expone datos estructurados: se puede automatizar sin riesgo.
// Las cifras de víctimas NO se extraen automáticamente de prosa de noticias
// (poco fiable); se actualizan vía POST /api/sources/:metric desde un panel
// admin o a mano, tras verificación humana.
//
// Uso: ejecutar periódicamente (cron de Render, GitHub Actions, etc.)
//   API_URL=https://tu-backend ADMIN_TOKEN=xxx node updater.js

const API = process.env.API_URL || "http://localhost:3000";
const TOKEN = process.env.ADMIN_TOKEN || "cambia-este-token";

// Ejemplo: si en el futuro hubiera un feed estructurado de víctimas,
// se mapearía aquí. Por ahora dejamos USGS (réplicas) como demo fiable.
async function refreshUsgs() {
  const r = await fetch(`${API}/api/usgs`);
  const d = await r.json();
  const last = d.features?.[0];
  if (last) {
    console.log("Última réplica USGS:", last.properties.mag, last.properties.place);
  }
}

// Plantilla para registrar una cifra verificada manualmente:
async function pushFigure(metric, name, value, url, official) {
  const r = await fetch(`${API}/api/sources/${metric}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TOKEN}` },
    body: JSON.stringify({ name, value, url, official })
  });
  console.log(metric, "=>", await r.json());
}

await refreshUsgs();
// Ejemplo (descomentar y editar tras verificar la cifra en la fuente):
// await pushFigure("fallecidos", "Reuters", 940, "https://www.reuters.com/...", false);
