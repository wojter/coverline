"""Fills the running dev API with a demo dataset, through the same validation as the app.

Run with `make dev-seed` while `make dev-api` is up. Refuses any host but localhost.
"""

import json
import random
import sys
import urllib.parse
import urllib.request
import uuid
from datetime import date, timedelta

API = "http://127.0.0.1:8000/api/sync"
TODAY = date(2026, 11, 19)
CYCLE_STARTS = [date(2026, 7, 30), date(2026, 8, 27), date(2026, 9, 25), date(2026, 10, 24)]
EXCLUDED_CYCLE = 1  # the second cycle, illness

MUCUS_FEATURES = ["cloudy", "sticky", "clear", "stretchy"]
SYMPTOMS = ["ovulation_pain", "breast_tension"]
INTERCOURSE = ["morning", "evening"]
DISTURBANCES = ["alcohol", "short_sleep", "late_measurement", "illness", "stress", "travel"]


def ordered(values, order):
    return [v for v in order if v in values]


def cycle_end(index):
    if index + 1 < len(CYCLE_STARTS):
        return CYCLE_STARTS[index + 1] - timedelta(days=1)
    return None


def build_ops(rng):
    ops = [
        {"entity": "source", "key": "1", "set": {"name": "Usta – Microlife", "site": "oral"}},
        {"entity": "source", "key": "2", "set": {"name": "", "site": "vaginal"}},
        {"entity": "setting", "key": "default_intention", "set": {"value": "avoid"}},
    ]
    days, temps, cycles = [], [], []
    for index, start in enumerate(CYCLE_STARTS):
        end = cycle_end(index)
        last = end or TODAY
        length = (last - start).days + 1
        ovulation = min(14 + (length - 28) // 2, length - 14)
        cycle_id = str(uuid.uuid5(uuid.NAMESPACE_URL, start.isoformat()))
        excluded = index == EXCLUDED_CYCLE
        row = {
            "start_date": start.isoformat(),
            "intention": "avoid",
            "excluded_from_stats": excluded,
        }
        if excluded:
            row["notes"] = "choroba"
        if end is not None:
            row["coverline_1"] = 3648 + rng.randint(-2, 2)
            row["coverline_2"] = row["coverline_1"] + 8
            row["fertile_start"] = (start + timedelta(days=ovulation - 6)).isoformat()
            row["fertile_end"] = (start + timedelta(days=ovulation)).isoformat()
        cycles.append({"entity": "cycle", "key": cycle_id, "set": row})
        for d in range(1, length + 1):
            day_date = start + timedelta(days=d - 1)
            day_ops, day_temps = day_entries(rng, d, ovulation, day_date, index)
            if day_ops:
                days.append({"entity": "day", "key": day_date.isoformat(), "set": day_ops})
            temps.extend(day_temps)
    return ops + cycles + days + temps


def day_entries(rng, d, ovulation, day_date, index):
    fields = {}
    if d <= 5:
        fields["bleeding"] = ["heavy", "heavy", "medium", "light", "spotting"][d - 1]
    if 9 <= d < ovulation - 1:
        fields["mucus_sensation"] = "moist" if d % 2 else "dry"
        fields["mucus_features"] = ["cloudy"] if d % 3 == 0 else None
    peak = ovulation - 1
    if d == peak:
        fields.update(mucus_sensation="wet", mucus_features=["clear", "stretchy"], mark_mucus="P")
    elif d == peak + 1:
        fields.update(mucus_sensation="wet", mucus_features=["clear"], mark_mucus="1")
    elif d == peak + 2:
        fields.update(mucus_sensation="moist", mucus_features=["cloudy"], mark_mucus="2")
    elif d == peak + 3:
        fields.update(mucus_sensation="dry", mark_mucus="3")
    elif d > peak + 3 and "mucus_sensation" not in fields:
        fields["mucus_sensation"] = "dry"
    if d == peak and index != EXCLUDED_CYCLE:
        fields["symptoms"] = ["ovulation_pain"]
    if d == peak + 6 and index == 0:
        fields["symptoms"] = ["breast_tension"]
    if d in (ovulation - 2, ovulation + 1):
        fields["intercourse"] = ["morning"] if d % 2 else ["evening"]
    if index == 0 and d == 18:
        fields["disturbances"] = ["short_sleep"]
    if index == 2 and d == 6:
        fields["disturbances"] = ["alcohol"]
    if index == EXCLUDED_CYCLE and d in (3, 4, 5):
        fields["disturbances"] = ["illness"]
    if index == 2 and d == 10:
        fields["chart_note"] = "ból gardła"
    if index == 0 and d == 20:
        fields["chart_note"] = "późno"
        fields["disturbances"] = ["late_measurement"]
    if index == 0 and d == 3:
        fields["notes"] = "7:10"
    fields = {k: v for k, v in fields.items() if v is not None}
    if "mucus_features" in fields:
        fields["mucus_features"] = ordered(fields["mucus_features"], MUCUS_FEATURES)
    if "symptoms" in fields:
        fields["symptoms"] = ordered(fields["symptoms"], SYMPTOMS)
    if "intercourse" in fields:
        fields["intercourse"] = ordered(fields["intercourse"], INTERCOURSE)
    if "disturbances" in fields:
        fields["disturbances"] = ordered(fields["disturbances"], DISTURBANCES)
    temps = []
    if d != 7 and not (index == 2 and d == 12):
        for source, offset in (("1", 0), ("2", 8)):
            temps.extend(temp_entries(rng, d, ovulation, day_date, source, offset, index))
    return fields, temps


def temp_entries(rng, d, ovulation, day_date, source, offset, index):
    if index == EXCLUDED_CYCLE and source == "2" and d == 12:
        return []
    high = d >= ovulation + 2
    base = 3670 + rng.randint(-6, 6) if high else 3632 + rng.randint(-5, 4)
    value = min(max(base + offset + (rng.randint(-4, 4) if source == "2" else 0), 3560), 3790)
    entry = {"value": value}
    mark = None
    if high:
        mark = {ovulation + 2: "1", ovulation + 3: "2", ovulation + 4: "3"}.get(d)
    if mark:
        entry["mark"] = mark
    if source == "2" and index == 0 and d == 21:
        entry["excluded"] = True
        entry.pop("mark", None)
    return [{"entity": "temp", "key": f"{day_date.isoformat()}/{source}", "set": entry}]


def post(ops):
    body = json.dumps({"ops": ops}).encode()
    request = urllib.request.Request(API, data=body, headers={"content-type": "application/json"})
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.load(response)


def main():
    host = urllib.parse.urlparse(API).hostname
    if host not in ("127.0.0.1", "localhost"):
        sys.exit("refusing to seed a host other than localhost")
    rng = random.Random(20261119)
    ops = build_ops(rng)
    result = post(ops)
    if result["rejected"]:
        sys.exit(f"{len(result['rejected'])} ops rejected, first: {result['rejected'][0]}")
    print(f"seeded {len(ops)} ops, version {result['version']}")


if __name__ == "__main__":
    main()
