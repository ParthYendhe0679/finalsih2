"""
HTTP client for the API tests.

starlette 0.36 builds its TestClient by passing ``app=`` to ``httpx.Client``, an
argument httpx removed in 0.28, so ``TestClient(app)`` raises TypeError with the
installed versions. The app is driven through httpx's own ASGITransport instead,
which works across both httpx generations.

ASGITransport is async-only, so it is wrapped in a sync transport here to keep the
tests plainly synchronous -- no event-loop plumbing or async test plugin needed.
It also does not run the lifespan handler, so the table creation the app would
normally do on startup is done here instead.
"""

import asyncio

import httpx

from app.database import Base, engine
from app.main import app

Base.metadata.create_all(bind=engine)


class _SyncASGITransport(httpx.BaseTransport):
    """Drives an async ASGI app from a synchronous httpx.Client."""

    def __init__(self, asgi_app):
        self._transport = httpx.ASGITransport(app=asgi_app)

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        async def send() -> httpx.Response:
            response = await self._transport.handle_async_request(request)
            try:
                body = b"".join([chunk async for chunk in response.stream])
            finally:
                await response.aclose()
            return httpx.Response(
                response.status_code,
                headers=response.headers,
                content=body,
                request=request,
            )

        return asyncio.run(send())


def make_client() -> httpx.Client:
    return httpx.Client(
        transport=_SyncASGITransport(app),
        base_url="http://testserver",
    )
