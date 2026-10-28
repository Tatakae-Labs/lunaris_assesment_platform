import pytest
from app.grading.engine import JeeGradingEngine

def test_jee_grading_mcq_and_numerical():
    snapshot_questions = [
        {
            "id": "q1",
            "subject": "Physics",
            "type": "single_mcq",
            "points_positive": 4.0,
            "points_negative": -1.0,
            "content": {"correct_option_id": "opt_a"}
        },
        {
            "id": "q2",
            "subject": "Physics",
            "type": "single_mcq",
            "points_positive": 4.0,
            "points_negative": -1.0,
            "content": {"correct_option_id": "opt_c"}
        },
        {
            "id": "q3",
            "subject": "Mathematics",
            "type": "numerical",
            "points_positive": 4.0,
            "points_negative": -1.0,
            "content": {"numerical_answer": 3.14, "tolerance": 0.01}
        },
        {
            "id": "q4",
            "subject": "Chemistry",
            "type": "single_mcq",
            "points_positive": 4.0,
            "points_negative": -1.0,
            "content": {"correct_option_id": "opt_b"}
        }
    ]

    # Candidate answers:
    # q1: correct (opt_a) -> +4
    # q2: wrong (opt_b) -> -1
    # q3: numerical 3.141 -> within 0.01 tolerance -> +4
    # q4: unanswered -> 0
    candidate_answers = {
        "q1": {"selected_options": ["opt_a"], "state": "answered"},
        "q2": {"selected_options": ["opt_b"], "state": "answered"},
        "q3": {"numerical_value": "3.141", "state": "answered"}
    }

    result = JeeGradingEngine.evaluate_attempt(snapshot_questions, candidate_answers)

    assert result["total_score"] == 7.0  # +4 -1 +4 + 0 = 7.0
    assert result["max_possible_score"] == 16.0
    assert result["correct_count"] == 2
    assert result["incorrect_count"] == 1
    assert result["unanswered_count"] == 1
    assert result["subject_breakdown"]["Physics"]["score"] == 3.0
    assert result["subject_breakdown"]["Mathematics"]["score"] == 4.0
    assert result["subject_breakdown"]["Chemistry"]["score"] == 0.0
    assert round(result["accuracy_percentage"], 1) == 66.7
