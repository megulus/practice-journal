#!/usr/bin/env python3
"""PreToolUse guard for Bash: no pushes to main, and PR merges need a human.

Backs up the "Never push to main, never merge unless told to" rule in
CLAUDE.md, since GitHub may not enforce the main ruleset on a private repo.

- A push that targets main is denied outright.
- `gh pr merge` asks, so a human who said "merge #N" just approves the
  prompt, and an unattended agent stops there.

Best effort: it parses the command text, so it catches the ordinary forms,
not every way a shell could spell a push.
"""
import json
import re
import shlex
import subprocess
import sys

PROTECTED = {"main", "refs/heads/main"}


def segments(command):
    # Split on shell control operators; good enough for agent-written commands.
    for part in re.split(r"&&|\|\||;|\||\n", command):
        try:
            tokens = shlex.split(part)
        except ValueError:
            tokens = part.split()
        if tokens:
            yield tokens


def git_subcommand(tokens):
    """Return (args after the subcommand, -C dir) for a git invocation."""
    i, cwd = 1, None
    while i < len(tokens) and tokens[i].startswith("-"):
        if tokens[i] in ("-C", "-c") and i + 1 < len(tokens):
            if tokens[i] == "-C":
                cwd = tokens[i + 1]
            i += 2
        else:
            i += 1
    if i < len(tokens):
        return tokens[i], tokens[i + 1:], cwd
    return None, [], cwd


def current_branch(cwd):
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            cwd=cwd, capture_output=True, text=True, timeout=5,
        )
        return out.stdout.strip()
    except Exception:
        return ""


def push_targets_main(args, cwd):
    if any(a in ("--all", "--mirror") for a in args):
        return True
    positional = [a for a in args if not a.startswith("-")]
    refspecs = positional[1:]  # first positional is the remote
    if not refspecs:
        # Bare `git push` / `git push origin` pushes the current branch.
        return current_branch(cwd) == "main"
    for spec in refspecs:
        dst = spec.lstrip("+").split(":")[-1]
        if dst in PROTECTED:
            return True
        if dst == "HEAD" and current_branch(cwd) == "main":
            return True
    return False


def decide(command, cwd):
    for tokens in segments(command):
        name = tokens[0].rsplit("/", 1)[-1]
        if name == "git":
            sub, args, c = git_subcommand(tokens)
            if sub == "push" and push_targets_main(args, c or cwd):
                return "deny", (
                    "Pushing to main is never allowed (CLAUDE.md). Push a "
                    "branch and open a PR; a human merges it."
                )
        if name == "gh" and tokens[1:3] == ["pr", "merge"]:
            return "ask", (
                "Merging a PR needs explicit human authorization for this "
                "PR (CLAUDE.md). Approve only if you asked for this merge."
            )
    return None, None


def main():
    data = json.load(sys.stdin)
    if data.get("tool_name") != "Bash":
        return
    command = (data.get("tool_input") or {}).get("command", "")
    decision, reason = decide(command, data.get("cwd"))
    if decision:
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": decision,
            "permissionDecisionReason": reason,
        }}))


if __name__ == "__main__":
    main()
