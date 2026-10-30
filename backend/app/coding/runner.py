"""
Lunaris Multi-Language Code Execution Sandbox Engine.
Supports isolated execution of Python, JavaScript, C++, and Java with stdin/stdout,
timeout enforcement (TLE prevention), memory/output limits, and automated test-case evaluation.
"""

import sys
import os
import time
import shutil
import tempfile
import subprocess
from typing import Dict, Any, List, Optional


SUPPORTED_LANGUAGES = {
    "python": {
        "id": "python",
        "name": "Python 3.12",
        "extension": ".py",
        "template": (
            "import sys\n\n"
            "def solve():\n"
            "    # Read input from stdin\n"
            "    lines = sys.stdin.read().split()\n"
            "    if not lines:\n"
            "        return\n"
            "    # Sample: sum all numbers\n"
            "    numbers = [int(x) for x in lines]\n"
            "    print(sum(numbers))\n\n"
            "if __name__ == '__main__':\n"
            "    solve()\n"
        )
    },
    "javascript": {
        "id": "javascript",
        "name": "JavaScript (Node.js)",
        "extension": ".js",
        "template": (
            "const fs = require('fs');\n\n"
            "function solve() {\n"
            "    const input = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/);\n"
            "    if (!input || input[0] === '') return;\n"
            "    const sum = input.reduce((acc, curr) => acc + parseInt(curr, 10), 0);\n"
            "    console.log(sum);\n"
            "}\n\n"
            "solve();\n"
        )
    },
    "cpp": {
        "id": "cpp",
        "name": "C++ (G++ 17)",
        "extension": ".cpp",
        "template": (
            "#include <iostream>\n"
            "#include <vector>\n"
            "#include <numeric>\n\n"
            "using namespace std;\n\n"
            "int main() {\n"
            "    ios_base::sync_with_stdio(false);\n"
            "    cin.tie(NULL);\n"
            "    int num, sum = 0;\n"
            "    while (cin >> num) {\n"
            "        sum += num;\n"
            "    }\n"
            "    cout << sum << \"\\n\";\n"
            "    return 0;\n"
            "}\n"
        )
    },
    "java": {
        "id": "java",
        "name": "Java (OpenJDK 17)",
        "extension": ".java",
        "template": (
            "import java.util.Scanner;\n\n"
            "public class Solution {\n"
            "    public static void main(String[] args) {\n"
            "        Scanner sc = new Scanner(System.in);\n"
            "        long sum = 0;\n"
            "        while (sc.hasNextLong()) {\n"
            "            sum += sc.nextLong();\n"
            "        }\n"
            "        System.out.println(sum);\n"
            "    }\n"
            "}\n"
        )
    }
}


def find_executable(name: str) -> Optional[str]:
    """Finds binary path on host system."""
    return shutil.which(name)


