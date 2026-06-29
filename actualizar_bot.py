import os
import requests
import sys

# Obtenemos las claves de forma segura desde los Secrets de GitHub
APPS_URL = os.environ.get("APPS_URL")
TOKEN_APPS = os.environ.get("TOKEN_APPS")
TELEGRAM_TOKEN = os.environ.get("TELEGRAM_TOKEN")
CHAT_ID = os.environ.get("CHAT_ID")

def enviar_telegram(mensaje):
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    payload = {"chat_id": CHAT_ID, "text": mensaje}
    requests.post(url, json=payload)

def main():
    if not all([APPS_URL, TOKEN_APPS, TELEGRAM_TOKEN, CHAT_ID]):
        print("Error: Faltan variables de entorno.")
        sys.exit(1)
    
    # Aquí iría tu lógica de detección (o una petición a tu Apps Script para ver si hay cambios)
    # Por ahora, enviamos una prueba de que el flujo funciona
    mensaje = "🚨 Monitor SismoVE: El bot de automatización está activo y revisando nuevas cifras oficiales."
    enviar_telegram(mensaje)
    print("Notificación enviada con éxito.")

if __name__ == "__main__":
    main()