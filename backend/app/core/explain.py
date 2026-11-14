from __future__ import annotations

from typing import Literal, Mapping, Sequence

from app.core.feasibility import WATER_SHARE_THRESHOLD, Risk
from app.core.selector import Scored, Selection

Lang = Literal["id", "en"]

LABELS = {
    "pola_biasa": {"id": "Pola biasa Anda", "en": "Your usual pattern"},
    "hemat_air": {"id": "Hemat air", "en": "Water-saving"},
    "jaga_tanah": {"id": "Jaga tanah", "en": "Soil-care"},
    "seimbang": {"id": "Seimbang", "en": "Balanced"},
}

MONTHS = {
    "id": ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"],
    "en": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
}

RULE_NAMES = {
    "id": {
        "K1": "urutan tahap",
        "K2": "kisaran suhu",
        "K3": "pH tanah",
        "K4": "aturan urutan tanaman",
        "K5": "kecukupan hujan",
    },
    "en": {
        "K1": "stage order",
        "K2": "temperature range",
        "K3": "soil pH",
        "K4": "crop sequence rule",
        "K5": "rainfall sufficiency",
    },
}


def month_label(month: str, lang: Lang) -> str:
    year, index = month.split("-")
    return f"{MONTHS[lang][int(index) - 1]} {year}"


def calendar_month_label(month: int, lang: Lang) -> str:
    return MONTHS[lang][month - 1]


def crop_name(crops: Mapping[str, object], crop_id: str, lang: Lang) -> str:
    return crops[crop_id].nama[lang]


def climate_evidence(item: Scored, lang: Lang) -> str:
    d = item.dimensions
    if not d.climate_months_total:
        return (
            "Tidak ada bulan tanam yang bisa dinilai suhunya."
            if lang == "id"
            else "No growing month could be assessed for temperature."
        )
    if lang == "id":
        return (
            f"{d.climate_months_ok} dari {d.climate_months_total} bulan tanam berada "
            "pada suhu optimal dan, untuk padi, pada bulan basah."
        )
    return (
        f"{d.climate_months_ok} of {d.climate_months_total} growing months are in the "
        "optimal temperature range and, for paddy, in wet months."
    )


def risk_text(risk: Risk, crops: Mapping[str, object], lang: Lang) -> str:
    name = crop_name(crops, risk.crop_id, lang) if risk.crop_id else ""
    id_text = {
        "soil_unavailable": "Data tanah tidak tersedia. Kesesuaian pH belum dinilai.",
        "irrigation_assumed": "Irigasi dianggap tersedia. Jumlah airnya tidak dihitung.",
        "water_unknown": f"Kebutuhan air {name} belum punya rujukan, jadi belum dinilai.",
        "water_proxy": f"Kebutuhan air {name} memakai nilai pendekatan dari kacang buncis FAO.",
        "water_unassessed": f"Data hujan tidak cukup untuk menilai tahap {name}.",
    }
    en_text = {
        "soil_unavailable": "Soil data is unavailable. pH suitability was not assessed.",
        "irrigation_assumed": "Irrigation is assumed available. Its volume is not calculated.",
        "water_unknown": f"Water need for {name} has no reference yet, so it was not assessed.",
        "water_proxy": f"Water need for {name} uses the FAO bean value as an approximation.",
        "water_unassessed": f"Not enough rainfall data to assess the {name} stage.",
    }
    code = risk.code
    if code in id_text:
        return (id_text if lang == "id" else en_text)[code]
    if code == "continues_after_horizon":
        end = month_label(risk.get("end"), lang)
        return (
            f"Tahap {name} berlanjut setelah horizon sampai {end}."
            if lang == "id"
            else f"The {name} stage continues past the horizon until {end}."
        )
    if code == "near_temperature":
        month = calendar_month_label(risk.get("month"), lang)
        return (
            f"Suhu rata-rata {month} dekat batas kisaran {name}."
            if lang == "id"
            else f"Mean temperature in {month} is close to the {name} limit."
        )
    if code == "near_water":
        met, total = risk.get("met"), risk.get("total")
        return (
            f"Hujan untuk {name} mencukupi di {met} dari {total} tahun acuan, sedikit di atas ambang."
            if lang == "id"
            else f"Rain for {name} was enough in {met} of {total} reference years, just above the threshold."
        )
    if code == "paddy_outside_wet":
        wet, months = risk.get("wet"), risk.get("months")
        start = month_label(risk.get("start"), lang)
        return (
            f"{name} mulai {start} hanya punya {wet} dari {months} bulan basah."
            if lang == "id"
            else f"{name} starting {start} has only {wet} of {months} wet months."
        )
    if code == "data_limited":
        month = calendar_month_label(risk.get("month"), lang)
        return (
            f"Data bulan {month} tidak lengkap, hasil untuk bulan itu kurang kuat."
            if lang == "id"
            else f"Data for {month} is incomplete, so results for that month are weaker."
        )
    raise ValueError(f"Unknown risk code {code}")