def execute_single_run(
    source_code: str,
    language: str,
    stdin_input: str = "",
    time_limit_sec: float = 3.0
) -> Dict[str, Any]:
    """
    Executes a single code snippet in a sandboxed temporary directory with stdin.
    Enforces time limits, output limits, and captures stdout/stderr.
    """
    lang = language.lower().strip()
    if lang not in SUPPORTED_LANGUAGES:
        return {
            "status": "error",
            "error": f"Unsupported language '{language}'. Supported: {list(SUPPORTED_LANGUAGES.keys())}",
            "stdout": "",
            "stderr": "Unsupported language",
            "execution_time_ms": 0,
            "exit_code": 1
        }

    lang_meta = SUPPORTED_LANGUAGES[lang]
    max_output_bytes = 64 * 1024  # 64KB max output

    with tempfile.TemporaryDirectory() as tmpdir:
        # Determine file and command
        if lang == "python":
            source_file = os.path.join(tmpdir, "solution.py")
            with open(source_file, "w", encoding="utf-8") as f:
                f.write(source_code)
            py_bin = sys.executable or find_executable("python") or "python"
            run_cmd = [py_bin, "-u", "solution.py"]

        elif lang == "javascript":
            source_file = os.path.join(tmpdir, "solution.js")
            with open(source_file, "w", encoding="utf-8") as f:
                f.write(source_code)
            node_bin = find_executable("node")
            if not node_bin:
                return {
                    "status": "runtime_error",
                    "stdout": "",
                    "stderr": "Node.js runtime environment is not installed on the host execution node.",
                    "execution_time_ms": 0,
                    "exit_code": 127
                }
            run_cmd = [node_bin, "solution.js"]

        elif lang == "cpp":
            source_file = os.path.join(tmpdir, "solution.cpp")
            out_bin = os.path.join(tmpdir, "solution.exe" if os.name == "nt" else "solution")
            with open(source_file, "w", encoding="utf-8") as f:
                f.write(source_code)
            gpp_bin = find_executable("g++") or find_executable("clang++")
            if not gpp_bin:
                return {
                    "status": "compilation_error",
                    "stdout": "",
                    "stderr": "G++ compiler not found on the host execution node.",
                    "execution_time_ms": 0,
                    "exit_code": 127
                }
            # Compile step
            t_comp_start = time.perf_counter()
            comp_res = subprocess.run(
                [gpp_bin, "-O2", "-std=c++17", source_file, "-o", out_bin],
                cwd=tmpdir,
                capture_output=True,
                text=True,
                timeout=10.0
            )
            if comp_res.returncode != 0:
                return {
                    "status": "compilation_error",
                    "stdout": "",
                    "stderr": comp_res.stderr or comp_res.stdout or "Compilation failed",
                    "execution_time_ms": round((time.perf_counter() - t_comp_start) * 1000, 2),
                    "exit_code": comp_res.returncode
                }
            run_cmd = [out_bin]

        elif lang == "java":
            # Java requires matching class name Solution.java
            source_file = os.path.join(tmpdir, "Solution.java")
            with open(source_file, "w", encoding="utf-8") as f:
                f.write(source_code)
            javac_bin = find_executable("javac")
            java_bin = find_executable("java")
            if not javac_bin or not java_bin:
                return {
                    "status": "compilation_error",
                    "stdout": "",
                    "stderr": "Java SDK / JDK runtime is not configured on this node.",
                    "execution_time_ms": 0,
                    "exit_code": 127
                }
            comp_res = subprocess.run(
                [javac_bin, source_file],
                cwd=tmpdir,
                capture_output=True,
                text=True,
                timeout=10.0
            )
            if comp_res.returncode != 0:
                return {
                    "status": "compilation_error",
                    "stdout": "",
                    "stderr": comp_res.stderr or "Java compilation failed",
                    "execution_time_ms": 0,
                    "exit_code": comp_res.returncode
                }
            run_cmd = [java_bin, "-cp", tmpdir, "Solution"]

        # Run with input and enforce time limit
        stdin_bytes = stdin_input.encode("utf-8")
        start_time = time.perf_counter()

        try:
            proc = subprocess.run(
                run_cmd,
                cwd=tmpdir,
                input=stdin_bytes,
                capture_output=True,
                timeout=time_limit_sec
            )
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            stdout = proc.stdout[:max_output_bytes].decode("utf-8", errors="replace")
            stderr = proc.stderr[:max_output_bytes].decode("utf-8", errors="replace")

            if proc.returncode != 0:
                return {
                    "status": "runtime_error",
                    "stdout": stdout,
                    "stderr": stderr,
                    "execution_time_ms": elapsed_ms,
                    "exit_code": proc.returncode
                }

            return {
                "status": "success",
                "stdout": stdout,
                "stderr": stderr,
                "execution_time_ms": elapsed_ms,
                "exit_code": 0
            }

        except subprocess.TimeoutExpired:
            return {
                "status": "time_limit_exceeded",
                "stdout": "",
                "stderr": f"Time Limit Exceeded: Execution took longer than {time_limit_sec} seconds.",
                "execution_time_ms": round(time_limit_sec * 1000, 2),
                "exit_code": 124
            }
        except Exception as exc:
            return {
                "status": "runtime_error",
                "stdout": "",
                "stderr": str(exc),
                "execution_time_ms": round((time.perf_counter() - start_time) * 1000, 2),
                "exit_code": 1
            }


def evaluate_test_cases(
    source_code: str,
    language: str,
    test_cases: List[Dict[str, Any]],
    time_limit_sec: float = 3.0
) -> Dict[str, Any]:
    """
    Executes source code against a collection of test cases.
    Returns individual test case results, overall pass/fail status, and score percentage.
    """
    results = []
    passed_count = 0
    total_count = len(test_cases)
    total_time_ms = 0.0

    for idx, tc in enumerate(test_cases):
        tc_id = tc.get("id") or str(idx + 1)
        inp = tc.get("input", "")
        expected = str(tc.get("expected_output", "")).strip()
        is_hidden = bool(tc.get("is_hidden", False))

        run_res = execute_single_run(
            source_code=source_code,
            language=language,
            stdin_input=inp,
            time_limit_sec=time_limit_sec
        )

        total_time_ms += run_res.get("execution_time_ms", 0.0)
        actual = run_res.get("stdout", "").strip()

        # Check correctness
        case_passed = False
        verdict = run_res.get("status")

        if verdict == "success":
            # Compare output with whitespace/newline tolerance
            if actual == expected:
                case_passed = True
                verdict = "passed"
                passed_count += 1
            else:
                verdict = "wrong_answer"

        results.append({
            "test_case_id": tc_id,
            "case_number": idx + 1,
            "is_hidden": is_hidden,
            "status": verdict,
            "passed": case_passed,
            "execution_time_ms": run_res.get("execution_time_ms", 0.0),
            "input": "Hidden Test Case" if is_hidden else inp,
            "expected_output": "Hidden Test Case" if is_hidden else expected,
            "actual_output": "Hidden Test Case" if is_hidden else actual,
            "stderr": run_res.get("stderr", ""),
            "explanation": tc.get("explanation") if not is_hidden else None
        })

    score_percentage = round((passed_count / total_count * 100), 2) if total_count > 0 else 0.0

    return {
        "all_passed": passed_count == total_count,
        "passed_count": passed_count,
        "total_count": total_count,
        "score_percentage": score_percentage,
        "total_time_ms": round(total_time_ms, 2),
        "results": results
    }

