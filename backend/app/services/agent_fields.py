from contextlib import contextmanager
from datetime import datetime
from typing import Annotated
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import HTTPException, Request
from pydantic import Field, ValidationError
from shapely.geometry import shape

from app.api.accounts import COOKIE, current_user
from app.core.power_grid import geodesic_area
from app.core.rotation import add_months, build_calendar
from app.database import database
from app.schemas import AnalysisInput, ContractModel, RotationInput
from app.services.analysis import AnalysisService, ClimateUnavailable


class ListFieldsInput(ContractModel):
    search: Annotated[str, Field(max_length=100)] = ""
    offset: Annotated[int, Field(ge=0, le=100000)] = 0


class InspectFieldInput(ContractModel):
    field_id: UUID


TOOLS = [
    {"type": "function", "function": {
        "name": "list_saved_fields",
        "description": "Find the signed-in user's saved fields by name, or list them. Returns 20 names and IDs per page; use next_offset for more. Never accesses another account.",
        "parameters": ListFieldsInput.model_json_schema(),
    }},
    {"type": "function", "function": {
        "name": "inspect_saved_field",
        "description": "Read an owned saved field's plan, its current stage according to the saved calendar, and fresh historical climate/soil analysis. Not live crop monitoring. Use an ID from list_saved_fields or the active field.",
        "parameters": InspectFieldInput.model_json_schema(),
    }},
]


class SavedFieldTools:
    def __init__(self, request: Request, analysis: AnalysisService, lang: str):
        self.request, self.analysis, self.lang = request, analysis, lang

    def run(self, name: str, arguments: str) -> dict:
        try:
            if name == "list_saved_fields":
                args = ListFieldsInput.model_validate_json(arguments)
            elif name == "inspect_saved_field":
                args = InspectFieldInput.model_validate_json(arguments)
            else:
                return {"status": "unknown_tool"}
            if not self.request.cookies.get(COOKIE):
                return {"status": "sign_in_required"}
            with contextmanager(database)() as db:
                user = current_user(self.request, db)
                if name == "list_saved_fields":
                    rows = db.execute(
                        "SELECT id, name FROM fields WHERE user_id = %s AND name ILIKE %s "
                        "ORDER BY created_at DESC, id LIMIT 21 OFFSET %s",
                        (user["id"], f"%{args.search}%", args.offset),
                    ).fetchall()
                    return {
                        "status": "ok", "fields": [{"id": str(row["id"]), "name": row["name"]} for row in rows[:20]],
                        "next_offset": args.offset + 20 if len(rows) > 20 else None,
                    }
                field = db.execute(
                    "SELECT id, name, plan, created_at FROM fields WHERE id = %s AND user_id = %s",
                    (args.field_id, user["id"]),
                ).fetchone()
            if field is None:
                return {"status": "not_found"}
            return self.inspect(field)
        except ValidationError:
            return {"status": "invalid_arguments_or_saved_plan"}
        except HTTPException as exc:
            return {"status": "sign_in_required" if exc.status_code == 401 else "storage_unavailable"}

    def inspect(self, field: dict) -> dict:
        saved = field["plan"]
        now = datetime.now(ZoneInfo("Asia/Jakarta"))
        month = now.strftime("%Y-%m")
        start, horizon = saved["time"]["start_month"], saved["time"]["horizon_months"]
        rotation = RotationInput.model_validate(saved["rotation"])
        crops = {crop.crop_id: crop for crop in self.analysis.catalog.crops}
        calendar = [{
            "crop": crops[stage.crop_id].nama[self.lang], "crop_id": stage.crop_id,
            "start": stage.start(start), "end": stage.end(start),
        } for stage in build_calendar(rotation.stages, crops, horizon)]
        end = add_months(start, horizon - 1)
        stage = next((stage for stage in calendar if stage["start"] <= month <= min(stage["end"], end)), None)
        evaluation_start = max(start, month)
        plan = AnalysisInput.model_validate({
            **saved, "lang": self.lang,
            "time": {"start_month": evaluation_start, "horizon_months": horizon},
        })
        polygon = shape(plan.location.model_dump())
        result = {
            "status": "ok", "id": str(field["id"]), "name": field["name"],
            "as_of_wib": now.isoformat(), "area_ha": round(geodesic_area(polygon) / 10000, 3),
            "water_source": saved["water_source"], "saved_start_month": start,
            "saved_end_month": end, "saved_calendar": calendar,
            "planned_status": "not_started" if month < start else "ended" if month > end else "in_progress",
            "planned_current_stage": stage,
            "actual_observations": None,
            "analysis_start_month": evaluation_start,
            "analysis_rebased": evaluation_start != start,
        }
        try:
            result["analysis"] = self.analysis.analyze(plan).model_dump(mode="json", by_alias=True)
        except ClimateUnavailable:
            result["analysis"] = {"status": "climate_unavailable"}
        return result
