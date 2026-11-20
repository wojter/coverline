# Coverline – Functional Spec (PoC)

> Functional requirements only. Architecture is specified separately.
> UI languages: English and Polish (default PL). Single user.
> Convention: identifiers in `code`, labels given as **EN / PL**. All enum values are listed in section 2.4.

## 0. Context

- A PWA for the **symptothermal method**. It replaces the paper card "Karta obserwacji cyklu wg metody objawowo-termicznej podwójnego sprawdzenia" (PSNNPR).
- **Two temperature sources** (e.g. different thermometers or measurement sites). The goal is to find out which one shows the temperature rise best.
- **Each source is analysed independently.** Temperatures from the two sources are never compared or subtracted.
- **No rules engine in the PoC.** Interpretation is manual. Only plain arithmetic and data lookups are computed.
- **Every field is optional.** A day can be saved with partial data and edited at any time. An empty field means "not recorded", never "dry".

## 1. Glossary

| EN | PL | Meaning |
|---|---|---|
| Cycle | Cykl | From its `start_date` to its end: the day before the next cycle starts, or its `end_date` if set (see 2.5). |
| Completed cycle | Cykl zakończony | A cycle that has an end: a later cycle exists or `end_date` is set. |
| Excluded cycle | Cykl pominięty | A cycle kept, shown and printed, but left out of statistics (see 2.5). |
| Cycle day | Dzień cyklu | `date - start_date + 1` |
| Source | Pomiar | A user-named measurement method with an assigned site. Exactly 2. |
| Excluded reading | Pominięty pomiar | A reading kept in the data but ignored by the curve. |
| Coverline | Linia pokrywająca | Manual, per source. |
| Third high day | Trzeci dzień temperatury powyżej linii pokrywającej | The day marked `3` on a source's track. |
| Mucus peak | Szczyt objawu śluzu | The day marked `P` on the mucus track. |
| Count marks | Oznaczenia | Manual per-day marks on 3 separate tracks: mucus (P, 1, 2, 3), source 1 and source 2 (1, 2, 3, 4). |
| Fertile days | Dni płodne | Manual range `fertile_start` to `fertile_end`. |

## 2. Data

### 2.1 Per day (all optional)

| Field | EN / PL | Values | Card row |
|---|---|---|---|
| `cycle_start` | Cycle day 1 / 1. dzień cyklu | bool. Not stored per day: it shows whether a cycle starts on this day. Changing it follows 2.5. | – |
| `temps[s].value` | Temperature / Temperatura | °C, 2 decimals, within the source's valid range (see Rules) | Temperatura |
| `temps[s].excluded` | Exclude / Pomiń | bool | – |
| `disturbances` | Disturbances / Zakłócenia | multi: `disturbance` | – |
| `bleeding` | Bleeding / Krwawienie | `bleeding` | Krwawienie/brudzenie/plamienie |
| `mucus_sensation` | Sensation / Odczucie | `sensation` | Sucho, Wilgotno, Mokro/ślisko/naoliw. |
| `mucus_features` | Mucus appearance / Wygląd śluzu | multi: `mucus_feature` | Rozciągliwy, Przejrzysty, Lepki gęsty, Mętny |
| `mucus_atypical` | Atypical discharge / Śluz/wydzielina nietypowa | bool | Śluz/wydzielina nietypowa |
| `mucus_quality` | Mucus quality / Jakość śluzu | `mucus_quality`. Derived, overridable (see 4.2). | – |
| `symptoms` | Additional symptoms / Objawy dodatkowe | multi: `symptom` | Ból owulacyjny, Napięcie w piersiach |
| `intercourse` | Intercourse / Współżycie | multi: `intercourse` | Współżycie: rano / wieczór |
| `chart_note` | Chart comment / Komentarz na karcie | text, max 30 characters (e.g. "ból gardła"). Shown on the chart (see F3). | – |
| `mark_mucus` | Mucus mark / Oznaczenie śluzu | `P`, `1`, `2`, `3` | Szczyt śluzu |
| `mark_temp[s]` | Temperature mark / Oznaczenie temperatury | `1`, `2`, `3`, `4`, per source (`4` for rule exceptions) | – |
| `notes` | Notes / Notatki | text, not shown on the chart. The measurement time goes here if the user wants it. | Godzina pomiaru temperatury |

