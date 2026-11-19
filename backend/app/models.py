import re
from collections.abc import Callable
from datetime import date
from typing import Annotated, Any, Literal, get_args

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    TypeAdapter,
    ValidationError,
    model_validator,
)

Bleeding = Literal["staining", "spotting", "light", "medium", "heavy"]
MucusSensation = Literal["dry", "moist", "wet"]
MucusFeature = Literal["cloudy", "sticky", "clear", "stretchy"]
MucusQuality = Literal["none", "less_fertile", "highly_fertile"]
Symptom = Literal["ovulation_pain", "breast_tension"]
Disturbance = Literal["alcohol", "short_sleep", "late_measurement", "illness", "stress", "travel"]
Intercourse = Literal["morning", "evening"]
Intention = Literal["avoid", "conceive"]
Site = Literal["oral", "vaginal", "rectal", "finger", "wrist", "other"]
Marker = Literal["circle", "square", "triangle", "diamond"]
MucusMark = Literal["P", "1", "2", "3"]
TempMark = Literal["1", "2", "3", "4"]

DATE_PATTERN = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}")
UUID_PATTERN = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
COLOR_PATTERN = re.compile(r"#[0-9a-f]{6}")
CHART_NOTE_MAX = 30


def is_date(text: str) -> bool:
    if DATE_PATTERN.fullmatch(text) is None:
        return False
    try:
        date.fromisoformat(text)
    except ValueError:
        return False
    return True


def check_date(value: str) -> str:
    if not is_date(value):
        raise ValueError("must be a real YYYY-MM-DD date")
    return value


def check_color(value: str) -> str:
    if COLOR_PATTERN.fullmatch(value) is None:
        raise ValueError("must be #rrggbb in lowercase")
    return value


def check_chart_note(value: str) -> str:
    if len(value) > CHART_NOTE_MAX:
        raise ValueError(f"must be at most {CHART_NOTE_MAX} characters")
    return value


def in_code_order(code: Any) -> Callable[[list[str]], list[str]]:
    order = get_args(code)

    def check(values: list[str]) -> list[str]:
        positions = [order.index(value) for value in values]
        if not positions or positions != sorted(set(positions)):
            raise ValueError("must be a non-empty list in code order, without repeats")
        return values

    return check


DateStr = Annotated[str, AfterValidator(check_date)]
Color = Annotated[str, AfterValidator(check_color)]
ChartNote = Annotated[str, AfterValidator(check_chart_note)]
MucusFeatureList = Annotated[list[MucusFeature], AfterValidator(in_code_order(MucusFeature))]
SymptomList = Annotated[list[Symptom], AfterValidator(in_code_order(Symptom))]
DisturbanceList = Annotated[list[Disturbance], AfterValidator(in_code_order(Disturbance))]
IntercourseList = Annotated[list[Intercourse], AfterValidator(in_code_order(Intercourse))]


