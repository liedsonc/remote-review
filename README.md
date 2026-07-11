# remote-review

Review Claude Code's git diffs from anywhere — a shareable, tunneled diff viewer built for **dispatch mode** (non-interactive / `--print` / background Claude Code sessions), where you're not sitting in front of the terminal that's running the agent.

Inspired by [difit](https://github.com/yoshiko-pg/difit), which solves this beautifully for local, same-machine review. `remote-review` adds one piece: a **tunnel**, so the review page works from your phone or another machine, and blocks the agent's turn until you've actually looked at the diff — no PR needed.
