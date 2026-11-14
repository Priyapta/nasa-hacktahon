"""Read-only crop options from the curated catalog; no provider requests."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request

from app.catalog import Catalog
from app.schemas import ContractModel, CropsResponse, ErrorResponse, Language

router = APIRouter()


class CropQuery(ContractModel):
    lang: Language = "id"


def get_catalog(request: Request):
    return request.app.state.catalog


@router.get(
    "/crops",
    response_model=CropsResponse,
    tags=["crops"],
    responses={400: {"model": ErrorResponse}},
    summary="Daftar tanaman MVP untuk penyusun rotasi",
)
def crops(
    query: Annotated[CropQuery, Query()],
    catalog: Annotated[Catalog, Depends(get_catalog)],
):
    """Localized names/roles and fixed PRD calendar slots. Fallow uses slot_bulan=null.

    Full agronomic facts and evidence stay in the backend catalog. This endpoint
    supplies input choices and does not recommend a crop for a location.
    """
    return catalog.crop_options(query.lang)
