"""Export standalone JSON Schemas; does not register or serve API endpoints."""
import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
from app import schemas  # noqa: E402

MODELS = (
    "AnalysisInput", "AnalysisResponse", "CropsResponse", "GeocodeInput",
    "GeocodeResponse", "HealthResponse", "ErrorResponse", "ChatInput", "ChatResponse",
)

def export():
    target = BACKEND / "contracts" / "schemas"
    target.mkdir(parents=True, exist_ok=True)
    for name in MODELS:
        schema = getattr(schemas, name).model_json_schema(by_alias=True)
        (target / f"{name}.json").write_text(
            json.dumps(schema, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )

if __name__ == "__main__":
    export()
