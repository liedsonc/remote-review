---
name: remote-review
description: Offer the user a remote code review of your git changes via a shareable tunnel link, so they can review and comment from any device without needing to be on the same machine or open a PR. Use this after completing a meaningful chunk of work in a non-interactive/dispatch/background session, especially when the user is not actively watching the terminal. If the user leaves comments, they are printed to stdout when the command exits — read them and address the feedback as the next step.
---

# remote-review

A CLI that renders your current git diff as a GitHub-style review page, tunnels it to a public HTTPS URL via `cloudflared`, and blocks until the user submits comments (or finishes with none). This lets the user review your work from their phone or another machine while you're running unattended (dispatch mode) — no PR required.

## Before running commands

Choose `<review-command>` using this rule: if `command -v remote-review` succeeds, use `remote-review`. Otherwise use `npx remote-review`. If falling back to `npx remote-review` would require network access in a sandboxed environment without network permission, request escalated permissions and user approval before running it.

## When to use this

- You've just finished implementing a feature, fix, or refactor and want human sign-off before continuing, committing, or moving to the next task.
- You're running in a non-interactive / `--print` / dispatch / background session where the user isn't watching your output live and may be on a different device entirely.
- The user asked for a way to review your changes "on the go" or without a PR.

Do not use this for trivial one-line changes, and do not use it more than once per logical chunk of work — batch your changes into a meaningful diff first.