Rules:
- No dedicated measurement-time field. The user writes the time in `notes`.
- Valid temperature range is set per source, with defaults by site:
  - `oral`, `vaginal`, `rectal`: 35.50–38.00 °C
  - `finger`, `wrist`, `other`: 33.00–38.00 °C (skin readings run lower)
  - Values outside the range are rejected as typos.
- Within one cycle, each mark value appears at most once per track. Assigning a value that is already used in that cycle moves it to the new day.
- If a value still ends up on more than one day of a cycle (after a cycle boundary moves, or after offline edits from two devices are synced), the chart shows a warning and computed values use the earliest of those days until the user fixes it.
- Marks do not have to fall on consecutive days. A day can be left unmarked (e.g. a disturbed or excluded reading) and counting continues on the next day.
- A temperature mark can only be placed on a day where that source has a non-excluded reading. Excluding or clearing the reading removes its mark.
- If the marks on a track are not in ascending date order, the app shows a warning but does not block the save.
- A day can carry a reading from source 1, from source 2, from both, or from neither.

### 2.2 Per cycle, manual

| Field | EN / PL | Values |
|---|---|---|
| `start_date` | Cycle start / Początek cyklu | date. Set with Cycle day 1 or moved later (see 2.5). |
| `end_date` | Cycle end / Koniec cyklu | date, optional. Only for when the next cycle start is not recorded (see 2.5). |
| `excluded_from_stats` | Exclude from stats / Pomiń w statystykach | bool (see 2.5) |
| `intention` | Conception / Poczęcie dziecka | `intention`. Copied from the settings default when the cycle is created. Changing the default later does not change existing cycles. |
| `first_mucus_day` | First mucus day / Dzień wystąpienia pierwszego śluzu | date. Prefilled with the first day where `mucus_quality ≥ less_fertile`. User confirms. |
| `first_hf_mucus_day` | First highly fertile mucus day / Pierwszy dzień wystąpienia śluzu wysoce płodnego | date. Prefilled with the first day where `mucus_quality = highly_fertile`. User confirms. |
| `coverline[s]` | Coverline / Linia pokrywająca | temperature, per source |
| `fertile_start`, `fertile_end` | Fertile days / Dni płodne | date range |
| `prev_cycle_rise` | Temperature rise in previous cycle / Wzrost temperatury w poprzednim cyklu | bool. Prefilled from 2.3. Overridable. |
| `notes` | Cycle notes / Notatki cyklu | text |

### 2.3 Per cycle, computed (read-only)

| Value | EN / PL | Rule |
|---|---|---|
| Cycle number | Cycle no. / Cykl nr | Sequential, plus a starting offset from settings. |
| Cycle length | Cycle length / Długość cyklu | From the start to the end of the cycle, inclusive (see 2.5). An open cycle shows the current cycle day instead. |
| Last day of menstruation | Last day of period / Ostatni dzień miesiączki | Last day of the run of `bleeding` days that starts on day 1. A day with staining, spotting or nothing recorded ends the run. To correct it, edit the bleeding entries of those days. |
| Shortest / longest of last N | Shortest / longest of last N / Najkrótszy / najdłuższy z ostatnich N cykli | The N most recent completed, non-excluded cycles that ended before the viewed cycle starts. N from settings (default 12). Shown with the number of cycles used (e.g. "from 8 cycles"). |
| Shortest − 21 / − 20 | Shortest cycle minus 21/20 / Najkrótszy cykl minus 21/20 | Informational. Both values shown. Based on the same cycles as shortest / longest. |
| `mucus_peak` | Mucus peak day / Dzień szczytu objawu śluzu | The day with `mark_mucus = P`. |
| Mucus peak +3 | Mucus peak +3 / Szczyt śluzu +3 | `mucus_peak + 3 days` |
| `third_high_day[s]` | Third high day / Trzeci dzień temperatury powyżej linii pokrywającej | The day with `mark_temp[s] = 3`. |
| Luteal length `[s]` | Luteal phase length / Długość fazy lutealnej | Per source: from the day with `mark_temp[s] = 1` to the last cycle day, inclusive. Completed cycles only. |
| Previous cycle rise | Rise in previous cycle / Wzrost w poprzednim cyklu | true if the previous cycle has a `third_high_day` for either source. |
| Measurement site `[s]` | Measurement site / Miejsce pomiaru | From the source `site`. |

