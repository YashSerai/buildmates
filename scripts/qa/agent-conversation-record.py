"""Reserve and record local model conversations without launching model sessions.

The parent uses collaboration tools to launch GPT-6 Luna at high reasoning.
Only actor replies and canonical MCP evidence count as conversation results.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parents[2]


def write(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--evidence", type=Path, required=True)
    parser.add_argument("--case", required=True)
    parser.add_argument("--prepare", action="store_true")
    parser.add_argument("--agent")
    parser.add_argument("--turn", type=int)
    parser.add_argument("--reply", type=Path)
    parser.add_argument("--user", type=Path, help="Exact delivered user turn when it differs from the catalog")
    parser.add_argument("--repair", action="store_true", help="Append a labelled repair turn to this same model conversation")
    args = parser.parse_args()
    evidence = args.evidence.resolve()
    cases = json.loads((ROOT / "scripts/qa/conversation-cases.json").read_text(encoding="utf-8"))
    case = next(case for case in cases if case["id"] == args.case)
    ledger_path = evidence / "session-ledger.json"
    ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
    case_dir = evidence / f"{case['id']}.agent-1"
    record_path = case_dir / "conversation.json"
    if args.prepare:
        consumed = sum(bool(entry.get("sessionId")) or entry.get("status") == "reserved" or entry.get("timedOut", False) for entry in ledger)
        if consumed >= 12:
            raise SystemExit("The twelve-conversation budget is exhausted")
        case_dir.mkdir(parents=True, exist_ok=False)
        diff = subprocess.run(["git", "diff", "--", "apps", "packages", "plugin", "plugins"], cwd=ROOT, capture_output=True, check=True).stdout
        revision = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
        skill_paths = sorted((ROOT / "plugins/buildmates/skills").glob("*/SKILL.md"))
        source_paths = list((ROOT / "scripts/qa").glob("*.ts")) + skill_paths
        provenance = {
            "sourceRevision": revision,
            "workingProductDiffSha256": hashlib.sha256(diff).hexdigest(),
            "fixtureAndSkillSha256": {path.relative_to(ROOT).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest() for path in source_paths},
            "syntheticLocalOnly": True,
            "toolExposure": "local stdio MCP proxy, not native host installation",
        }
        write(record_path, {"case": case, "model": "gpt-6-luna", "reasoningEffort": "high", "engine": "collaboration", "provenance": provenance, "turns": []})
        ledger.append({"case": case["id"], "caseHash": hashlib.sha256(json.dumps(case, sort_keys=True).encode()).hexdigest(), "reservedAt": time.time(), "status": "reserved", "engine": "collaboration", "evidenceDirectory": case_dir.as_posix()})
        write(ledger_path, ledger)
        print(json.dumps({"case": case["id"], "scenario": case["scenario"], "evidenceDirectory": case_dir.as_posix(), "user": case["turns"][0]}))
        return
    valid_turn = args.turn is not None and (args.turn in range(1, len(case["turns"]) + 1) or (args.repair and args.turn > len(case["turns"]) and args.user))
    if not args.agent or not args.reply or not valid_turn:
        raise SystemExit("Recording requires --agent, --turn, and --reply")
    record = json.loads(record_path.read_text(encoding="utf-8"))
    if len(record["turns"]) != args.turn - 1:
        raise SystemExit("Turns must be recorded once, in order")
    reply = args.reply.read_text(encoding="utf-8")
    record["sessionId"] = args.agent
    user = args.user.read_text(encoding="utf-8") if args.user else case["turns"][args.turn - 1]
    turn = {"user": user, "messages": [reply], "recordedAt": time.time()}
    if args.repair:
        turn["repair"] = True
        turn["productDiffSha256"] = hashlib.sha256(subprocess.run(["git", "diff", "--", "apps", "packages", "plugin", "plugins"], cwd=ROOT, capture_output=True, check=True).stdout).hexdigest()
    record["turns"].append(turn)
    write(record_path, record)
    entry = next(entry for entry in ledger if entry.get("evidenceDirectory") == case_dir.as_posix())
    entry.update(sessionId=args.agent, turnCount=args.turn, status="finished" if args.turn >= len(case["turns"]) else "running")
    write(ledger_path, ledger)
    print(json.dumps({"case": args.case, "turn": args.turn, "recorded": True}))


if __name__ == "__main__":
    main()
