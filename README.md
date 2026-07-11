# remote-review

Review Claude Code's git diffs from anywhere — a shareable, tunneled diff viewer built for **dispatch mode** (non-interactive / `--print` / background Claude Code sessions), where you're not sitting in front of the terminal that's running the agent.

Inspired by [difit](https://github.com/yoshiko-pg/difit), which solves this beautifully for local, same-machine review. `remote-review` adds one piece: a **tunnel**, so the review page works from your phone or another machine, and blocks the agent's turn until you've actually looked at the diff — no PR needed.

```
┌──────────────────────────────┐
│ Claude Code (dispatch mode)   │
│  finishes a task              │
│  runs: remote-review .        │──┐
└──────────────────────────────┘  │
                                    ▼
                     starts local server + cloudflared tunnel
                     prints https://xyz.trycloudflare.com
                                    │
                                    ▼
                     you open the link on your phone,
                     read the diff, leave inline comments,
                     tap "Send to Claude"
                                    │
                                    ▼
                     CLI unblocks, prints comments to stdout,
                     Claude Code reads them as its tool result
                     and addresses the feedback
```
