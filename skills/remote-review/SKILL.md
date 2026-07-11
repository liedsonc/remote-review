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

## Basic usage

```
<review-command> [target] [compareWith]
```

Target keywords, same as plain `git diff` semantics:

```
<review-command>              # HEAD vs its parent (the latest commit)
<review-command> .            # all uncommitted changes (staged + unstaged) — most common in dispatch mode
<review-command> staged       # staging area only
<review-command> working      # unstaged only
<review-command> main         # a specific ref vs its parent
<review-command> feature main # compare two refs
```

In dispatch mode, you have usually not committed yet, so `<review-command> .` is almost always the right call.

## What happens when you run it

1. It resolves the diff, starts a local server, and (unless `--no-tunnel` is passed) starts a `cloudflared` quick tunnel.
2. It prints two URLs to stderr: a `Local:` one and a `Remote:` one. **Share the `Remote:` URL with the user in your response** — that's the one that works from another device. If no tunnel could be started (cloudflared missing), share the `Local:` one instead and mention that it only works on the same machine.
3. The command **blocks** — this is intentional. Do not background it with `&` or treat it as fire-and-forget; the whole point is that your next turn's tool result is the review outcome.
4. When the user submits the review (or closes it with no comments), the command exits and prints any comments to **stdout** in this format:

   ```
   src/components/Button.tsx:L42
   Make this variable name more descriptive

   src/api/handler.ts:L18
   This should probably validate input before writing to disk
   ```

5. If no comments were left, stdout says so explicitly ("Review finished with no comments.") — treat that as approval to proceed.
