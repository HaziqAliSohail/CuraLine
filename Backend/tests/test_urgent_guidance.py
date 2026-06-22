"""
Tests for the urgent care RAG guidance knowledge base and matcher.
"""
import pytest
from clients.urgent_guidance import (
    match_urgent_guidance,
    URGENT_CARE_KB,
    GUIDANCE_DISCLAIMER,
)


class TestKBIntegrity:
    """Verify the knowledge base is well-formed."""

    def test_kb_not_empty(self):
        assert len(URGENT_CARE_KB) > 0

    def test_all_entries_have_required_fields(self):
        for entry in URGENT_CARE_KB:
            assert "keywords" in entry, f"Missing keywords in {entry}"
            assert "severity_floor" in entry, f"Missing severity_floor in {entry}"
            assert "action" in entry, f"Missing action in {entry}"
            assert "guidance" in entry, f"Missing guidance in {entry}"
            assert isinstance(entry["keywords"], list)
            assert len(entry["keywords"]) > 0

    def test_valid_action_types(self):
        valid_actions = {"EMERGENCY", "URGENT_CARE", "TELEHEALTH", "FIRST_AID"}
        for entry in URGENT_CARE_KB:
            assert entry["action"] in valid_actions, (
                f"Invalid action '{entry['action']}' for keywords {entry['keywords']}"
            )

    def test_severity_floor_range(self):
        for entry in URGENT_CARE_KB:
            assert 1 <= entry["severity_floor"] <= 5, (
                f"severity_floor {entry['severity_floor']} out of range for {entry['keywords']}"
            )

    def test_emergency_entries_have_high_severity(self):
        """EMERGENCY entries should have severity_floor >= 4."""
        for entry in URGENT_CARE_KB:
            if entry["action"] == "EMERGENCY":
                assert entry["severity_floor"] >= 4, (
                    f"EMERGENCY entry has low severity_floor: {entry['keywords']}"
                )

    def test_disclaimer_exists(self):
        assert GUIDANCE_DISCLAIMER
        assert "not medical advice" in GUIDANCE_DISCLAIMER.lower()

    def test_no_routine_otc_recommendations(self):
        """Policy: never recommend routine OTC drugs. Only time-critical,
        life-saving emergency meds (aspirin/EpiPen/inhaler) are allowed."""
        banned = ("acetaminophen", "antihistamine", "lozenge",
                  "antibiotic ointment", "pain reliever")
        for entry in URGENT_CARE_KB:
            g = entry["guidance"].lower()
            for term in banned:
                assert term not in g, (
                    f"Routine OTC '{term}' must not be recommended: {entry['keywords']}"
                )

    def test_meds_only_in_emergency_or_as_avoidance(self):
        """Any named medication may appear ONLY in an EMERGENCY entry (as a
        life-saving measure) or as 'do not take / avoid' protective advice."""
        for entry in URGENT_CARE_KB:
            g = entry["guidance"].lower()
            for med in ("aspirin", "ibuprofen", "epinephrine", "epipen", "inhaler"):
                if med in g:
                    is_avoidance = "do not" in g or "avoid" in g
                    assert entry["action"] == "EMERGENCY" or is_avoidance, (
                        f"Med '{med}' may only appear in EMERGENCY guidance or as "
                        f"avoidance advice: {entry['keywords']}"
                    )


class TestSemanticFallback:
    """Semantic matching is additive: keyword wins first; semantic is off unless
    enabled with a key, and is always skipped under TESTING for determinism."""

    def test_keyword_still_wins(self):
        # An emergency phrased with KB keywords matches deterministically.
        r = match_urgent_guidance("crushing chest pain radiating to my arm")
        assert r is not None and r["action"] == "EMERGENCY"

    def test_no_match_when_keywords_miss_and_semantic_off(self):
        # No KB keyword present; semantic off by default -> no match.
        assert match_urgent_guidance("my whole torso feels like it is being squeezed") is None

    def test_semantic_skipped_in_testing(self, monkeypatch):
        import clients.urgent_guidance as ug
        monkeypatch.setattr(ug.settings, "semantic_guidance", True)
        monkeypatch.setattr(ug.settings, "openai_api_key", "test-key")
        # TESTING=True (conftest) forces the semantic path to no-op.
        assert ug._semantic_match("squeezing sensation across my torso") is None