### 2.4 Value codes (stored language-neutral, labels translated)

| Enum | Code | EN | PL |
|---|---|---|---|
| `bleeding` | `bleeding` | Bleeding | Krwawienie |
| | `staining` | Brown staining | Brudzenie |
| | `spotting` | Spotting | Plamienie |
| `sensation` | `dry` | Dry | Sucho |
| | `moist` | Moist | Wilgotno |
| | `wet` | Wet / slippery / oily | Mokro / ślisko / naoliwione |
| `mucus_feature` | `cloudy` | Cloudy | Mętny |
| | `sticky` | Sticky, thick | Lepki, gęsty |
| | `clear` | Clear | Przejrzysty |
| | `stretchy` | Stretchy | Rozciągliwy |
| `mucus_quality` | `none` | No mucus | Brak śluzu |
| | `less_fertile` | Less fertile | Mniej płodny |
| | `highly_fertile` | Highly fertile | Wysoce płodny |
| `symptom` | `ovulation_pain` | Ovulation pain | Ból owulacyjny |
| | `breast_tension` | Breast tension | Napięcie w piersiach |
| `disturbance` | `alcohol` | Alcohol | Alkohol |
| | `short_sleep` | Short sleep | Krótki sen |
| | `late_measurement` | Late measurement | Późny pomiar |
| | `illness` | Illness | Choroba |
| | `stress` | Stress | Stres |
| | `travel` | Travel | Podróż |
| `intercourse` | `morning` | Morning | Rano |
| | `evening` | Evening | Wieczór |
| `intention` | `avoid` | Avoiding pregnancy | Odkładane |
| | `conceive` | Trying to conceive | Planowane |
| `site` | `oral` | Oral | Usta |
| | `vaginal` | Vaginal | Pochwa |
| | `rectal` | Rectal | Odbyt |
| | `finger` | Finger | Palec |
| | `wrist` | Wrist | Nadgarstek |
| | `other` | Other | Inne |
| `marker` | `circle`, `square`, `triangle`, `diamond` | – | – |

### 2.5 Cycle boundaries and corrections

- A cycle has its own `start_date` and an optional `end_date`.
- A cycle ends on the earlier of:
  - the day before the next cycle starts
  - its `end_date`, if set
  - With neither, the cycle is open (the current cycle).
- Cycles never overlap, and no two cycles start on the same day. A start can never be moved onto or past a neighbouring cycle's start.
- `end_date` is only for when the next start is not recorded: a break in observations, or a single paper card entered without the next one. Days after it and before the next cycle start belong to no cycle: they have no cycle day, are not counted as missing readings and are on no chart.
- **Checking Cycle day 1** (F1, F2, F4):
  - On a day within the first 7 days of an existing cycle, the app asks: **Move the start here / Przesuń początek tutaj** or **Start a new cycle / Rozpocznij nowy cykl**. Typical case: day 1 was marked on spotting, and the bleeding really started a day later.
  - Otherwise it starts a new cycle, and the cycle the day falls in ends the day before. If that cycle had an `end_date`, the new cycle takes it over.
- **Unchecking Cycle day 1** on a cycle start asks: **Move the start to another day / Przesuń początek na inny dzień** (date picker) or **Remove this cycle start / Usuń początek cyklu**.
  - Removing joins the days to the previous cycle (unless that cycle has an `end_date`, in which case they belong to no cycle). If the removed cycle had an `end_date` and the previous one has none, the previous cycle takes it over.
  - The removed cycle's fields from 2.2 are deleted (they stay in history).
