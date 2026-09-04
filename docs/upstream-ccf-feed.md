# CCF Deadlines `.ics` feed — observed upstream format

Verified against the live feed on 2026-09-04 (`https://ccfddl.com/conference/deadlines_en.ics`,
1.34 MB, 2029 VEVENTs) and against the generator source
`extensions/cli/ccfddl/convert_to_ical.py` in `github.com/ccfddl/ccf-deadlines`.
Real trimmed samples live in `tests/fixtures/ccf/`. **Never** fabricate fields the feed does not carry.

## URLs

| Purpose | URL |
| --- | --- |
| English, unfiltered | `https://ccfddl.com/conference/deadlines_en.ics` |
| Simplified Chinese, unfiltered | `https://ccfddl.com/conference/deadlines_zh.ics` |
| Filtered | `https://ccfddl.com/conference/deadlines_{lang}[_ccf_{R}][_core_{R}][_thcpl_{R}][_{SUB}].ics` |

Filter order is fixed: CCF rank, CORE rank, TH-CPL rank, subject. `A*` is written `Astar`.
Confirmed live: `deadlines_en_core_Astar_SE.ics`, `deadlines_en_ccf_A.ics`, `deadlines_en_AI.ics`,
`deadlines_en_core_A_thcpl_B_SE.ics`, `deadlines_zh_ccf_B_DB.ics`.

Ranks: CCF `A|B|C`; CORE `A*|A|B|C`; TH-CPL `A|B`. Subjects (from `conference/types.yml`):

| sub | name_en | name (zh) |
| --- | --- | --- |
| DS | Computer Architecture/Parallel Programming/Storage Technology | 计算机体系结构/并行与分布计算/存储系统 |
| NW | Network System | 计算机网络 |
| SC | Network and System Security | 网络与信息安全 |
| SE | Software Engineering/Operating System/Programming Language Design | 软件工程/系统软件/程序设计语言 |
| DB | Database/Data Mining/Information Retrieval | 数据库/数据挖掘/内容检索 |
| CT | Computing Theory | 计算机科学理论 |
| CG | Graphics | 计算机图形学与多媒体 |
| AI | Artificial Intelligence | 人工智能 |
| HI | Computer-Human Interaction | 人机交互与普适计算 |
| MX | Interdiscipline/Mixture/Emerging | 交叉/综合/新兴 |

## HTTP behaviour

Served by GitHub Pages behind Fastly. Response carries `ETag: "6a9ae4e5-147209"`,
`Last-Modified`, `Cache-Control: max-age=600`, `Content-Type: text/calendar`,
`Access-Control-Allow-Origin: *`. Conditional requests with `If-None-Match` /
`If-Modified-Since` return 304. The file is regenerated periodically (DTSTAMP changes each time).

