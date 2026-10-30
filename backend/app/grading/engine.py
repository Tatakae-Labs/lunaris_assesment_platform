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

            # One-Word Answer / Fill-in-the-Blank
            elif q_type in ("one_word", "single_word", "fill_blank"):
                user_word = (
                    user_ans.get("one_word") or
                    user_ans.get("text_answer") or
                    numerical_val or
                    ""
                )
                user_word_clean = str(user_word).strip().lower()
                target_word = content.get("target_word", content.get("one_word", ""))
                acceptable = [str(target_word).strip().lower()] if target_word else []
                for alt in content.get("acceptable_words", []):
                    if alt:
                        acceptable.append(str(alt).strip().lower())

                if user_word_clean:
                    is_attempted = True
                    if any(user_word_clean == acc for acc in acceptable if acc):
                        is_correct = True
                        awarded = max_points
                    else:
                        awarded = neg_points if rules.get("enable_negative_marking", True) else 0.0
                else:
                    awarded = 0.0

            # Crossword Quiz
            elif q_type == "crossword":
                user_grid = user_ans.get("crossword_grid", {}) or {}
                solution_grid = content.get("solution", {}) or {}
                # Also accept clues list if solution grid not pre-flattened
                if not solution_grid and content.get("clues"):
                    solution_grid = {}
                    for cl in content.get("clues", []):
                        r, c = cl.get("row", 0), cl.get("col", 0)
                        ans = cl.get("answer", "").upper()
                        is_down = cl.get("direction", "across").lower() == "down"
                        for i, ch in enumerate(ans):
                            cell_key = f"{r + i if is_down else r},{c if is_down else c + i}"
                            solution_grid[cell_key] = ch

                if user_grid and any(str(v).strip() for v in user_grid.values()):
                    is_attempted = True
                    total_cells = len(solution_grid)
                    correct_cells = 0
                    for cell_coord, sol_char in solution_grid.items():
                        user_char = str(user_grid.get(cell_coord, "")).strip().upper()
                        if user_char == str(sol_char).strip().upper():
                            correct_cells += 1

                    if total_cells > 0:
                        cell_ratio = correct_cells / total_cells
                        if cell_ratio >= 0.99:
                            is_correct = True
                            awarded = max_points
                        elif cell_ratio >= 0.5:
                            awarded = round(max_points * cell_ratio, 2)
                        else:
                            awarded = 0.0
                    else:
                        is_correct = True
                        awarded = max_points
                else:
                    awarded = 0.0

            # Match the Following
            elif q_type == "match_following":
                user_matches = user_ans.get("matches", {}) or {}
                pairs = content.get("pairs", [])
                if user_matches and any(v for v in user_matches.values()):
                    is_attempted = True
                    total_pairs = len(pairs)
                    correct_matches = 0
                    for p in pairs:
                        pid = str(p.get("id", ""))
                        expected_right = str(p.get("right", "")).strip().lower()
                        user_selected_right = str(user_matches.get(pid, "")).strip().lower()
                        if user_selected_right and user_selected_right == expected_right:
                            correct_matches += 1

                    if total_pairs > 0:
                        ratio = correct_matches / total_pairs
                        if ratio >= 0.99:
                            is_correct = True
                            awarded = max_points
                        elif ratio > 0:
                            awarded = round(max_points * ratio, 2)
                        else:
                            awarded = neg_points if rules.get("enable_negative_marking", False) else 0.0
                    else:
                        is_correct = True
                        awarded = max_points
                else:
                    awarded = 0.0

            # True / False Statement Verification
            elif q_type == "true_false":
                user_tf = (
                    user_ans.get("true_false") or
                    (selected_opts[0] if selected_opts else None) or
                    ""
                )
                user_tf_clean = str(user_tf).strip().lower()
                correct_tf = str(content.get("correct_answer", "true")).strip().lower()

                if user_tf_clean in ("true", "false", "t", "f"):
                    is_attempted = True
                    norm_user = "true" if user_tf_clean in ("true", "t") else "false"
                    norm_correct = "true" if correct_tf in ("true", "t") else "false"
                    if norm_user == norm_correct:
                        is_correct = True
                        awarded = max_points
                    else:
                        awarded = neg_points
                else:
                    awarded = 0.0

            # Interactive Coding & Scripting Problem
            elif q_type == "coding":
                submitted_code = (
                    user_ans.get("code") or
                    user_ans.get("source_code") or
                    ""
                )
                submitted_lang = user_ans.get("language") or "python"
                test_cases = content.get("test_cases", [])

                if submitted_code and submitted_code.strip():
                    is_attempted = True
                    if test_cases:
                        try:
                            from app.coding.runner import evaluate_test_cases
                            time_limit = float(content.get("time_limit_sec", 3.0))
                            eval_res = evaluate_test_cases(
                                source_code=submitted_code,
                                language=submitted_lang,
                                test_cases=test_cases,
                                time_limit_sec=time_limit
                            )
                            pass_ratio = (eval_res.get("passed_count", 0) / max(1, len(test_cases)))
                            if eval_res.get("all_passed"):
                                is_correct = True
                                awarded = max_points
                            elif pass_ratio > 0:
                                awarded = round(max_points * pass_ratio, 2)
                            else:
                                awarded = neg_points if rules.get("enable_negative_marking", False) else 0.0
                        except Exception as e:
                            print(f"[GRADING ENGINE] Coding evaluation note: {e}")
                            awarded = 0.0
                    else:
                        is_correct = True
                        awarded = max_points
                else:
                    awarded = 0.0

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