- **Moving a start** keeps every field from 2.2. The dates stored in 2.2 (`first_mucus_day`, `first_hf_mucus_day`, `fertile_start`, `fertile_end`) are never moved automatically. If one falls outside the cycle after a change, F3 flags it for the user to fix. Count marks that land in another cycle follow the duplicate rule in 2.1.
- **Exclude from stats:** for disturbed (illness, travel) or incomplete cycles. The cycle stays visible, editable and printable, and is marked as excluded. It is left out of: average, min and max length; shortest / longest of last N; shortest − 21 / − 20; the F1 ring average; the source evaluation in F5.
- Cycle numbers count every cycle, excluded or not.

## 3. Views

### F1. Today / Dziś (`/`)

- Shows the cycle day, a ring (current day vs average length) and the intention. With no completed cycles yet, the ring shows only the cycle day. If today belongs to no cycle (after an `end_date`), it shows "no current cycle / brak bieżącego cyklu" instead.
- Quick form with the most-used fields:
  - both temperatures
  - sensation and mucus appearance
  - bleeding
  - disturbances
  - cycle day 1 (see 2.5)
- Can be filled in parts (e.g. temperatures in the morning, mucus in the evening). Data already saved for today is prefilled.
- Save, with sync status. Link to the full form (F2).
- Fast temperature input:
  - 3 digits get a leading `3` and a decimal point after 2 digits (`645` becomes `36.45`)
  - 4 digits get a decimal point after 2 digits (`3645` becomes `36.45`)
  - a comma or a dot is accepted as the decimal separator

### F2. Day entry / Wpis (`/wpis/:date`)

- All fields from 2.1, any date, previous and next day navigation.
- Chip buttons, no dropdowns.
- `mucus_quality` shows its derived value and can be overridden. Overrides are visually marked and can be reset.
- An info icon opens the mucus definitions (see 4.3).
- `chart_note` is a single-line input with a character counter (max 30).
- Count marks: chips for `mark_mucus` and for `mark_temp[s]` of each source.
- Cycle day 1 shows the prompts from 2.5.

### F3. Cycle chart / Karta cyklu (`/karta/:date`)

Layout mirrors the paper card. Rows top to bottom:

1. Date / Data
2. Temperature grid / Temperatura: one shared scale for both sources, 0.05 °C steps, default 36.00–37.30, auto-extended if any reading falls outside
3. Cycle day / Dzień cyklu
4. Bleeding / Krwawienie
5. Mucus peak / Szczyt śluzu: manual `mark_mucus` (P, 1, 2, 3)
6. Mucus rows in card order:
   - Wet/slippery/oily / Mokro/ślisko/naoliw.
   - Stretchy / Rozciągliwy
   - Clear / Przejrzysty
   - Moist / Wilgotno
   - Sticky, thick / Lepki, gęsty
   - Cloudy / Mętny
   - Dry / Sucho
7. Atypical discharge / Śluz/wydzielina nietypowa
8. Additional symptoms / Objawy dodatkowe: ovulation pain, breast tension
9. Fertile days / Dni płodne (shaded band)
10. Intercourse / Współżycie (morning / evening)
11. Disturbances / Zakłócenia (not on the paper card)

Temperature curves:
- 2 curves, each with its own colour **and marker shape**, so they stay legible in black and white.
- Each source can be toggled on and off.
- Each source has its own coverline (a horizontal line).
- `mark_temp[s]` (1, 2, 3, 4) is drawn above that source's point, in the source colour.
- Excluded readings are hollow markers and are skipped by the line, which joins their neighbours.
- A day with no reading breaks the line.
- Days with disturbances get a marker on the point.

Day comment (`chart_note`):
- Drawn inside that day's column of the temperature grid.
- The text is rotated 90° and reads bottom to top.
- It is anchored to the top edge of the grid (the highest temperature row). Read rotated, it is right-aligned.
- Muted colour, drawn behind the curves and points.
- Text that does not fit is cut with an ellipsis. Tapping the column shows the full text.

Columns:
- At least 40, extended for longer cycles.
- Horizontal scroll on mobile, with today scrolled into view.