def _stage_reasons(item: Scored, crops, start_month: str, water_source: str, lang: Lang):
    lines = []
    seen = set()
    stages = {stage_index: stage for stage_index, stage in enumerate(item.plan)}
    for water in item.evaluation.stage_water:
        if not water.total or water.crop_id in seen:
            continue
        seen.add(water.crop_id)
        stage = stages[water.stage_index]
        name = crop_name(crops, water.crop_id, lang)
        start = month_label(stage.start(start_month), lang)
        end = month_label(stage.end(start_month), lang)
        if water_source == "irigasi":
            lines.append(
                f"{name} ({start} sampai {end}): hujan saja mencukupi di {water.met} dari {water.total} tahun acuan, sisanya bergantung pada irigasi."
                if lang == "id"
                else f"{name} ({start} to {end}): rain alone was enough in {water.met} of {water.total} reference years, the rest depends on irrigation."
            )
        else:
            lines.append(
                f"{name} ditempatkan pada {start} sampai {end} karena hujan selama tahap itu mencukupi di {water.met} dari {water.total} tahun acuan."
                if lang == "id"
                else f"{name} is placed from {start} to {end} because rain over that stage was enough in {water.met} of {water.total} reference years."
            )
    return lines


def _stage_rain(item: Scored, index: int):
    for water in item.evaluation.stage_water:
        if water.stage_index == index and water.total:
            return {"years_met": water.met, "years_total": water.total}
    return None


def _stage_warnings(item: Scored, index: int, crops, start_month: str, water_source: str, lang: Lang):
    stage = item.plan[index]
    lines = []
    for water in item.evaluation.stage_water:
        if (
            water.stage_index == index
            and water_source == "tadah_hujan"
            and water.share is not None
            and water.share < WATER_SHARE_THRESHOLD
        ):
            name = crop_name(crops, water.crop_id, lang)
            lines.append(
                f"Hujan untuk {name} mencukupi hanya di {water.met} dari {water.total} tahun acuan."
                if lang == "id"
                else f"Rain for {name} was enough in only {water.met} of {water.total} reference years."
            )
    for risk in item.evaluation.risks:
        if (
            risk.code == "paddy_outside_wet"
            and risk.crop_id == stage.crop_id
            and risk.get("start") == stage.start(start_month)
        ):
            lines.append(risk_text(risk, crops, lang))
    return lines


def _failure_reasons(item: Scored, crops, lang: Lang):
    lines = []
    if "K5" in item.evaluation.failed_rules:
        for water in item.evaluation.stage_water:
            share = water.share
            if share is not None and share < 0.6:
                name = crop_name(crops, water.crop_id, lang)
                lines.append(
                    f"Pada data 10 tahun, hujan untuk {name} mencukupi hanya di {water.met} dari {water.total} tahun."
                    if lang == "id"
                    else f"Over 10 years of data, rain for {name} was enough in only {water.met} of {water.total} years."
                )
    if "K5" in item.evaluation.failed_rules:
        lines += [
            risk_text(risk, crops, lang)
            for risk in item.evaluation.risks
            if risk.code == "paddy_outside_wet"
        ]
    rules = [r for r in item.evaluation.failed_rules if r != "K5" or not lines]
    if rules:
        names = ", ".join(RULE_NAMES[lang][r] for r in rules)
        lines.append(
            f"Pola ini tidak memenuhi aturan: {names}."
            if lang == "id"
            else f"This pattern does not meet: {names}."
        )
    return lines


