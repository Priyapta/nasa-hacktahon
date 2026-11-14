from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse

from app.schemas import AnalysisInput, AnalysisResponse, ErrorResponse
from app.services.analysis import AnalysisService, ClimateUnavailable

router = APIRouter()


def get_analysis(request: Request) -> AnalysisService:
    return request.app.state.analysis


@router.post(
    "/analyze",
    response_model=AnalysisResponse,
    response_model_by_alias=True,
    tags=["analysis"],
    responses={400: {"model": ErrorResponse}, 502: {"model": ErrorResponse}},
    summary="Bandingkan strategi rotasi untuk satu lahan",
)
async def analyze(
    body: AnalysisInput,
    request: Request,
    service: Annotated[AnalysisService, Depends(get_analysis)],
):
    """Estimasi berbasis pola historis NASA POWER dan SoilGrids. Tanah yang gagal
    tetap 200 dengan status unavailable. Iklim tanpa cache menghasilkan 502."""
    try:
        # Reading NetCDF and GeoTIFF archives blocks, so keep it off the event loop.
        result = await run_in_threadpool(service.analyze, body)
        return await request.app.state.recommendation.explain(result, body.lang)
    except ClimateUnavailable as exc:
        return JSONResponse(status_code=502, content={"detail": [{"loc": [], "msg": str(exc)}]})
