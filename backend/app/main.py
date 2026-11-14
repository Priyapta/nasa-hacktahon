from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router
from app.config import allowed_origins


def create_app() -> FastAPI:
    app = FastAPI(
        title="Field Shift API",
        version="0.1.0",
        description="Fondasi backend. Analisis NASA dan rotasi belum tersedia.",
    )

    if origins := allowed_origins():
        app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_methods=["GET", "POST"],
            allow_headers=["Content-Type"],
        )

    @app.exception_handler(RequestValidationError)
    async def invalid_request(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        # PRD uses 400 rather than FastAPI's default 422. Return field locations
        # and messages only; do not echo raw request values or validator context.
        return JSONResponse(
            status_code=400,
            content={
                "detail": [
                    {"loc": list(error["loc"]), "msg": error["msg"]}
                    for error in exc.errors()
                ]
            },
        )

    app.include_router(router, prefix="/api/v1")
    return app


app = create_app()
