import os
import time
import logging
from aiohttp import web
import jwt
from dotenv import load_dotenv
from bot import verify_telegram_init_data, BOT_TOKEN

load_dotenv()

JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

async def auth_handler(request):
    """
    Эндпоинт для генерации Supabase JWT на основе данных из Telegram Mini App.
    """
    if request.method == 'OPTIONS':
        # Поддержка CORS
        return web.Response(headers={
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Bypass-Tunnel-Reminder',
        })

    try:
        data = await request.json()
        init_data = data.get("initData")

        if not init_data:
            return web.json_response({"error": "Missing initData"}, status=400, headers={'Access-Control-Allow-Origin': '*'})

        # 1. Проверяем подпись Telegram
        user_data = verify_telegram_init_data(init_data, BOT_TOKEN)
        if not user_data:
            return web.json_response({"error": "Invalid initData signature"}, status=401, headers={'Access-Control-Allow-Origin': '*'})

        if not JWT_SECRET:
            logging.error("SUPABASE_JWT_SECRET is not set in .env")
            return web.json_response({"error": "Server misconfiguration"}, status=500, headers={'Access-Control-Allow-Origin': '*'})

        # 2. Генерируем JWT для Supabase
        user_id = str(user_data["id"])
        
        payload = {
            "aud": "authenticated",
            "exp": int(time.time()) + (60 * 60 * 24), # Токен на 24 часа
            "iat": int(time.time()),
            "iss": "supabase",
            "sub": user_id,
            "role": "authenticated",
            "app_metadata": {
                "provider": "telegram"
            },
            "user_metadata": {
                "username": user_data.get("username", ""),
                "first_name": user_data.get("first_name", "")
            }
        }

        # Supabase использует HS256 для подписи
        token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")

        return web.json_response({
            "token": token,
            "user": user_data
        }, headers={'Access-Control-Allow-Origin': '*'})

    except Exception as e:
        logging.error(f"Auth error: {e}")
        return web.json_response({"error": "Internal server error"}, status=500, headers={'Access-Control-Allow-Origin': '*'})


def create_app():
    app = web.Application()
    app.router.add_post('/api/auth', auth_handler)
    app.router.add_options('/api/auth', auth_handler)
    return app

if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    app = create_app()
    web.run_app(app, host='0.0.0.0', port=8000)
