---
name: remote-review
description: Offer the user a remote code review of your git changes via a shareable tunnel link, so they can review and comment from any device without needing to be on the same machine or open a PR. Use this after completing a meaningful chunk of work in a non-interactive/dispatch/background session, especially when the user is not actively watching the terminal. If the user leaves comments, they are printed to stdout when the command exits — read them and address the feedback as the next step.
---

# remote-review

A CLI that renders your current git diff as a GitHub-style review page, tunnels it to a public HTTPS URL via `cloudflared`, and blocks until the user submits comments (or finishes with none). This lets the user review your work from their phone or another machine while you're running unattended (dispatch mode) — no PR required.