def strategy_payload(
    role: str,
    item: Scored,
    *,
    baseline: Scored | None,
    crops: Mapping[str, object],
    start_month: str,
    water_source: str,
    lang: Lang,
) -> dict:
    d = item.dimensions
    reasons = _stage_reasons(item, crops, start_month, water_source, lang)
    tradeoffs: list[str] = []
    if role == "pola_biasa":
        reasons = _failure_reasons(item, crops, lang) + reasons
    elif baseline is not None:
        before, after = baseline.dimensions.bare_months, d.bare_months
        if after < before:
            reasons.append(
                f"Strategi ini mengurangi lahan terbuka dari {before} menjadi {after} bulan dibanding pola biasa Anda."
                if lang == "id"
                else f"This strategy reduces open land from {before} to {after} months compared with your usual pattern."
            )
        elif after > before:
            tradeoffs.append(
                f"Lahan terbuka bertambah dari {before} menjadi {after} bulan dibanding pola biasa Anda."
                if lang == "id"
                else f"Open land increases from {before} to {after} months compared with your usual pattern."
            )
        if d.water_share < baseline.dimensions.water_share and d.years_total:
            tradeoffs.append(
                f"Tahap terlemah lebih bergantung hujan: mencukupi di {d.years_met} dari {d.years_total} tahun, pola biasa {baseline.dimensions.years_met} dari {baseline.dimensions.years_total}."
                if lang == "id"
                else f"The weakest stage relies more on rain: enough in {d.years_met} of {d.years_total} years, versus {baseline.dimensions.years_met} of {baseline.dimensions.years_total} for your usual pattern."
            )
        if d.soil_checks < baseline.dimensions.soil_checks:
            tradeoffs.append(
                f"Daftar periksa tanah lebih sedikit: {d.soil_checks} dari 3, pola biasa {baseline.dimensions.soil_checks} dari 3."
                if lang == "id"
                else f"Fewer soil checklist items: {d.soil_checks} of 3, versus {baseline.dimensions.soil_checks} of 3 for your usual pattern."
            )
    if d.bare_months and not any(
        "lahan terbuka" in t.lower() or "open land" in t.lower() for t in reasons + tradeoffs
    ):
        tradeoffs.append(
            f"Ada {d.bare_months} bulan lahan terbuka dalam horizon."
            if lang == "id"
            else f"There are {d.bare_months} months of open land within the horizon."
        )
    if role == "jaga_tanah":
        families = d.families
        reasons.append(
            f"Memuat tanaman penambat nitrogen atau pupuk hijau, dengan {families} famili tanaman."
            if lang == "id"
            else f"Includes a nitrogen-fixing or green-manure crop, with {families} plant families."
        )

    return {
        "id": "baseline" if role == "pola_biasa" else item.id,
        "role": role,
        "label": LABELS[role][lang],
        "calendar": [
            {
                "crop_id": stage.crop_id,
                "start": stage.start(start_month),
                "end": stage.end(start_month),
                "continues_after_horizon": stage.continues_after_horizon,
                "water": _stage_rain(item, index),
                "warnings": _stage_warnings(item, index, crops, start_month, water_source, lang),
            }
            for index, stage in enumerate(item.plan)
        ],
        "feasibility": {
            "passed": item.evaluation.passed,
            "failed_rules": list(item.evaluation.failed_rules),
        },
        "dimensions": {
            "climate_fit": {"level": d.climate_fit_level, "evidence": climate_evidence(item, lang)},
            "water_pressure": {
                "level": d.water_level,
                "years_met": d.years_met,
                "years_total": d.years_total,
            },
            "bare_months": d.bare_months,
            "soil_contribution": {
                "legume": d.legume,
                "cover_crop": d.cover_crop,
                "families": d.families,
            },
            "risks": [
                text
                for text in dict.fromkeys(risk_text(risk, crops, lang) for risk in d.risks)
                if text not in reasons
            ],
        },
        "reasons": reasons,
        "tradeoffs": tradeoffs,
    }


def selection_notes(
    selection: Selection, *, has_pattern: bool, lang: Lang
) -> list[str]:
    notes: list[str] = []
    if not has_pattern:
        notes.append(
            "Belum ada pola untuk dibandingkan, jadi kami menampilkan tiga pilihan."
            if lang == "id"
            else "There is no usual pattern to compare, so we show three options."
        )
    found = len(selection.alternatives)
    if found == 0:
        common = selection.common_failures[0][0] if selection.common_failures else None
        rule = f" ({RULE_NAMES[lang][common]})" if common else ""
        notes.append(
            f"Tidak ada pola lain yang memenuhi syarat{rule}. Coba ubah bulan mulai atau horizon."
            if lang == "id"
            else f"No other pattern meets the rules{rule}. Try another start month or horizon."
        )
    elif found < selection.wanted:
        notes.append(
            f"Dengan waktu dan sumber air ini, hanya {found} pilihan lain yang memenuhi syarat."
            if lang == "id"
            else f"With this timing and water source, only {found} other "
            f"{'option meets' if found == 1 else 'options meet'} the rules."
        )
    return notes
