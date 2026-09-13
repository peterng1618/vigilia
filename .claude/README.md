# `.claude/` — Claude Code integration

## What is here

```
.claude/
  plugins/vigilia/            Namespaced plugin. Pointer files only, no substance.
  README.md                   This file.
```

The real skill content is in [`.agents/skills/`](../.agents/skills/), which is
canonical so harnesses other than Claude Code read the same material. The plugin
exists solely to give those skills a `vigilia:` namespace — standalone
`.claude/skills/` entries cannot be namespaced and would collide with personal or
third-party skills of the same name.

See [`.claude/plugins/vigilia/README.md`](plugins/vigilia/README.md) for why the
entries are pointer files rather than symlinks.

## `settings.json` is deliberately absent — it needs your decision

There is no `settings.json` here yet. Registering the plugin requires one, but
writing it means (a) auto-enabling a plugin and (b) potentially granting Bash
permission rules — both of which change what agents may do in this repository
without prompting. That is your call, not an agent's.

**Until you add it, the skills will not load under the `vigilia:` namespace.**
They remain readable as plain files in `.agents/skills/`.

### Minimal version — registration only, no permission changes

This is enough to make `vigilia:conventions` and friends load. It grants no new
Bash permissions.

```json
{
  "extraKnownMarketplaces": {
    "vigilia": {
      "source": { "source": "directory", "path": ".claude/plugins/vigilia" }
    }
  },
  "enabledPlugins": {
    "vigilia@vigilia": true
  }
}
```

### Optional — fewer prompts for the routine commands

Add this `permissions` block **only if** you want these to stop prompting. Each
rule is a prefix wildcard, so `Bash(npx vite build *)` also matches
`dotnet build Vigilia.slnx --configuration Release`. Review them individually;
`npx` and `dotnet` rules are broader than they look, since both can run arbitrary
project code.

```json
  "permissions": {
    "allow": [
      "Bash(npx vitest *)",
      "Bash(npx tsc *)",
      "Bash(npx vite build *)",
      "Bash(node packages/player/scripts/check-size.mjs)",
      "Bash(dotnet restore *)",
      "Bash(npx vite build *)",
      "Bash(dotnet test *)",
      "Bash(git status *)",
      "Bash(git diff *)",
      "Bash(git log *)",
      "Bash(git show *)",
      "Bash(git branch *)"
    ]
  }
```

Settings precedence is user < project < local. Put personal overrides in
`.claude/settings.local.json`, which is gitignored.

## Verifying it worked

**A new session is required.** Whether the plugin loads and the names resolve
cannot be checked from inside the session that wrote these files. Start a fresh
session and confirm the five `vigilia:` skills are listed:

`conventions` · `code-review` · `create-pr` · `spec-driven-development` ·
`create-skill`

If they are absent, check in this order: `settings.json` exists and parses; the
marketplace path resolves; `enabledPlugins` uses the `plugin@marketplace` form
(`vigilia@vigilia`); each pointer file's frontmatter `name` matches its directory.
