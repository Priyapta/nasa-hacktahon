"""PRD location-search endpoint. A search result is not a field polygon."""

from threading import Lock
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.responses import JSONResponse

from app.schemas import ErrorResponse, GeocodeInput, GeocodeResponse
from app.services.geocode import GeocodeRateLimited, GeocodeService, GeocodeUnavailable

router = APIRouter()
_init_lock = Lock()


def get_geocode_service(request: Request):
    with _init_lock:
        if not hasattr(request.app.state, "geocode_service"):
            request.app.state.geocode_service = GeocodeService()
        return request.app.state.geocode_service


@router.get(
    "/geocode",
    response_model=GeocodeResponse,
    tags=["location"],
    responses={
        400: {"model": ErrorResponse},
        429: {"model": ErrorResponse},
        502: {"model": ErrorResponse},
    },
    summary="Cari desa atau tempat di Indonesia",
)
def geocode(
    query: Annotated[GeocodeInput, Query()],
    response: Response,
    service: Annotated[GeocodeService, Depends(get_geocode_service)],
):
    """Search on explicit user submission; public Nominatim must not be used for autocomplete.

    Centers use [longitude, latitude] to match the map. Draw the field polygon
    separately. Data attribution: OpenStreetMap contributors, ODbL.
    """
    try:
        result, cache_status = service.search(query.q)
    except GeocodeRateLimited as exc:
        return JSONResponse(
            status_code=429,
            headers={"Retry-After": str(exc.retry_after)},
            content={"detail": [{"loc": [], "msg": str(exc)}]},
        )
    except GeocodeUnavailable:
        return JSONResponse(
            status_code=502,
            content={
                "detail": [
                    {
                        "loc": [],
                        "msg": "Layanan pencarian lokasi belum tersedia. Coba lagi sebentar.",
                    }
                ]
            },
        )
    response.headers["X-Geocode-Cache"] = cache_status
    response.headers["X-Geocode-Attribution"] = "OpenStreetMap contributors (ODbL)"
    response.headers["Link"] = (
        '<https://www.openstreetmap.org/copyright>; rel="license"'
    )
    if cache_status == "stale":
        response.headers["Warning"] = '110 - "Geocode cache is stale"'
    return result
