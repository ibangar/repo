# Higgsfield CLI integration

Wires the [Higgsfield CLI](https://github.com/higgsfield-ai/cli) (`hf`) into this
repo so Claude Code can generate images for your projects from the terminal.

Higgsfield does not ship an MCP server — the CLI is the integration surface, and
agents drive it directly. So this repo provides an installer, a Claude Code
skill that teaches Claude the command surface and the safety rules around it,
and a permission allowlist so read-only calls don't prompt.

## Setup

**1. Install the CLI**

```bash
./scripts/install-higgsfield.sh          # installs to ~/.local/bin
```

Installs `hf` (with a `higgsfield` alias) by fetching the release binary with
curl. Use `PREFIX=/usr/local` to install system-wide, or
`HIGGSFIELD_VERSION=x.y.z` to pin a version.

Upstream alternatives, if you prefer them:

```bash
curl -fsSL https://raw.githubusercontent.com/higgsfield-ai/cli/main/install.sh | sh
brew install higgsfield-ai/tap/higgsfield
npm install -g @higgsfield/cli
```

> The npm package downloads its binary in a postinstall script that uses Node's
> `https` module, which ignores `HTTPS_PROXY`. It hangs on any machine whose
> egress is proxied (most CI runners and sandboxes). `scripts/install-higgsfield.sh`
> exists to avoid that; it uses curl, which honours the proxy.

**2. Sign in**

```bash
hf auth login
```

This is browser-based OAuth (PKCE) — it opens a browser and listens on a
loopback port. **You have to run it yourself**; Claude can't, and it won't work
over SSH or in a headless container. There is no API-key environment variable.

**3. Pick a workspace** (only if you have more than one)

```bash
hf workspace list
hf workspace set <workspace_id>
```

This decides which account gets billed.

**4. Check it worked**

```bash
hf account status      # email, plan, remaining credits
hf model list --image
```

## Usage

Once set up, just ask Claude Code in this repo:

> Generate a hero image for the landing page — a matte black espresso machine on
> a concrete counter, morning light from the left.

The `higgsfield` skill kicks in and Claude will pick a model, price the job,
generate it, and save the result into `assets/`.

Driving it by hand:

```bash
hf model list --image                      # what's available
hf model get <job_type>                    # exact params for a model
hf generate cost <job_type> --prompt "..."  # price it first
hf generate create <job_type> --prompt "..." --wait
```

Reference images can be passed as plain local paths — `--image ./ref.png` — and
are uploaded automatically.

## What's here

| Path | Purpose |
|---|---|
| `scripts/install-higgsfield.sh` | Proxy-safe installer for the `hf` binary |
| `.claude/skills/higgsfield/SKILL.md` | Teaches Claude the CLI, plus credit/auth guardrails |
| `.claude/settings.json` | Pre-approves read-only `hf` commands |
| `assets/` | Where generated images land (gitignored by default) |

## Notes on cost and credentials

- Generation spends real credits. The skill instructs Claude to run
  `hf generate cost` and get your go-ahead before batches or video jobs.
- `.claude/settings.json` deliberately pre-approves **only read-only** commands.
  `hf generate create` still prompts each time. If you'd rather not be asked,
  add `"Bash(hf generate create:*)"` to the allowlist — that hands Claude
  unprompted spending authority, so it's opt-in.
- Credentials are stored in `~/.config/higgsfield/credentials.json`, outside the
  repo. Don't copy them in; `.gitignore` guards against it, but the real rule is
  don't.
