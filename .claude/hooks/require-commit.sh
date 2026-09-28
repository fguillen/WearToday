#!/usr/bin/env bash
# Stop hook: block Claude from finishing a turn while the working tree has
# uncommitted changes. Committing after every finished task is a hard rule
# (see CLAUDE.md > Workflow).

input=$(cat)

# Block at most once per stop cycle so Claude can explain a deliberate
# exception instead of looping forever.
if [ "$(printf '%s' "$input" | jq -r '.stop_hook_active // false')" = "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

changes=$(git status --porcelain)
[ -z "$changes" ] && exit 0

jq -n --arg changes "$changes" '{
  decision: "block",
  reason: ("Uncommitted changes remain. Committing after every finished task is a required step in this project (CLAUDE.md > Workflow). Review git status/diff, stage the relevant files explicitly, and commit with a descriptive imperative message before finishing. If these changes must intentionally stay uncommitted (user asked, or waiting on the user mid-task), say so explicitly.\n\nPending changes:\n" + $changes)
}'
