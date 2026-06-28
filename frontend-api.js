// frontend-api.js
// Pega esto en tu index.html (o impórtalo) para que la web consuma el backend
// en vez de tener las cifras escritas a mano. Refresca cada 60 s.
// Ajusta API_BASE a la URL de tu backend desplegado (Render/Koyeb).

const API_BASE = "https://TU-BACKEND.onrender.com";

function fmt(n){ return (n==null?"—":n.toLocaleString("es-VE")); }

async function refreshStats(){
  try{
    const r = await fetch(`${API_BASE}/api/stats`);
    const data = await r.json();
    const cont = document.getElementById("stats");
    cont.innerHTML = Object.entries(data.metrics).map(([key,m]) => {
      // Para acumulativas mostramos la más reciente; mostramos también el
      // contraste oficial vs independiente para exponer divergencias.
      const shown = m.cumulative ? m.latest : m.average;
      const gap = (m.officialAverage!=null && m.independentAverage!=null)
        ? `Oficial: ${fmt(m.officialAverage)} · Independientes: ${fmt(m.independentAverage)}`
        : "";
      return `
        <div class="stat">
          <div class="label">${m.label}</div>
          <div class="value">${fmt(shown)}</div>
          <div class="src">
            <span class="avg-pill">${m.count} FUENTES · rango ${fmt(m.min)}–${fmt(m.max)}</span>
            ${m.sources.slice(0,3).map(s=>s.name).join(" · ")}
          </div>
          ${gap?`<div class="src" style="color:#6c4cd6">${gap}</div>`:""}
          <span class="why" onclick='showSources(${JSON.stringify(JSON.stringify(m))})'>¿De dónde sale este dato?</span>
        </div>`;
    }).join("");
  }catch(e){ console.error("stats:", e); }
}

async function refreshChildPanel(){
  try{
    const r = await fetch(`${API_BASE}/api/child-protection`);
    const c = await r.json();
    const el = document.getElementById("child-panel");
    if(!el) return;
    el.innerHTML = `
      <div class="section-note">${c.framing}</div>
      <div class="src-grid">${c.items.map(it=>`
        <div class="src-card" style="border-left:4px solid #d6233a">
          <div class="sc-top"><h4>${it.org}</h4><span class="sc-type">${it.type}</span></div>
          <div class="sc-desc">${it.summary}</div>
          <a class="sc-link" href="${it.url}" target="_blank" rel="noopener">Comunicado / fuente ↗</a>
        </div>`).join("")}</div>`;
  }catch(e){ console.error("child:", e); }
}

function showSources(json){
  const m = JSON.parse(json);
  alert(`${m.label}\n\n` + m.sources.map(s =>
    `• ${s.name}${s.official?" (oficial)":""}: ${fmt(s.value)}  [${new Date(s.updatedAt).toLocaleString("es-VE")}]`
  ).join("\n"));
}

refreshStats(); refreshChildPanel();
setInterval(refreshStats, 60000);
setInterval(refreshChildPanel, 300000);
