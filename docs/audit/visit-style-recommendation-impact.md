# Visit Style Recommendation Impact Audit

Status:

`AUDIT COMPLETE / REPRESENTATIVE RANKING REGRESSION NOT OBSERVED`

Date:

`2026-09-09`

## 0. Purpose

Evidence-based canonicalization of `Shrine.visit_style_tags` changed shrine-side visit style data.

This audit verifies whether those data changes:

1. change supported `score_visit_style`,
2. propagate into internal Recommendation ranking score,
3. change representative Top3 results,
4. cause ranking churn in the pre-trim candidate pool,
5. cause ranking changes when major visit-style conditions are explicitly exercised.

This audit does not change Recommendation logic.

## 1. Scope

Target:

* Shrine seed total: 103
* AFTER:

  * `backend/temples/data/shrines_seed_clean.json`
* BEFORE snapshot:

  * `backend/temples/data/ops/visit_style_production_before_20260909T040450Z.json`

BEFORE / AFTER identity:

* `name_jp`
* `address`

Primary visit-style impact tags:

* `quiet`
* `reset`
* `business`
* `nature`
* `classic`

Supported visit-style scoring paths additionally include:

* `less_crowded`
* `nearby`
* `study`

Structured Level 2 Visit Preference does not expose `business`; `business` remains reachable through the legacy `extra_condition` visit-style path.

## 2. Global visit_style_tags Distribution

Before / After across 103 shrines:

| Tag          | Before | After | Delta |
| ------------ | -----: | ----: | ----: |
| business     |     47 |    22 |   -25 |
| classic      |     72 |    84 |   +12 |
| formal       |      1 |     0 |    -1 |
| less_crowded |      3 |     3 |     0 |
| love         |     11 |     0 |   -11 |
| nature       |     36 |    25 |   -11 |
| quiet        |     48 |    14 |   -34 |
| reset        |     63 |    29 |   -34 |
| study        |      7 |     9 |    +2 |
| tourism      |      1 |     0 |    -1 |
| urban        |     68 |    21 |   -47 |

This distribution comparison alone does not establish Recommendation ranking impact.

## 3. Public score_total Contract

Public/API `breakdown.score_total` does not include `score_visit_style`.

Current public score formula:

```text
score_total =
  score_element * w1
+ score_need * w2
+ score_popular * w3
+ astro_bonus
```

Therefore a change limited to `visit_style_tags` does not directly change public `score_total` for the same shrine and same request.

Result:

`PASS`

## 4. score_visit_style Before / After

Supported visit-style tags used for controlled scoring audit:

```text
quiet
less_crowded
nearby
nature
reset
classic
business
study
```

Results:

| Tag          | Matched Before | Matched After | Changed Shrines |
| ------------ | -------------: | ------------: | --------------: |
| quiet        |             48 |            14 |              34 |
| less_crowded |              3 |             3 |               0 |
| nearby       |              0 |             0 |               0 |
| nature       |             36 |            25 |              15 |
| reset        |             63 |            29 |              34 |
| classic      |             72 |            84 |              14 |
| business     |             47 |            22 |              25 |
| study        |              7 |             9 |               2 |

All-supported synthetic score distribution:

Before:

```text
0: 5
1: 3
2: 43
3: 30
4: 13
5: 9
```

After:

```text
0: 1
1: 40
2: 40
3: 22
```

Summary:

* Changed shrines: `49 / 103`
* Change rate: approximately `47.6%`
* Maximum absolute `score_visit_style` delta: `4`

This confirms that canonicalization reaches the visit-style scoring signal.

Result:

`EXPECTED SCORE IMPACT OBSERVED`

## 5. Internal Ranking Score Before / After

Internal ranking uses visit style through:

```text
score_visit_style * w5
```

with:

```text
w5 = 0.35
```

Controlled Before / After results:

```text
TOTAL                   103
CHANGED_SHRINES          49
RANKED_EQUALS_INTERNAL   True
MAX_ABS_BASE_DELTA       1.4
MAX_ABS_RANKED_DELTA     1.4
```

Internal score delta distribution:

| Delta | Shrines |
| ----: | ------: |
| -1.40 |       7 |
| -1.05 |      10 |
| -0.70 |      10 |
| -0.35 |      17 |
| +0.35 |       5 |

Summary:

* 44 shrines decreased
* 5 shrines increased
* 54 shrines unchanged
* maximum absolute internal ranking score delta: `1.40`

The observed maximum is consistent with:

```text
score_visit_style delta 4 × w5 0.35 = 1.40
```

No unexplained internal score delta was identified in the controlled audit.

Result:

`EXPECTED INTERNAL SCORE IMPACT OBSERVED`

## 6. Representative Top3 Before / After

Existing Representative Cases:

1. 転職不安
2. 疲労回復
3. 金運・事業
4. 縁結び
5. 学業・集中
6. 厄除け・浄化
7. 旅行・出張安全
8. 相性補助ありの仕事相談

Results:

```text
TOTAL_CASES             8
CHANGED_TOP3_CASES      0
UNCHANGED_TOP3_CASES    8
```

All eight cases returned the same ordered Top3 Before and After.

Result:

