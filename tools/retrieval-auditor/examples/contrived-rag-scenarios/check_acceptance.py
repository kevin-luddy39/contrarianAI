"""Step 7 of SPEC.md — automated acceptance-criteria gate (v0.2, dense-profile).

Reads:
  results/clean.json
  results/poisoned.json

Recalibrated to the dense-profile reality after the auditor recalibration:
mean alignment magnitudes are ~0.20 not ~0.40, so health gates by absolute
threshold are unrealistic. The publishable signal is whether engineered
pathology flags FIRE on their target queries in poisoned and DO NOT fire
in clean. Health magnitude is informative but secondary.

Criteria (v0.2):

1. Clean baselines Q7, Q9: no engineered pathology flag (OFF_TOPIC,
   RANK_INVERSION, SCORE_MISCALIBRATED, REDUNDANT) in clean OR poisoned.
2. OOD Q10: must fire OFF_TOPIC in both runs (validates OOD detection).
   If the assembled corpus is too rich to yield a true OOD signal at the
   dense profile's offTopic=0.10, this criterion will be replaced with a
   different OOD probe query in a future iteration.
3. Each engineered pathology surfaces its targeted flag at severity >= 0.4
   in the poisoned run on at least one of the queries listed for it.
4. The flag does NOT fire (severity < 0.4) on the same query in the clean
   run.

The 'pathology kind' strings emitted by core/pathologies.js are the source of
truth for flag names. Note: low-diversity pathology is named REDUNDANT in
code (we corrected the SPEC.md mislabel of 'LOW_DIVERSITY').

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
    flag_kinds = ("OFF_TOPIC", "RANK_INVERSION", "SCORE_MISCALIBRATED", "REDUNDANT")

    for qid in ("Q7", "Q9"):
        for run_label, by in (("clean", by_c), ("poisoned", by_p)):
            for kind in flag_kinds:
                sev = severity_of(by[qid].get("audit"), kind)
                if sev >= 0.4:
                    fails.append(
                        f"Criterion 1: clean baseline {qid} fired {kind} "
                        f"in {run_label} at severity {sev:.2f} (must be < 0.4)"
                    )

    for run_label, by in (("clean", by_c), ("poisoned", by_p)):
        flags = by["Q10"]["summary"]["flags"]
        if "OFF_TOPIC" not in flags:
            fails.append(
                f"Criterion 2: Q10 (OOD) {run_label} flags={flags} "
                f"(must include OFF_TOPIC; corpus may be too rich for OOD detection)"
            )

    targets = {
        "RANK_INVERSION": ["Q3", "Q6"],
        "SCORE_MISCALIBRATED": ["Q1", "Q2", "Q4"],
        "OFF_TOPIC": ["Q5"],
        "REDUNDANT": ["Q3", "Q8"],
    }
    for kind, qids in targets.items():
        max_sev_poisoned = max((severity_of(by_p[qid].get("audit"), kind) for qid in qids), default=0.0)
        if max_sev_poisoned < 0.4:
            fails.append(
                f"Criterion 3: {kind} max severity in poisoned run "
                f"across {qids} = {max_sev_poisoned:.2f} (must be >= 0.4)"
            )
        for qid in qids:
            sev_clean = severity_of(by_c[qid].get("audit"), kind)
            if sev_clean >= 0.4:
                fails.append(
                    f"Criterion 4: {kind} fired in CLEAN run on {qid} "
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
