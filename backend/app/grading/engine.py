import json
from typing import Dict, Any, List, Optional
import math

class JeeGradingEngine:
    """
    Deterministic scoring engine for JEE Main & Advanced style examinations.
    Operates strictly on immutable version snapshots and stable question/option IDs.
    """

    @staticmethod
    def evaluate_attempt(
        snapshot_questions: List[Dict[str, Any]],
        submitted_answers: Dict[str, Dict[str, Any]],
        marking_rules: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Grades an attempt against the official snapshot.
        snapshot_questions: List of questions with correct keys from published version.
        submitted_answers: Map of question_id -> { selected_options: [...], numerical_value: "...", state: "..." }
        marking_rules: Global or section fallback rules (default JEE Main: +4, -1, 0)
        """
        rules = marking_rules or {
            "mcq_correct": 4.0,
            "mcq_incorrect": -1.0,
            "mcq_unanswered": 0.0,
            "nvq_correct": 4.0,
            "nvq_incorrect": -1.0,
            "nvq_unanswered": 0.0,
            "nvq_tolerance": 0.01
        }

        total_score = 0.0
        total_possible_score = 0.0
        correct_count = 0
        incorrect_count = 0
        unanswered_count = 0

        subject_breakdown: Dict[str, Dict[str, Any]] = {}
        question_evaluations: List[Dict[str, Any]] = []

        for q in snapshot_questions:
            q_id = q["id"]
            subject = q.get("subject", "General")
            q_type = q.get("type", "single_mcq")
            content = q.get("content", {})
            max_points = q.get("points_positive", rules.get("mcq_correct", 4.0))
            neg_points = q.get("points_negative", rules.get("mcq_incorrect", -1.0))

            total_possible_score += max_points

            if subject not in subject_breakdown:
                subject_breakdown[subject] = {
                    "score": 0.0,
                    "max_score": 0.0,
                    "correct": 0,
                    "incorrect": 0,
                    "unanswered": 0
                }
            subject_breakdown[subject]["max_score"] += max_points

            user_ans = submitted_answers.get(q_id, {})
            ans_state = user_ans.get("state", "unanswered")
            selected_opts = user_ans.get("selected_options", [])
            numerical_val = user_ans.get("numerical_value", None)

            is_correct = False
            is_attempted = False
            awarded = 0.0

            # Single-Correct MCQ
            if q_type == "single_mcq":
                correct_opt_id = content.get("correct_option_id")
                if selected_opts and len(selected_opts) > 0:
                    is_attempted = True
                    if selected_opts[0] == correct_opt_id:
                        is_correct = True
                        awarded = max_points
                    else:
                        awarded = neg_points
                else:
                    awarded = rules.get("mcq_unanswered", 0.0)

            # Multiple-Correct MCQ
            elif q_type == "multi_mcq":
                correct_opt_ids = set(content.get("correct_option_ids", []))
                chosen_opt_ids = set(selected_opts)
                if chosen_opt_ids:
                    is_attempted = True
                    # If any wrong option selected -> negative mark
                    wrong_chosen = chosen_opt_ids - correct_opt_ids
                    if len(wrong_chosen) > 0:
                        awarded = neg_points
                    elif chosen_opt_ids == correct_opt_ids:
                        is_correct = True
                        awarded = max_points
                    else:
                        # Partial credit: +1 for each correct option if no wrong options
                        awarded = float(len(chosen_opt_ids)) * (max_points / max(1, len(correct_opt_ids)))
                else:
                    awarded = rules.get("mcq_unanswered", 0.0)

            # Numerical Value Question (NVQ)
            elif q_type == "numerical":
                correct_target = content.get("numerical_answer")
                tolerance = content.get("tolerance", rules.get("nvq_tolerance", 0.01))
                if numerical_val is not None and str(numerical_val).strip() != "":
                    is_attempted = True
                    try:
                        user_float = float(numerical_val)
                        target_float = float(correct_target)
                        if abs(user_float - target_float) <= tolerance:
                            is_correct = True
                            awarded = max_points
                        else:
                            awarded = neg_points
                    except (ValueError, TypeError):
                        awarded = neg_points
                else:
                    awarded = rules.get("nvq_unanswered", 0.0)

            # Update aggregations
            if not is_attempted:
                unanswered_count += 1
                subject_breakdown[subject]["unanswered"] += 1
            elif is_correct:
                correct_count += 1
                subject_breakdown[subject]["correct"] += 1
            else:
                incorrect_count += 1
                subject_breakdown[subject]["incorrect"] += 1

            total_score += awarded
            subject_breakdown[subject]["score"] += awarded

            question_evaluations.append({
                "question_id": q_id,
                "subject": subject,
                "type": q_type,
                "is_attempted": is_attempted,
                "is_correct": is_correct,
                "awarded_marks": awarded,
                "max_marks": max_points
            })

        attempted_total = correct_count + incorrect_count
        accuracy = (correct_count / attempted_total * 100.0) if attempted_total > 0 else 0.0

        return {
            "total_score": round(total_score, 2),
            "max_possible_score": round(total_possible_score, 2),
            "accuracy_percentage": round(accuracy, 2),
            "correct_count": correct_count,
            "incorrect_count": incorrect_count,
            "unanswered_count": unanswered_count,
            "subject_breakdown": subject_breakdown,
            "evaluations": question_evaluations
        }

    calculate_score = evaluate_attempt
