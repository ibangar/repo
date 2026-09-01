---
name: higgsfield
description: Generate images (and video, audio, 3D) with the Higgsfield CLI (`hf` / `higgsfield`). Use whenever the user asks to create, generate, render, or iterate on an image, product photo, thumbnail, hero shot, character, poster, or other visual asset for this project — or asks about Higgsfield models, credits, presets, Soul IDs, or the `hf` command itself.
---

# Generating images with the Higgsfield CLI

The `hf` CLI runs Higgsfield's image, video, audio and 3D models from the
terminal. This skill covers the image path; the same flow works for the others.

## 0. Preflight

Run this before the first generation in a session. It is cheap and it turns the
two most common failures (not installed, not signed in) into a clear message
instead of a confusing API error.

```bash
hf --version                 # not found -> ./scripts/install-higgsfield.sh
hf auth token >/dev/null     # "Not authenticated." -> user runs: hf auth login
hf account status            # plan + remaining credits
```

`hf auth login` is **browser-based OAuth (PKCE)** — it opens a browser and
listens on a loopback port. You cannot complete it for the user, and it does not
work over SSH or in a headless container. Ask the user to run it themselves and
say when it is done.

There is no API-key or token environment variable. Credentials land in
`~/.config/higgsfield/credentials.json` (override with
`HIGGSFIELD_CREDENTIALS_PATH`); the selected workspace lives in
`~/.config/higgsfield/config.json` (override with `HIGGSFIELD_CONFIG_PATH`).

If a command fails with `No workspace selected.`, run `hf workspace list` and
ask the user which one to `hf workspace set <workspace_id>`. Workspace choice
decides **which account gets billed**, so do not guess it.

## 1. Pick a model

Never hardcode a model name from memory — the roster changes. Discover it:

```bash
hf model list --image           # image models only
hf model get <job_type>         # exact params, defaults and allowed values
hf model get <job_type> --json  # same, machine-readable
```

`hf model get` is the authoritative parameter list for a model. Read it before
building a `generate create` call rather than guessing flag names; models differ
in what they accept (aspect ratios, resolutions, reference-image counts).

## 2. Check the cost

Generation spends the user's credits. For anything beyond a single cheap image —
a batch, an unfamiliar model, a video — price it first:

```bash
hf generate cost <job_type> --prompt "..."
```

Then state the cost and get a go-ahead before spending. Do not run a batch of
variants on your own initiative.

## 3. Generate

```bash
hf generate create <job_type> --prompt "..." --wait
```

Useful conventions:

- **`--wait`** blocks until the job finishes and prints the result URL(s). Add
  `--wait-timeout 20m --wait-interval 5s` for slow models. Without `--wait` you
  get a job id — poll it with `hf generate wait <job_id>`.
- **`--json`** gives parseable output. Use it whenever you need to extract URLs
  programmatically instead of scraping the human-readable output.
- **Reference images** go in `--image-references` (alias `--image`), plus
  `--start-image` / `--end-image` for video. Each accepts either an upload/job
  UUID **or a local file path — paths are uploaded automatically**, so there is
  usually no need to call `hf upload create` yourself. Repeat the flag for
  multiple references; do not comma-join them.
- Model-specific params are passed as `--name value` exactly as `hf model get`
  spells them.

## 4. Save the output into the project

Results come back as URLs on Higgsfield's CDN, not as local files, and those
URLs are not a durable asset store. Always download what you intend to keep:

```bash
job=$(hf generate create <job_type> --prompt "..." --wait --json)
echo "$job" | python3 -c 'import json,sys
for r in json.load(sys.stdin).get("results", []):
    print(r.get("url") or r.get("raw", {}).get("url", ""))'
# then: curl -fsSL -o assets/<descriptive-name>.png "<url>"
```

Inspect the actual JSON shape once with `--json` before relying on a key path —
treat the snippet above as a starting point, not a guarantee.

Save into `assets/` with a descriptive, kebab-case filename. Tell the user the
path you wrote and the credits spent.

## 5. Higher-level commands

Prefer these over hand-rolling a long prompt when they fit the request:

| Command | Use for |
|---|---|
| `hf product-photoshoot` | brand-quality product images (server-side prompt enhancement) |
| `hf marketplace-cards` | marketplace product cards |
| `hf preset list` / `hf preset get` | curated presets; resolve one into generation input |
| `hf soul-id` | train a reusable face-faithful character reference |
| `hf workflow list` / `hf workflow get` | multi-step workflows, e.g. reframe |
| `hf generate list --image` | recent jobs, to recover a result URL you lost |

## Guardrails

- **Credits are real money.** One generation on request is fine; batches,
  retries-in-a-loop and video jobs need the user's explicit go-ahead first.
- **Never run `hf auth login` yourself** — it needs the user's browser.
- **Do not commit credentials.** `~/.config/higgsfield/` is outside the repo;
  keep it that way and never paste `hf auth token` output into a file, a commit,
  or a PR.
- **Do not invent model names, params or flags.** If `hf model get` and
  `--help` do not confirm it, it does not exist.