Interpretation and navigation:
- Summary panel (like the card's right-hand column): everything from 2.2 and 2.3.
  - The start date, end date and exclude-from-stats are edited here (see 2.5).
  - Dates from 2.2 that fall outside the cycle are flagged.
  - An excluded cycle is clearly marked, on screen and in print.
- An "Interpretation / Interpretacja" editor:
  - sets the coverline per source (typed or tapped on the grid) and the fertile days
  - has a count-mark mode: pick a track (Mucus / Śluz, source 1, source 2) and a mark, then tap day columns to assign or remove it
  - count marks can also be set in F2
- Tap a day column to open `/wpis/:date`.
- Previous and next cycle navigation, plus a list of all cycles (number, dates, length, excluded marker) to jump to any of them.
- `/karta/:date` accepts any date inside a cycle and changes the URL to that cycle's start, so old links still work after a start is moved.

Print:
- A4 landscape, one page per cycle, in the selected language.
- Readable in black and white. Includes the legend, the mucus definitions and the day comments.

### F4. Calendar / Kalendarz (`/kalendarz`)

- Month grid, Monday first.
- Each day shows: bleeding, cycle start, mucus quality (colour), mucus peak, fertile band, a marker per recorded source.
- Days outside any cycle are shown muted, without a cycle day.
- Tap a day to open its entry.
- Cycle start can be set on past dates, to backfill history from the paper cards (start dates alone are enough for shortest/longest).
- A **Mark cycle starts / Zaznacz początki cykli** mode sets or removes a cycle start with one tap per day, without opening the entry. The prompts from 2.5 still apply.

### F5. Stats / Statystyki (`/statystyki`)

Cycles:
- Count, plus average, min and max length (completed, non-excluded cycles; overall and over the last N).

Per-cycle table, one row per cycle:
- start date and length
- last day of menstruation
- mucus peak (as a cycle day)
- fertile start and end
- **per source:** third high day, luteal length
- tap a row to open that cycle's chart
- excluded cycles are listed and marked, but left out of the totals above and of the source evaluation below

Source evaluation, per source independently and shown side by side, to help choose a thermometer:
- days with a reading, missing days (cycle days with no reading), excluded readings
- cycles with a rise marked (`third_high_day` set) out of completed cycles
- days from `mucus_peak` to `third_high_day`, per cycle

### F6. Settings / Ustawienia (`/ustawienia`)

- **Sources / Pomiary (2):**
  - name: free text, e.g. "Pomiar termometrem X". Defaults are "Pomiar 1" / "Pomiar 2" (EN: "Measurement 1" / "Measurement 2").
  - site, colour, marker shape
  - valid temperature range (defaults from the site, editable)
  - The name and site are shown everywhere: forms, chart legend, stats, export.
- **Language / Język:** English / polski.
- **Cycle / Cykl:** default intention (copied to new cycles), starting cycle number, N for shortest/longest.
- **Data / Dane:** export CSV and JSON, sync queue status, manual sync, logged-in email.

## 4. Cross-cutting rules

### 4.1 Input and data

- Entering both temperatures takes 20 seconds or less on a phone.
- Partial saves merge:
  - fields the user did not touch are kept
  - fields the user explicitly cleared are cleared
- Offline-first: an entry is never lost.
- Every update or delete snapshots the changed day or cycle to history. No history UI in the PoC.

### 4.2 Derived mucus quality (overridable)

| Code | Condition (first match wins) |
|---|---|
| `highly_fertile` | sensation `wet`, **or** features contain `clear` or `stretchy` |
| `less_fertile` | sensation `moist`, **or** features contain `cloudy` or `sticky` |
| `none` | sensation `dry` and no features |
| (empty) | no sensation and no features recorded |

### 4.3 Mucus definitions (help text, from the card footer)

| Code | EN | PL |
|---|---|---|
| `stretchy` | **Stretchy:** can be stretched into a thread, elastic. | **Rozciągliwy:** możliwy do rozciągnięcia w nitkę, elastyczny. |
| `clear` | **Clear:** like raw egg white, glassy. | **Przejrzysty:** jak białko surowego jajka, szklisty. |
| `sticky` | **Sticky, thick:** sticks or breaks when you try to stretch it, gluey. | **Lepki, gęsty:** lepi się lub zrywa przy próbie rozciągania, kleisty. |
| `cloudy` | **Cloudy:** not transparent: white, milky, yellowish, sometimes lumpy. | **Mętny:** nieprzejrzysty, białawy, mleczny, żółtawy, czasem grudki, kłaczki. |

### 4.4 Languages (EN, PL)

- Every UI text comes from translation files (`en`, `pl`). No hardcoded strings.
- The default language follows the browser (`pl` for Polish, otherwise `en`). It can be changed in settings.
- Stored values are codes from 2.4. Only labels are translated.
- User-entered text (source names, notes, chart comments) is never translated.
- Date format and decimal separator follow the selected language. The week always starts on Monday.
- Print and the mucus definitions use the selected language.
- CSV export:
  - PL: `;` separator, decimal comma, Polish headers.
  - EN: `,` separator, decimal point, English headers.
  - Both are UTF-8 with a BOM.
  - Multi-select values are split into separate 0/1 columns.
- JSON export: full dump with codes, language-independent.

## 5. Backlog (priority order)

1. **Phase 2: cervix observation / obserwacja szyjki macicy:**
   - position, opening, firmness
   - cervix peak and +3
   - chart rows
2. Edit history UI (view and restore), deleting a day from the UI
3. Import (own JSON/CSV, drip.)
4. Reminders: morning measurement, breast self-exam after menstruation
5. Rules engine for the symptothermal method (suggestions only, with an explanation)
6. Custom symptoms and disturbances, LH and pregnancy tests
7. Read-only partner access, PIN lock, encryption at rest
8. Single-source chart view (one source at a time, its own scale; one print page per source)

## 6. Decisions

1. There is no "nothing felt" sensation. Only `dry` / `moist` / `wet`, or empty (not recorded).
2. Intercourse is recorded as `morning` / `evening` only.
3. Luteal length is counted from the day marked `1` on that source's track to the last cycle day.
4. Exactly 2 sources. Each has a user-defined name and a site (`finger` included).
5. The two temperature sources are not compared numerically. Each is interpreted on its own.
6. Day comment: max 30 characters, drawn vertically at the top of the temperature grid.
7. A day with no reading breaks the curve. An excluded reading is skipped, and the line joins its neighbours.
8. No measurement-time field. The time goes into `notes`.
9. Count marks are manual and kept separately per track: mucus P, 1, 2, 3; each temperature source 1, 2, 3, 4. Mucus peak and third high day are derived from them.
10. Temperature validation: range per source, with defaults by site (35.50–38.00 core, 33.00–38.00 skin).
11. Count marks may skip days (e.g. a disturbed reading). They cannot be placed on an excluded reading or a missing reading.
12. One shared temperature scale for both sources. This assumes sources with similar values (oral, vaginal, rectal). A skin source will stretch the grid, and that is accepted for the PoC.
13. Cycles are stored with their own start date and an optional end date. Moving a start keeps the cycle's data. The end date is only for breaks in observations.
14. A cycle can be excluded from statistics. It stays visible and printable.
15. Shortest / longest of last N and −21 / −20 are always computed for the viewed cycle, from cycles that ended before it.

## 7. Acceptance criteria

- Every card row (except the cervix) can be recorded and is rendered on the chart in card order.
- A `chart_note` is rendered vertically in its day column, anchored to the top of the temperature grid, both on screen and in print.
- A partial save followed by a second save of the same day loses no data.
- A full cycle prints on one A4 landscape page and is readable in black and white.
- An offline entry syncs automatically once the connection returns. Nothing is lost.
- The CSV opens correctly in Polish Excel (PL export) and English Excel (EN export).
- The whole UI, the print and the export are available in EN and PL. Switching language does not change any stored data.
- Computed values (length, shortest/longest, −20/−21, +3, luteal length) match a hand calculation on 3 sample cycles.
- Moving a cycle start (in either direction) keeps all data entered for that cycle, and an old chart link still opens it.
- Excluded cycles and days outside any cycle do not change any statistic.
