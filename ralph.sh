#!/bin/bash
set -e

iterations=${1:-3}
extra_prompt=${2:-}

for i in $(seq 1 $iterations); do
  echo "=== Iteration $i/$iterations ==="
  claude --dangerously-skip-permissions -p "@tasks/prd-miscellaneous-improvements.md @progress.txt \
1. Find the first story to work on and work only on that feature. \
2. Check types via pnpm typecheck. Use the agent-broswer to test acceptance criteria if necessary and iterate on issues. Make sure to review the code with the logic-review subagent. \
3. Once complete add any passing acceptance criteria (that is behavior based) to /testing/passing.md. You may omit things like files existing, schemas being updated, etc
4. Update the PRD with the work that was done and REMOVE that story once verified it has been completed AND put it into @tasks/completed-stories.md\
5. Append your progress to the tasks/progress.txt file. \
Use this to leave a note for the next person working in the codebase. \
6. Make a git commit of that feature. \
ONLY WORK ON A SINGLE STORY. \
If, while implementing the feature, you notice the PRD is complete, output <promise>COMPLETE</promise>. \
$extra_prompt" --output-format stream-json --verbose 2>&1 | \
    jq -rj '
      if .type == "assistant" then
        .message.content[]? |
        if .type == "tool_use" then
          "\n\u001b[36m[\(.name)]\u001b[0m " + (
            if .name == "Bash" then
              .input.command // ""
            elif .name == "Read" or .name == "Write" or .name == "Edit" then
              .input.file_path // ""
            elif .name == "Glob" then
              .input.pattern // ""
            elif .name == "Grep" then
              .input.pattern // ""
            elif .name == "Task" then
              .input.description // ""
            else
              ""
            end
          ) + "\n"
        elif .type == "text" then
          .text
        else empty end
      else empty end
    '
done

echo ""
echo "=== All $iterations iterations complete ==="
