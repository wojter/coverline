import pytest

from app.models import OpError, check_row, check_setting, parse_op, split_key

UUID = "0b7c2f4e-6a1d-4c3e-9f2a-1d2e3f4a5b6c"


def accepts(entity, row):
    check_row(entity, row)


def rejects(entity, row):
    with pytest.raises(OpError):
        check_row(entity, row)


def day(**fields):
    return {"bleeding": None, "mucus_features": None, "mucus_atypical": None, **fields}


def temp(**fields):
    return {"value": 3645, "excluded": False, "mark": None, **fields}


def cycle(**fields):
    return {"start_date": "2026-11-01", "excluded_from_stats": False, **fields}


SOURCE = {
    "name": "",
    "site": "oral",
    "color": "#2563eb",
    "marker": "circle",
    "range_min": 3550,
    "range_max": 3800,
}


@pytest.mark.parametrize(
    "row",
    [
        day(),
        day(bleeding="spotting", mucus_features=["cloudy", "sticky"], mucus_atypical=True),
        day(chart_note="a" * 30),
        day(chart_note="𝐀" * 30),
        day(intercourse=["morning", "evening"], symptoms=["ovulation_pain", "breast_tension"]),
        day(
            disturbances=[
                "alcohol",
                "short_sleep",
                "late_measurement",
                "illness",
                "stress",
                "travel",
            ]
        ),
        day(mark_mucus="P", mucus_quality_override="none"),
    ],
)
def test_day_accepts_valid_rows(row):
    accepts("day", row)


@pytest.mark.parametrize(
    "row",
    [
        day(bleeding="heavy_flow"),
        day(mucus_atypical=1),
        day(mucus_features="clear"),
        day(mucus_features=[]),
        day(mucus_features=["sticky", "cloudy"]),
        day(mucus_features=["cloudy", "cloudy"]),
        day(mucus_features=["glossy"]),
        day(symptoms=["breast_tension", "ovulation_pain"]),
        day(chart_note="a" * 31),
        day(chart_note="𝐀" * 31),
        day(mark_mucus="4"),
        day(mucus_quality_override="fertile"),
        day(notes=3),
    ],
)
def test_day_rejects_invalid_rows(row):
    rejects("day", row)


@pytest.mark.parametrize(
    "row",
    [
        temp(),
        temp(value=3550, mark="4"),
        temp(value=3645, excluded=True),
    ],
)
def test_temp_accepts_valid_rows(row):
    accepts("temp", row)


@pytest.mark.parametrize(
    "row",
    [
        temp(value="3645"),
        temp(value=36.45),
        temp(value=True),
        temp(value=None),
        temp(mark=3),
        temp(mark="5"),
        temp(excluded=True, mark="1"),
        temp(excluded=None),
        temp(value=3645, extra=1),
    ],
)
def test_temp_rejects_invalid_rows(row):
    rejects("temp", row)


@pytest.mark.parametrize(
    "row",
    [
        cycle(),
        cycle(end_date="2026-11-30", intention="conceive", coverline_1=3650),
        cycle(fertile_start="2026-11-10", fertile_end="2026-11-10"),
        cycle(prev_cycle_rise=False, first_hf_mucus_day="2026-10-01"),
    ],
)
def test_cycle_accepts_valid_rows(row):
    accepts("cycle", row)


@pytest.mark.parametrize(
    "row",
    [
        cycle(start_date=None),
        cycle(start_date="2026-5-10"),
        cycle(start_date="2026-02-29"),
        cycle(end_date="2026-10-31"),
        cycle(excluded_from_stats=None),
        cycle(intention="maybe"),
        cycle(fertile_start="2026-11-10", fertile_end="2026-11-09"),
        cycle(prev_cycle_rise=1),
        cycle(coverline_1="3650"),
    ],
)
def test_cycle_rejects_invalid_rows(row):
    rejects("cycle", row)


def test_source_accepts_valid_row():
    accepts("source", SOURCE)


@pytest.mark.parametrize(
    "change",
    [
        {"color": "#7C3AED"},
        {"color": "blue"},
        {"site": "ear"},
        {"marker": "star"},
        {"range_min": 3800},
        {"name": None},
    ],
)
def test_source_rejects_invalid_rows(change):
    rejects("source", {**SOURCE, **change})


@pytest.mark.parametrize(
    "key,value",
    [
        ("default_intention", "conceive"),
        ("default_intention", None),
        ("cycle_number_start", 5),
        ("stats_n", 6),
    ],
)
def test_settings_accept_valid_values(key, value):
    check_setting(key, value)


@pytest.mark.parametrize(
    "key,value",
    [
        ("default_intention", "both"),
        ("stats_n", 0),
        ("stats_n", None),
        ("cycle_number_start", "5"),
        ("cycle_number_start", 1.0),
    ],
)
def test_settings_reject_invalid_values(key, value):
    with pytest.raises(OpError):
        check_setting(key, value)


@pytest.mark.parametrize(
    "raw",
    [
        {"entity": "day", "key": "2026-11-18", "set": {"notes": "a"}},
        {"entity": "day", "key": "2026-11-18", "delete": True},
        {"entity": "temp", "key": "2026-11-18/2", "delete": True},
        {"entity": "cycle", "key": UUID, "set": {"start_date": "2026-11-01"}},
        {"entity": "setting", "key": "stats_n", "set": {"value": 6}},
    ],
)
def test_parse_op_accepts_valid_shapes(raw):
    parse_op(raw)


@pytest.mark.parametrize(
    "raw",
    [
        {"entity": "day", "key": "2026-11-18", "set": {"notes": "a"}, "delete": True},
        {"entity": "day", "key": "2026-11-18", "set": {}},
        {"entity": "day", "key": "2026-11-18"},
        {"entity": "day", "key": "2026-11-18", "delete": False},
        {"entity": "day", "key": "2026-11-18", "set": {"notes": "a"}, "device": "ios"},
        {"entity": "note", "key": "2026-11-18", "set": {"notes": "a"}},
        {"entity": "source", "key": "1", "delete": True},
        {"entity": "setting", "key": "stats_n", "delete": True},
        {"entity": "setting", "key": "stats_n", "set": {"n": 6}},
        "not an object",
    ],
)
def test_parse_op_rejects_bad_shapes(raw):
    with pytest.raises(OpError):
        parse_op(raw)


@pytest.mark.parametrize(
    "entity,key,parts",
    [
        ("day", "2028-02-29", ("2028-02-29",)),
        ("temp", "2026-11-18/2", ("2026-11-18", 2)),
        ("cycle", UUID, (UUID,)),
        ("source", "1", (1,)),
        ("setting", "stats_n", ("stats_n",)),
    ],
)
def test_split_key_accepts_valid_keys(entity, key, parts):
    assert split_key(entity, key) == parts


@pytest.mark.parametrize(
    "entity,key",
    [
        ("day", "2026-13-01"),
        ("day", "2026-5-10"),
        ("temp", "2026-11-18"),
        ("temp", "2026-11-18/3"),
        ("cycle", "not-a-uuid"),
        ("cycle", UUID.upper()),
        ("source", "3"),
        ("setting", "language"),
    ],
)
def test_split_key_rejects_invalid_keys(entity, key):
    with pytest.raises(OpError):
        split_key(entity, key)


def test_errors_name_the_field_and_do_not_echo_the_value():
    with pytest.raises(OpError) as info:
        check_row("day", day(bleeding="heavy_flow"))

    assert str(info.value).startswith("bleeding:")
    assert "heavy_flow" not in str(info.value)
