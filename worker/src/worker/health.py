import logging
from asyncio import Event

from aiohttp import web

logger = logging.getLogger(__name__)


async def health_handler(request: web.Request) -> web.Response:
    """Return 200 if the consumer is running."""
    is_healthy: bool = request.app.get("consumer_running", False)
    if is_healthy:
        return web.json_response({"status": "healthy"}, status=200)
    return web.json_response({"status": "unhealthy"}, status=503)


async def run_health_server(
    ready_event: Event | None = None,
    host: str = "0.0.0.0",
    port: int = 8080,
) -> None:
    """Start a lightweight HTTP health check server on the given port."""
    app = web.Application()
    app.router.add_get("/health", health_handler)
    app.router.add_route("HEAD", "/health", health_handler)
    app["consumer_running"] = True

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, host, port)
    await site.start()
    logger.info("Health check server listening on %s:%d", host, port)

    if ready_event is not None:
        ready_event.set()

    # Keep the server running until cancelled
    try:
        while True:
            import asyncio
            await asyncio.sleep(3600)
    finally:
        await runner.cleanup()