class TestMatchUrgentGuidance:
    """Test the keyword matching function."""

    # ── EMERGENCY matches ────────────────────────────────────────────
    def test_chest_pain_matches_emergency(self):
        result = match_urgent_guidance("I have severe chest pain radiating to my left arm")
        assert result is not None
        assert result["action"] == "EMERGENCY"
        assert result["severity_floor"] == 5

    def test_difficulty_breathing_matches_emergency(self):
        result = match_urgent_guidance("I'm having difficulty breathing and can't catch my breath")
        assert result is not None
        assert result["action"] == "EMERGENCY"

    def test_stroke_symptoms_match_emergency(self):
        result = match_urgent_guidance("My face is drooping and I have slurred speech")
        assert result is not None
        assert result["action"] == "EMERGENCY"

    def test_severe_bleeding_matches_emergency(self):
        result = match_urgent_guidance("I have severe bleeding from a deep wound")
        assert result is not None
        assert result["action"] == "EMERGENCY"

    def test_suicidal_matches_emergency(self):
        result = match_urgent_guidance("I feel suicidal and want to die")
        assert result is not None
        assert result["action"] == "EMERGENCY"

    # ── URGENT_CARE matches ──────────────────────────────────────────
    def test_broken_bone_matches_urgent_care(self):
        result = match_urgent_guidance("I think I have a broken bone in my arm after falling")
        assert result is not None
        assert result["action"] == "URGENT_CARE"

    def test_deep_cut_matches_urgent_care(self):
        result = match_urgent_guidance("I have a deep cut that needs stitches")
        assert result is not None
        assert result["action"] == "URGENT_CARE"

    def test_concussion_matches_urgent_care(self):
        result = match_urgent_guidance("I hit my head and have dizziness after fall")
        assert result is not None
        assert result["action"] == "URGENT_CARE"

    # ── TELEHEALTH matches ───────────────────────────────────────────
    def test_sore_throat_matches_telehealth(self):
        result = match_urgent_guidance("I have a sore throat and painful swallowing for 3 days")
        assert result is not None
        assert result["action"] == "TELEHEALTH"

    def test_rash_matches_telehealth(self):
        result = match_urgent_guidance("I developed a skin rash with itchy skin all over my body")
        assert result is not None
        assert result["action"] == "TELEHEALTH"

    def test_uti_matches_telehealth(self):
        result = match_urgent_guidance("I think I have a urinary tract infection with burning urination")
        assert result is not None
        assert result["action"] == "TELEHEALTH"

    def test_back_pain_matches_telehealth(self):
        result = match_urgent_guidance("I've had lower back pain for a week now")
        assert result is not None
        assert result["action"] == "TELEHEALTH"

    def test_migraine_matches_telehealth(self):
        result = match_urgent_guidance("I have a severe headache with nausea, feels like a migraine")
        assert result is not None
        assert result["action"] == "TELEHEALTH"

    def test_anxiety_matches_telehealth(self):
        result = match_urgent_guidance("I've been having anxiety and panic attacks")
        assert result is not None
        assert result["action"] == "TELEHEALTH"

    # ── FIRST_AID matches ────────────────────────────────────────────
    def test_paper_cut_matches_first_aid(self):
        result = match_urgent_guidance("I got a small paper cut on my finger")
        assert result is not None
        assert result["action"] == "FIRST_AID"

    def test_bruise_matches_first_aid(self):
        result = match_urgent_guidance("I have a bruise on my leg from bumping into something")
        assert result is not None
        assert result["action"] == "FIRST_AID"

    def test_mild_headache_matches_first_aid(self):
        result = match_urgent_guidance("I have a mild headache")
        assert result is not None
        assert result["action"] == "FIRST_AID"

    def test_common_cold_matches_first_aid(self):
        result = match_urgent_guidance("I have a stuffy nose and sneezing, typical cold symptoms")
        assert result is not None
        assert result["action"] == "FIRST_AID"

    def test_nosebleed_matches_first_aid(self):
        result = match_urgent_guidance("I have a nosebleed that won't stop")
        assert result is not None
        assert result["action"] == "FIRST_AID"

    # ── Edge cases ───────────────────────────────────────────────────
    def test_no_match_returns_none(self):
        result = match_urgent_guidance("I need to schedule my annual checkup")
        assert result is None

    def test_empty_string_returns_none(self):
        result = match_urgent_guidance("")
        assert result is None

    def test_none_input_returns_none(self):
        result = match_urgent_guidance(None)
        assert result is None

    def test_case_insensitive_matching(self):
        result = match_urgent_guidance("I HAVE CHEST PAIN AND DIFFICULTY BREATHING")
        assert result is not None
        assert result["action"] == "EMERGENCY"

    def test_highest_keyword_score_wins(self):
        """When multiple entries match, the one with the most keyword hits should win."""
        # "chest pain" + "chest pressure" both hit the chest pain entry (2 keywords)
        result = match_urgent_guidance("I feel chest pain and chest pressure")
        assert result is not None
        assert result["action"] == "EMERGENCY"
        assert result["severity_floor"] == 5

    def test_returns_required_keys(self):
        """All returned matches should have action, guidance, severity_floor."""
        result = match_urgent_guidance("I have chest pain")
        assert result is not None
        assert "action" in result
        assert "guidance" in result
        assert "severity_floor" in result
