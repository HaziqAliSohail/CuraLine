"""Scoring for the triage eval harness.

Two layers:
  • kb_emergency_eval - DETERMINISTIC (no LLM). Measures whether the urgent-care
    knowledge base recognizes known emergencies (recall) without firing on
    non-emergencies (specificity). This is the CI safety gate.
  • live_metrics - scores LLM severity predictions vs the labeled set (run
    manually with API keys via eval/run_live_eval.py).
"""
from clients.urgent_guidance import match_urgent_guidance


def kb_emergency_eval(vignettes):
    """Deterministic emergency recall/specificity from the keyword KB."""
    emergencies = [v for v in vignettes if v["emergency"]]
    non = [v for v in vignettes if not v["emergency"]]

    missed = []
    for v in emergencies:
        m = match_urgent_guidance(v["text"])
        if not (m and m.get("action") == "EMERGENCY"):
            missed.append(v["id"])

    false_positive = []
    for v in non:
        m = match_urgent_guidance(v["text"])
        if m and m.get("severity_floor") == 5:
            false_positive.append(v["id"])

    total_em = len(emergencies)
    return {
        "emergency_total": total_em,
        "emergency_missed": missed,
        "emergency_recall": (total_em - len(missed)) / total_em if total_em else None,
        "false_emergencies": false_positive,
        "non_emergency_total": len(non),
    }


def live_metrics(vignettes, preds, tolerance=1):
    """Score LLM predictions. preds maps vignette id -> dict with
    severity_score, is_emergency, recommended_specialization."""
    sev_ok = em_tp = em_fn = em_fp = spec_ok = scored = 0
    em_total = sum(1 for v in vignettes if v["emergency"])

    for v in vignettes:
        p = preds.get(v["id"])
        if not p:
            continue
        scored += 1
        if abs(int(p.get("severity_score", 0)) - v["severity"]) <= tolerance:
            sev_ok += 1
        pred_em = bool(p.get("is_emergency")) or int(p.get("severity_score", 0)) >= 5
        if v["emergency"] and pred_em:
            em_tp += 1
        elif v["emergency"] and not pred_em:
            em_fn += 1
        elif not v["emergency"] and pred_em:
            em_fp += 1
        spec = (p.get("recommended_specialization") or "").lower()
        if spec and (spec in v["specialization"].lower() or v["specialization"].lower() in spec):
            spec_ok += 1

    return {
        "scored": scored,
        "severity_within_tol": sev_ok / scored if scored else None,
        "emergency_recall": em_tp / em_total if em_total else None,
        "emergency_false_positives": em_fp,
        "specialization_match": spec_ok / scored if scored else None,
    }
