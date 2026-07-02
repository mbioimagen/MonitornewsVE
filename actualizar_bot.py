import os
import requests
import re
import sys
import xml.etree.ElementTree as ET
from datetime import datetime

# Obtenemos las claves de forma segura desde los Secrets de GitHub
TELEGRAM_TOKEN = os.environ.get("TELEGRAM_TOKEN")
CHAT_ID = os.environ.get("CHAT_ID")
UA = {"User-Agent": "DataMonitorVE/2.0 (monitoreo emergencia; bot de noticias)"}

def enviar_telegram(mensaje):
    """Envía el mensaje formateado al bot de Telegram"""
    if not TELEGRAM_TOKEN or not CHAT_ID:
        print("Error: Faltan credenciales de Telegram.")
        return
        
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    payload = {
        "chat_id": CHAT_ID, 
        "text": mensaje, 
        "parse_mode": "HTML",
        "disable_web_page_preview": True # Para que no llene el chat de fotos de noticias
    }
    requests.post(url, json=payload)

def detectar_noticias():
    """Busca en agregadores de noticias oficiales y medios contrastados"""
    resultados = []
    try:
        # Buscamos en Google News (filtra medios verificados y oficiales)
        query = "terremoto+venezuela+(fallecidos+OR+muertos+OR+heridos+OR+desaparecidos+OR+cifra)"
        url = f"https://news.google.com/rss/search?q={query}&hl=es-419&gl=VE&ceid=VE:es-419"
        
        req = requests.get(url, headers=UA, timeout=20)
        root = ET.fromstring(req.text)
        
        # Analizamos los titulares buscando números
        patrones = {
            "Fallecidos": r"(?:muert[oa]s?|fallecid[oa]s?|v[ií]ctimas).{0,20}?([\d\.\,]{2,})",
            "Heridos": r"herid[oa]s?.{0,20}?([\d\.\,]{2,})",
            "Desaparecidos": r"desaparecid[oa]s?.{0,20}?([\d\.\,]{2,})"
        }
        
        # Revisamos los últimos 15 titulares más relevantes
        for item in root.findall('.//item')[:15]:
            titulo = item.find('title').text
            link = item.find('link').text
            
            cifras_encontradas = {}
            titulo_lower = titulo.lower()
            
            for met, pat in patrones.items():
                m = re.search(pat, titulo_lower)
                if m:
                    num = re.sub(r"[^\d]", "", m.group(1))
                    if num:
                        cifras_encontradas[met] = int(num)
            
            # Si el titular tiene cifras, lo guardamos
            if cifras_encontradas:
                # Limpiamos el nombre del medio (suele venir al final del título después de un guion)
                medio = titulo.split(" - ")[-1] if " - " in titulo else "Medio"
                resultados.append({
                    "medio": medio,
                    "titulo": titulo,
                    "link": link,
                    "cifras": cifras_encontradas
                })
    except Exception as e:
        print(f"Error consultando noticias: {e}")
    
    # Devolvemos solo los 3 más relevantes que tengan cifras
    return resultados[:3]

def detectar_usgs():
    """Busca las últimas 3 réplicas reportadas por el USGS"""
    sismos = []
    try:
        url = "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&eventtype=earthquake&minlatitude=0.5&maxlatitude=13&minlongitude=-73.5&maxlongitude=-59.5&orderby=time&limit=3"
        req = requests.get(url, headers=UA, timeout=20)
        data = req.json()
        
        for f in data.get("features", []):
            p = f["properties"]
            mag = p.get('mag')
            lugar = p.get('place')
            # Convertimos la hora de formato UNIX a hora legible
            hora = datetime.fromtimestamp(p.get('time') / 1000.0).strftime('%d/%m %H:%M')
            sismos.append(f"M {mag:.1f} · {lugar} ({hora})")
    except Exception as e:
        print(f"Error en USGS: {e}")
    return sismos

def main():
    print("Iniciando escaneo automático...")
    
    noticias = detectar_noticias()
    quake_list = detectar_usgs()
    
    # 2. Armar el mensaje para Telegram
    mensaje = "🚨 <b>Monitor SismoVE - Reporte Automático</b>\n\n"
    
    if noticias:
        mensaje += "📰 <b>Titulares Destacados (Medios y Oficiales):</b>\n"
        for n in noticias:
            mensaje += f"• <b>{n['medio']}</b>:\n"
            mensaje += f"<i>{n['titulo']}</i>\n"
            for met, val in n['cifras'].items():
                mensaje += f"  ↳ {met}: {val:,}\n"
            mensaje += "\n"
    else:
        mensaje += "📰 <i>No se detectaron nuevas cifras en titulares de medios verificados.</i>\n\n"
        
    if quake_list:
        mensaje += "🌍 <b>Últimas réplicas (USGS):</b>\n"
        for q in quake_list:
            mensaje += f"• {q}\n"
        
    mensaje += "\n👉 <i>Recuerda: El bot solo lee titulares. Verifica la noticia antes de publicar en el mapa.</i>"
    
    # 3. Enviar alerta
    enviar_telegram(mensaje)
    print("Reporte enviado con éxito a Telegram.")

if __name__ == "__main__":
    main()
