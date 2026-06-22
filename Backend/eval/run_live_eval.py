"""Run the FULL triage eval against the live LLM (needs API keys).

    python -m eval.run_live_eval

Calls the real severity prompt for each vignette, then prints accuracy,
emergency recall, and specialization match. Use this before/after prompt changes
to catch clinical regressions.
"""
import json

from clients import llm_client
from clients.prompts import SEVERITY_SYSTEM_PROMPT
from eval.evaluator import live_metrics
from eval.vignettes import VIGNETTES


def _predict(v):
    content = (
        "Patient medical history: No prior medical history on file.\n\n"
        f"Current symptoms: {json.dumps({'chief_complaint': v['text']})}"
    )
    res = llm_client.query_structured(
        messages=[{"role": "user", "content": content}],
        system_prompt=SEVERITY_SYSTEM_PROMPT,
    )
    return res if isinstance(res, dict) and "error" not in res else None


def main():
    preds = {}
    print(f"Running {len(VIGNETTES)} vignettes through the live severity model...\n")
    for v in VIGNETTES:
        p = _predict(v)
        if p is None:
            print("  LLM not configured or call failed — set API keys and retry.")
            return
        preds[v["id"]] = p
        flag = "EMERGENCY" if (p.get("is_emergency") or p.get("severity_score", 0) >= 5) else ""
        print(f"  {v['id']:<16} sev={p.get('severity_score')} "
              f"spec={p.get('recommended_specialization')} {flag}")

    m = live_metrics(VIGNETTES, preds)
    print("\n── Metrics ──")
    print(f"  severity within ±1 : {m['severity_within_tol']:.0%}")
    print(f"  emergency recall   : {m['emergency_recall']:.0%}")
    print(f"  emergency false-pos: {m['emergency_false_positives']}")
    print(f"  specialization     : {m['specialization_match']:.0%}")


if __name__ == "__main__":
    main()
