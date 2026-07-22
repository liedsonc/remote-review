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

## Quickstart

Try it in under a minute — no Claude Code required:

```bash
# Install the CLI (pick one)
npm install -g remote-review
# or, without installing globally:
npx remote-review .

# Install cloudflared for remote/phone access (macOS example)
brew install cloudflared
```

In any git repo with changes:

```bash
cd ~/projects/my-app
remote-review .
```

The command prints a **Local:** URL (same machine) and, if cloudflared is installed, a **Remote:** URL (phone or another device). Your browser opens the local page automatically.

1. Open the review page — use **Remote:** on your phone, or follow the auto-opened local tab.
2. Read the diff and click **+** on any line to leave a comment.
3. Tap **Send to Claude** (or **Finish (no comments)** to approve with no feedback).

When you submit, the CLI unblocks and prints your comments to stdout:

```
src/api/handler.ts:L18
This should probably validate input before writing to disk
```

If submit fails (e.g. the tunnel dropped), use the **Copy** button on the page and paste the comments into your agent manually.

Local-only, no tunnel:

```bash
remote-review . --no-tunnel
```

## Install

```bash
npm install -g remote-review
```

You'll also want [`cloudflared`](https://github.com/cloudflare/cloudflared/releases) on your `PATH` for remote links (no account or config needed — it uses anonymous "quick tunnels"). Without it, `remote-review` still works, just local-only.

```bash
# macOS
brew install cloudflared

# Linux: grab the binary from the releases page above, or
# your distro's package manager if it has one
```

## Usage

```bash
remote-review .        # all uncommitted changes (most common in dispatch mode)
remote-review          # HEAD's latest commit
remote-review staged   # staged changes only
remote-review working  # unstaged changes only
remote-review main     # a specific ref vs its parent
remote-review feature main   # compare two refs
```

The command **blocks** until you submit a review (or close the tab having decided there's nothing to say). On exit, any comments are printed to stdout in a simple format:

```
src/components/Button.tsx:L42
Make this variable name more descriptive

src/api/handler.ts:L18
This should probably validate input before writing to disk
```

If nothing was submitted, it prints `Review finished with no comments.` instead.

### Options

| Flag | Default | Description |
| --- | --- | --- |
| `-p, --port <port>` | random free port | Local port to bind |
| `--no-tunnel` | tunnel on | Skip cloudflared, local-only |
| `--host <host>` | `127.0.0.1` | Host to bind the local server to |
| `-C, --cwd <path>` | cwd | Run against a different repo path |
| `--context <lines>` | git default | Context lines around each change |
| `--timeout <seconds>` | none | Give up waiting after N seconds |
| `--no-open` | opens browser | Don't auto-open the local URL |

## Using it from Claude Code

Copy `skills/remote-review` into your agent's skills directory (or wherever your Claude Code setup loads skills from) so Claude Code knows when and how to reach for it during dispatch sessions:

```bash
cp -r skills/remote-review ~/.claude/skills/   # adjust to your actual skills path
```

The skill tells Claude Code to run `remote-review .` after finishing meaningful work in a non-interactive session, share the printed `Remote:` URL with you, and treat the stdout it gets back as review feedback to act on.

## How it's different from difit

- **Tunneled by default** — a fresh `cloudflared` quick tunnel per invocation, torn down when the review is submitted, so the link works from any device without VPN/SSH setup.
- **Token-gated** — the tunnel URL alone isn't enough; a random token is required, so a leaked/logged URL without the token query param doesn't expose the diff.
- **Built for the blocking-CLI-call contract** specifically, so it drops straight into an agent's tool-call loop the same way difit does, just reachable remotely.
- Everything else (diff parsing, comment UX, prompt format) intentionally mirrors difit's proven model.

## Security notes

- Each session generates a random token; without it, `/api/diff` and `/api/submit` return `403`.
- The tunnel is anonymous and unauthenticated beyond that token — treat the link as a bearer credential, don't paste it somewhere public.
- The server only accepts **one** submission per invocation, then the process exits and the tunnel is torn down.
- `remote-review` never writes to your repo or executes anything on your behalf; it only reads diffs and returns text.

## Development

```bash
git clone https://github.com/liedsonc/remote-review.git
cd remote-review
npm install
npm test
node bin/remote-review.js . --cwd /path/to/some/repo --no-tunnel
```

No build step — plain Express backend, dependency-free vanilla-JS frontend.

## License

MIT
