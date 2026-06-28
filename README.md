# DataMonitorVE — Backend agregador

Promedia cifras del sismo de Venezuela (2026) desde **varias fuentes oficiales e
independientes**, expone la divergencia (oficial vs. medios) y sirve un JSON a la
web estática. Incluye réplicas en vivo de USGS y un panel de **protección infantil**
basado en alertas oficiales (UNICEF, Cecodap, Save the Children).

## Por qué este diseño (lee esto)

- **El Drive NO ejecuta código.** Guarda archivos; no corre procesos. Este backend
  debe desplegarse en un host que ejecute Node (Render, Koyeb, una VM). El Drive
  sirve para versionar el código y, si quieres, para respaldar `sources.json`.
- **No se raspan cifras de víctimas desde noticias en prosa.** Hacerlo cada minuto,
  de decenas de medios, es poco fiable y peligroso (un error en muertos es grave).
  En su lugar, cada fuente se actualiza vía `POST /api/sources/:metric` (a mano,
  panel admin, o cron donde el dato sea estructurado). El promedio se recalcula solo.
- **Transparencia:** `/api/stats` devuelve, por métrica, el promedio general, el
  **promedio oficial** y el **promedio independiente** por separado, más el rango
  (min–max) y TODAS las fuentes con su URL y fecha. Así se ve la manipulación.

## Despliegue rápido (Render, gratis)

1. Sube esta carpeta a un repo de GitHub.
2. En Render: New → Web Service → conecta el repo.
3. Build: `npm install` · Start: `npm start`.
4. Variables de entorno: `ADMIN_TOKEN` (un secreto tuyo).
5. Copia la URL pública (ej. `https://datamonitorve.onrender.com`).

> El plan gratuito duerme tras 15 min de inactividad (arranque frío de ~30–60 s).
> Un ping cada 10 min (UptimeRobot) lo mantiene despierto.

## Conectar la web

En `frontend-api.js` pon tu URL en `API_BASE` y pega el script en tu `index.html`.
La web pasará a leer las cifras del backend cada 60 s en lugar de tenerlas fijas.
Añade un contenedor `<div id="child-panel"></div>` para el panel de infancia.

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET  | `/api/stats` | Métricas con promedios + fuentes |
| GET  | `/api/usgs`  | Réplicas recientes (Venezuela) |
| GET  | `/api/child-protection` | Alertas oficiales de infancia |
| POST | `/api/sources/:metric` | Upsert de una fuente (Bearer token) |
| GET  | `/health` | Estado |

### Actualizar una cifra (ejemplo)

```bash
curl -X POST https://TU-BACKEND/api/sources/fallecidos \
  -H "Authorization: Bearer TU_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Reuters","value":940,"url":"https://reuters.com/...","official":false}'
```

El servidor reordena por recencia y recalcula promedios al instante.

## Nota sobre protección infantil

El panel NO afirma que haya tráfico de niños confirmado. Presenta **alertas de
riesgo** de organismos serios y sus llamados a salvaguardas (suspender adopciones
durante la emergencia, espacios seguros, apoyo psicosocial). Mantén ese encuadre:
difundir tráfico no confirmado como hecho sería desinformación dañina.

## Archivos

- `server.js` — API Express con promedios y proveniencia.
- `sources.json` — datos (edítalos / actualízalos vía API).
- `updater.js` — refresco de USGS + plantilla para registrar cifras verificadas.
- `frontend-api.js` — pegar en la web para consumir el backend.
