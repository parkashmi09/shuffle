---
args: issue-number
---

# Fix Issue

1. View the issue: `gh issue view $issue-number`
2. Find the relevant files in `src/components/` and `src/utils/`
3. Implement the minimal fix required
4. Run `npm run build` to verify no errors
5. Commit with message referencing the issue: `fix: description (#$issue-number)`
