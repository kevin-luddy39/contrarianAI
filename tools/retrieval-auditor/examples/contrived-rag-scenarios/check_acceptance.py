"""Step 7 of SPEC.md — automated acceptance-criteria gate.

Reads:
  results/clean.json
  results/poisoned.json

Checks the publish-gate criteria from SPEC.md §Validation acceptance criteria:

1. Each poisoned query (Q1-Q6, Q8) must transition health > 0.5 (clean) -> < 0.4 (poisoned)
2. Clean queries (Q7, Q9) must hold health > 0.5 in BOTH runs
3. OOD query (Q10) must fire OFF_TOPIC in both runs
4. Each engineered pathology must surface its targeted flag at severity >= 0.4
   in the poisoned run on at least one query
5. No targeted flag may fire on the same query in the clean run

Exit code 0 iff all criteria pass. Anything else -> not publishable yet.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]

HERE = Path(__file__).parent
RESULTS = HERE / "results"
PASS = "PASS"
FAIL = "FAIL"


def load(mode: str) -> dict:
    path = RESULTS / f"{mode}.json"
    if not path.exists():
        sys.exit(f"missing {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def severity_of(audit: dict | None, kind: str) -> float:
    if not audit:
        return 0.0
    for p in audit.get("pathologies") or []:
        if p.get("kind") == kind:
            return float(p.get("severity") or 0.0)
    return 0.0


def main() -> int:
    clean = load("clean")
    poisoned = load("poisoned")

    by_c = {q["id"]: q for q in clean["queries"]}
    by_p = {q["id"]: q for q in poisoned["queries"]}

    fails: list[str] = []

    poisoned_qids = ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q8"]
    for qid in poisoned_qids:
        c = by_c[qid]["summary"]["health"]
        p = by_p[qid]["summary"]["health"]
        if not (isinstance(c, (int, float)) and c > 0.5):
            fails.append(f"Criterion 1: {qid} clean health={c} (must be > 0.5)")
        if not (isinstance(p, (int, float)) and p < 0.4):
            fails.append(f"Criterion 1: {qid} poisoned health={p} (must be < 0.4)")

    for qid in ("Q7", "Q9"):
        c = by_c[qid]["summary"]["health"]
        p = by_p[qid]["summary"]["health"]
        if not (isinstance(c, (int, float)) and c > 0.5):
            fails.append(f"Criterion 2: {qid} clean health={c} (must be > 0.5)")
        if not (isinstance(p, (int, float)) and p > 0.5):
            fails.append(f"Criterion 2: {qid} poisoned health={p} (must be > 0.5)")

    for run_label, by in (("clean", by_c), ("poisoned", by_p)):
        flags = by["Q10"]["summary"]["flags"]
        if "OFF_TOPIC" not in flags:
            fails.append(f"Criterion 3: Q10 {run_label} flags={flags} (must include OFF_TOPIC)")

    targets = {
        "RANK_INVERSION": ["Q3", "Q6"],
        "SCORE_MISCALIBRATED": ["Q1", "Q2", "Q4"],
        "OFF_TOPIC": ["Q5"],
        "LOW_DIVERSITY": ["Q3", "Q8"],
    }
    for kind, qids in targets.items():
        max_sev_poisoned = max((severity_of(by_p[qid].get("audit"), kind) for qid in qids), default=0.0)
        if max_sev_poisoned < 0.4:
            fails.append(
                f"Criterion 4: {kind} max severity in poisoned run "
                f"across {qids} = {max_sev_poisoned:.2f} (must be >= 0.4)"
            )
        for qid in qids:
            sev_clean = severity_of(by_c[qid].get("audit"), kind)
            if sev_clean >= 0.4:
                fails.append(
                    f"Criterion 5: {kind} fired in CLEAN run on {qid} "
                    f"at severity {sev_clean:.2f} (must be < 0.4)"
                )

    print("=" * 70)
    print("Acceptance check")
    print("=" * 70)
    if fails:
        print(f"{FAIL}: {len(fails)} criteria not met\n")
        for f in fails:
            print(f"  - {f}")
        print()
        print("Not publishable yet. Iterate per SPEC.md step 8.")
        return 1
    print(f"{PASS}: all criteria met. Artifact is publishable.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