## Calendar structure

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//会议截止日历//ccfddl.com//
BEGIN:VTIMEZONE              # one per fixed offset used, e.g. TZID:UTC-12:00
TZID:UTC-12:00
BEGIN:STANDARD
DTSTART:19700101T000000
TZNAME:UTC-12:00
TZOFFSETFROM:-1200
TZOFFSETTO:-1200
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT ... END:VEVENT  # one per deadline (abstract or full) per round
END:VCALENDAR
```

Timezones are **fixed offsets only**, TZID pattern `UTC[+-]HH:00` (16 distinct; `UTC-12:00` covers 76%).
A few events use absolute UTC (`DTSTART:20210127T220000Z`). If the yml deadline has no time
(`YYYY-MM-DD`), the generator emits an all-day `DTSTART;VALUE=DATE` with a one-day DTEND (rare).

## VEVENT fields

```
SUMMARY:AAAI 2026 Deadline                     # "{title} {year} Deadline" | "{title} {year} Abstract Deadline"
SUMMARY:ISS 2025 Deadline [Second round 2025]  # optional " [{comment}]" suffix = round/comment
DTSTART;TZID="UTC-12:00":20250801T235959       # deadline instant in the original fixed offset
DTEND;TZID="UTC-12:00":20250802T000059         # always DTSTART + 1 minute (or +1 day if all-day)
DTSTAMP:20260904T153030Z                       # generation time, NOT an upstream "updated at"
UID:f25f3c26-855d-48e1-8b89-7f09cafb06f4       # uuid4 — RANDOM ON EVERY REGENERATION (see below)
DESCRIPTION:<line0>\n🗓️ Date: ...\n📍 Location: ...\n⏰ Original Deadline (AoE): 2025-08-01 23:59:59\nCategory: 人工智能 (AI)\nCCF A, CORE A*, THCPL A\nConference Website: https://...\nDBLP Index: https://dblp.org/db/conf/aaai
LOCATION:Philadelphia, Pennsylvania, USA       # may literally be "TBD"
URL:https://aaai.org/conference/aaai/aaai-26/
```

DESCRIPTION lines (English feed; Chinese labels are `会议时间`, `会议地点`, `原始截止时间`, `分类`, `会议官网`, `DBLP索引`):

| # | Line | Notes |
| --- | --- | --- |
| 0 | `{full conference name}` | e.g. `AAAI Conference on Artificial Intelligence` |
| 1 | `🗓️ Date: {text}` | free text such as `February 22 - March 1, 2022`; may be `TBD` |
| 2 | `📍 Location: {text}` | may be `TBD` |
| 3 | `⏰ Original Deadline ({tz}): {YYYY-MM-DD HH:MM:SS}` | `tz` is the upstream label: `AoE`, `UTC-12`, `UTC-8`, `UTC+8`, `UTC`, `UTC+0` … (18 variants seen). This is the **authoritative original timezone label**; DTSTART's TZID is the numeric equivalent (`AoE` → `UTC-12:00`). |
| 4 | `Category: {zh name} ({SUB})` | subject code in parentheses |
| 5 | `CCF A, CORE A*, THCPL A` | **optional line** — ranks with value `N` are omitted; the line is absent when all are `N` (54 events have 7 lines). Any subset appears, e.g. `CCF C`, `CORE A`, `CCF B, THCPL B`. |
| 6 | `Conference Website: {url}` | same as `URL:` property |
| 7 | `DBLP Index: https://dblp.org/db/conf/{key}` | |

Observed `⏰ Original Deadline` labels: AoE(1175) UTC-12(362) UTC-8(94) UTC+0(92) UTC-7(78) UTC(65)
UTC-4(47) UTC-5(40) UTC+8(39) UTC+1(15) UTC+7(6) UTC+10(4) UTC-11(3) UTC+2 UTC-6 UTC-10 UTC+3 UTC+9.
Generator regex for tz: `AoE` → UTC-12; `UTC` → UTC; `UTC([+-])(\d{1,2})$`.

## Identity and change detection — critical

* `UID` is `uuid.uuid4()` per event **per generation**. It differs between `_en` and `_zh` and between
  two fetches. It **cannot** be used as a stable identifier. Derive `stableKey` from normalized
  fields: `subscriptionId` + `conferenceName` (SUMMARY prefix before the year) + `conferenceYear` +
  `deadlineKind` (`abstract` | `deadline`) + normalized `comment` (the `[...]` suffix, lower-cased,
  whitespace-collapsed). Never use array position.
* TBD deadlines are **skipped** by the generator (`if deadline_str == "TBD": continue`), so a TBD
  round never appears in the feed. A round that was present and then disappears from a
  successfully fetched snapshot is the only observable "became TBD / withdrawn" signal. Record it as
  a change (`field: "status"`, previous `upcoming`/`passed`, current `tbd`), keep the record and its
  followed state, clear the countdown, and never invent a date.
* "Conference dates TBD" (`🗓️ Date: TBD`) and "Location TBD" are separate from deadline TBD and
  are displayed as-is.
* Deadline changes show up as a different DTSTART for the same `stableKey`; timezone changes as a
  different `⏰ Original Deadline (tz)` label / TZID; homepage changes as a different `URL`.
* `DTSTAMP` changes every regeneration; do not treat it as an upstream update timestamp.

## Ranking of hosts

Only `https://ccfddl.com` is an approved official host. Anything else is a custom subscription and
must be confirmed by the user with a warning before it is fetched.