class _Row(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")


class SourceRow(_Row):
    name: str
    site: Site
    color: Color
    marker: Marker
    range_min: int
    range_max: int

    @model_validator(mode="after")
    def check_range_order(self):
        if self.range_min >= self.range_max:
            raise ValueError("range_min must be below range_max")
        return self


class CycleRow(_Row):
    start_date: DateStr
    end_date: DateStr | None = None
    excluded_from_stats: bool
    intention: Intention | None = None
    first_mucus_day: DateStr | None = None
    first_hf_mucus_day: DateStr | None = None
    coverline_1: int | None = None
    coverline_2: int | None = None
    fertile_start: DateStr | None = None
    fertile_end: DateStr | None = None
    prev_cycle_rise: bool | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def check_date_order(self):
        if self.end_date is not None and self.end_date < self.start_date:
            raise ValueError("end_date must not be before start_date")
        if self.fertile_start is not None and self.fertile_end is not None:
            if self.fertile_end < self.fertile_start:
                raise ValueError("fertile_end must not be before fertile_start")
        return self


class DayRow(_Row):
    bleeding: Bleeding | None = None
    mucus_sensation: MucusSensation | None = None
    mucus_features: MucusFeatureList | None = None
    mucus_atypical: bool | None = None
    mucus_quality_override: MucusQuality | None = None
    symptoms: SymptomList | None = None
    intercourse: IntercourseList | None = None
    disturbances: DisturbanceList | None = None
    chart_note: ChartNote | None = None
    mark_mucus: MucusMark | None = None
    notes: str | None = None


class TempRow(_Row):
    value: int
    excluded: bool
    mark: TempMark | None = None

    @model_validator(mode="after")
    def check_excluded_mark(self):
        if self.excluded and self.mark is not None:
            raise ValueError("an excluded reading cannot have a mark")
        return self


ROW_MODELS: dict[str, type[_Row]] = {
    "day": DayRow,
    "temp": TempRow,
    "cycle": CycleRow,
    "source": SourceRow,
}

ROW_DEFAULTS: dict[str, dict[str, Any]] = {
    "cycle": {"excluded_from_stats": False},
    "temp": {"excluded": False},
}

SETTING_DEFAULTS: dict[str, Any] = {
    "default_intention": None,
    "cycle_number_start": 1,
    "stats_n": 12,
}

SETTING_TYPES: dict[str, TypeAdapter] = {
    "default_intention": TypeAdapter(Intention | None),
    "cycle_number_start": TypeAdapter(Annotated[int, Field(strict=True, ge=1)]),
    "stats_n": TypeAdapter(Annotated[int, Field(strict=True, ge=1)]),
}


class OpError(Exception):
    pass


class OpBody(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid", populate_by_name=True)

    entity: Literal["day", "temp", "cycle", "source", "setting"]
    key: str
    set_fields: dict[str, Any] | None = Field(default=None, alias="set")
    delete: Literal[True] | None = None

    @model_validator(mode="after")
    def check_set_or_delete(self):
        if (self.set_fields is None) == (self.delete is None):
            raise ValueError("needs either set or delete: true")
        if self.set_fields == {}:
            raise ValueError("set must not be empty")
        return self


def describe(exc: ValidationError, root: str = "row") -> str:
    error = exc.errors()[0]
    field = ".".join(str(part) for part in error["loc"]) or root
    return f"{field}: {error['msg']}"


def parse_op(raw: object) -> OpBody:
    try:
        op = OpBody.model_validate(raw)
    except ValidationError as exc:
        raise OpError(describe(exc, root="op")) from None
    if op.entity in ("source", "setting") and op.delete:
        raise OpError(f"{op.entity} rows cannot be deleted")
    if op.entity == "setting" and set(op.set_fields or {}) != {"value"}:
        raise OpError("setting: set only value")
    return op


def split_key(entity: str, key: str) -> tuple[Any, ...]:
    if entity == "day":
        return (_key_date(key),)
    if entity == "temp":
        day, _, source = key.partition("/")
        if source not in ("1", "2"):
            raise OpError("key: must be <date>/1 or <date>/2")
        return (_key_date(day), int(source))
    if entity == "cycle":
        if UUID_PATTERN.fullmatch(key) is None:
            raise OpError("key: must be a lowercase UUID")
        return (key,)
    if entity == "source":
        if key not in ("1", "2"):
            raise OpError("key: must be 1 or 2")
        return (int(key),)
    if key not in SETTING_TYPES:
        raise OpError("key: unknown setting")
    return (key,)


def _key_date(text: str) -> str:
    if not is_date(text):
        raise OpError("key: must be a real YYYY-MM-DD date")
    return text


def check_row(entity: str, row: dict[str, Any]) -> None:
    try:
        ROW_MODELS[entity].model_validate(row)
    except ValidationError as exc:
        raise OpError(describe(exc)) from None


def check_setting(key: str, value: object) -> None:
    try:
        SETTING_TYPES[key].validate_python(value)
    except ValidationError as exc:
        raise OpError(describe(exc, root="value")) from None


def blank_row(entity: str) -> dict[str, Any]:
    fields = dict.fromkeys(ROW_MODELS[entity].model_fields)
    return {**fields, **ROW_DEFAULTS.get(entity, {})}