`NO TOP3 REGRESSION OBSERVED`

## 7. Representative Ranking Churn

The same eight Representative Cases were compared before Top3 trimming across Top20 ranking output.

Results:

```text
TOTAL_CASES                  8
COMMON_CANDIDATE_CASE_PAIRS  160
MOVED_CANDIDATE_CASE_PAIRS   0
RANK_CHURN_RATE              0.0

MEAN_ABS_RANK_SHIFT          0.0
MEAN_ABS_RANK_SHIFT_MOVED    0
MAX_ABS_RANK_SHIFT           0

POOL_CHANGED_CASES           0
TOP10_CHANGED_CASES          0
TOP10_ENTRANTS_TOTAL         0
```

Therefore:

* Top20 candidate membership remained stable.
* No candidate changed rank.
* No Top10 entry/exit was observed.
* Top3 remained stable.

Result:

`NO REPRESENTATIVE RANKING CHURN OBSERVED`

## 8. Major Visit-Style Stress Audit

The five highest-priority changed visit-style conditions were explicitly exercised:

* `quiet`
* `reset`
* `business`
* `nature`
* `classic`

Eight Representative Cases were evaluated per condition.

Total:

```text
8 cases × 5 conditions = 40 case-tag pairs
```

Results:

```text
TAG_SUMMARY quiet
CASES 8
TOP3_CHANGED_CASES 0
RANK_CHANGED_CASES 0
MOVED_CANDIDATES 0
MAX_SHIFT 0

TAG_SUMMARY reset
CASES 8
TOP3_CHANGED_CASES 0
RANK_CHANGED_CASES 0
MOVED_CANDIDATES 0
MAX_SHIFT 0

TAG_SUMMARY business
CASES 8
TOP3_CHANGED_CASES 0
RANK_CHANGED_CASES 0
MOVED_CANDIDATES 0
MAX_SHIFT 0

TAG_SUMMARY nature
CASES 8
TOP3_CHANGED_CASES 0
RANK_CHANGED_CASES 0
MOVED_CANDIDATES 0
MAX_SHIFT 0

TAG_SUMMARY classic
CASES 8
TOP3_CHANGED_CASES 0
RANK_CHANGED_CASES 0
MOVED_CANDIDATES 0
MAX_SHIFT 0
```

Aggregate:

```text
TOTAL_CASE_TAG_PAIRS       40
TOTAL_TOP3_CHANGED         0
TOTAL_RANK_CHANGED_CASES   0
TOTAL_MOVED_CANDIDATES     0
DIRECT_VISIT_STYLE_MOVES   0
```

No shrine required individual rank-change root-cause investigation because no ranking movement occurred.

Result:

`NO STRESS-CASE RANKING REGRESSION OBSERVED`

## 9. Intentionality Assessment

The shrine-side `visit_style_tags` canonicalization was performed under an Evidence Policy.

Examples of policy behavior include:

* avoiding fixed `quiet`, `less_crowded`, or `reset` claims without sufficient stable Evidence,
* requiring shrine-linked environmental Evidence for `nature`,
* requiring historical, cultural, or long-term institutional Evidence for `classic`,
* requiring explicit academic or commercial relationship for `study` / `business`,
* not treating generic location strings as sufficient Evidence for unrelated attributes.

The observed `score_visit_style` and internal `_score_total` changes are consistent with these shrine-side canonical tag changes.

The controlled score delta is explained by the existing Recommendation formula:

```text
visit_style tag difference
→ score_visit_style difference
→ score_visit_style × 0.35
→ internal ranking score difference
```

No evidence was found that Recommendation logic itself changed or produced unexplained score behavior.

Representative and stress-case ranking regression was not observed.

## 10. Final Assessment

Audit conclusion:

`PASS WITH EXPECTED SCORE IMPACT`

Observed:

* shrine-side canonical visit-style data changed,
* supported `score_visit_style` changed,
* internal ranking scores changed as expected,
* public `score_total` contract remained unaffected,
* Representative Top3 changed in `0 / 8` cases,
* Representative Top20 ranking churn was `0 / 160` candidate-case pairs,
* explicit major visit-style stress testing changed rankings in `0 / 40` case-tag pairs.

Therefore, within this audit scope:

> The observed scoring changes are explainable as intentional consequences of Evidence-based `visit_style_tags` canonicalization. No Recommendation ranking regression requiring Recommendation logic modification was observed.

## 11. Recommendation Logic Decision

Recommendation logic changes:

`NONE`

This audit does not modify:

* ranking weights,
* Recommendation formulas,
* candidate retrieval,
* need matching,
* behavior signals,
* profile signals,
* direction signals,
* frontend behavior.

## 12. Completion

* [x] visit_style_tags global Before / After distribution
* [x] public score_total contract verification
* [x] score_visit_style Before / After
* [x] internal score_total_ranked / _score_total Before / After
* [x] Representative Top3 comparison
* [x] Representative ranking churn
* [x] quiet / reset / business / nature / classic stress audit
* [x] rank-change root-cause review (no changed shrine / N/A)
* [x] intentional canonicalization assessment
* [x] Recommendation logic unchanged
* [x] Audit result documented
