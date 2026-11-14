from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from typing import Literal, Sequence

from app.core.dimensions import Dimensions
from app.core.feasibility import Evaluation
from app.core.rotation import PlannedStage, signature

Role = Literal["hemat_air", "jaga_tanah", "seimbang"]


@dataclass(frozen=True)
class Scored:
    id: str
    plan: tuple[PlannedStage, ...]
    evaluation: Evaluation
    dimensions: Dimensions


@dataclass(frozen=True)
class Selection:
    alternatives: tuple[tuple[Role, Scored], ...]
    wanted: int
    feasible: int
    common_failures: tuple[tuple[str, int], ...]


def _water_saving_key(item: Scored):
    d = item.dimensions
    return (-d.water_share, d.water_need_mm, d.bare_months, item.id)


def _soil_care_key(item: Scored):
    d = item.dimensions
    return (d.bare_months, -d.soil_checks, -d.families, item.id)


def _balanced_key(item: Scored):
    share = item.dimensions.climate_fit_share
    return (-(share if share is not None else -1.0), item.id)


def select(candidates: Sequence[Scored], baseline: Scored | None) -> Selection:
    """PRD 10: pick alternatives that pass every rule and differ by at least
    one stage from the usual pattern and from each other."""
    feasible = [item for item in candidates if item.evaluation.passed]
    taken = {signature(baseline.plan)} if baseline else set()
    pool: list[Scored] = []
    for item in sorted(feasible, key=lambda item: item.id):
        key = signature(item.plan)
        if key not in taken and all(signature(p.plan) != key for p in pool):
            pool.append(item)

    chosen: list[tuple[Role, Scored]] = []

    def pick(role: Role, eligible, order) -> None:
        options = [
            item
            for item in pool
            if signature(item.plan) not in taken and eligible(item)
        ]
        if options:
            best = min(options, key=order)
            chosen.append((role, best))
            taken.add(signature(best.plan))

    baseline_bare = baseline.dimensions.bare_months if baseline else None
    pick(
        "hemat_air",
        lambda item: item.dimensions.has_production
        and (baseline_bare is None or item.dimensions.bare_months <= baseline_bare),
        _water_saving_key,
    )
    pick(
        "jaga_tanah",
        lambda item: item.dimensions.legume or item.dimensions.cover_crop,
        _soil_care_key,
    )
    if baseline is None:
        pick("seimbang", lambda item: True, _balanced_key)

    failures = Counter(
        rule for item in candidates if not item.evaluation.passed for rule in item.evaluation.failed_rules
    )
    return Selection(
        alternatives=tuple(chosen),
        wanted=2 if baseline else 3,
        feasible=len(feasible),
        common_failures=tuple(sorted(failures.items(), key=lambda kv: (-kv[1], kv[0]))),
    )
