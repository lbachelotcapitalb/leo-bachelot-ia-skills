# claude-skills

A small collection of **[Claude Code](https://claude.com/claude-code) skills** I built and use
daily, cleaned up for public reuse. Each one is self-contained, dependency-light, and softcoded so
it works on any project — not just mine.

> A *skill* is a folder with a `SKILL.md` (instructions Claude reads) plus optional helper scripts.
> Claude loads it automatically when the task matches its description. See the
> [skills documentation](https://docs.claude.com/en/docs/claude-code/skills).

## The skills

| Skill | What it does | Language / deps |
|---|---|---|
| **[deck-builder](skills/deck-builder/)** | Build & restructure polished, on-brand **PowerPoint** decks programmatically — fill-the-space layout rules, vector SVG icons, a render-to-PNG self-check. Theme-agnostic. | Python (`python-pptx`, Pillow) |
| **[review-contrib](skills/review-contrib/)** | Audit, test and merge a collaborator's **commit / branch / PR** (often from a fork) safely — conflict audit, isolated worktree review, automated gate, sub-agent code review. Never touches `main`. | git + `gh` CLI |
| **[autocli-password](skills/autocli-password/)** | Run a CLI command that needs a **secret only the user knows** — a native hidden-input dialog pipes it straight into the command. The secret stays in RAM, never on disk, never in history. Optional `ssh-agent`-style RAM cache. | Bash + Node (zero deps) |

## Install

Skills live in `~/.claude/skills/` (global) or `<project>/.claude/skills/` (per-project). Copy the
one(s) you want:

```bash
git clone https://github.com/lbachelotcapitalb/leo-bachelot-ia-skills.git
cp -R leo-bachelot-ia-skills/skills/deck-builder ~/.claude/skills/
```

Claude Code picks them up automatically — no registration step. Trigger a skill by describing the
task (e.g. *"build me a pitch deck"*, *"review this contributor's branch"*, *"this deploy needs my
vault passphrase"*) or by invoking it explicitly.

Most skills are **macOS-first** (native dialogs, LibreOffice render path) with documented Linux
fallbacks. Check each skill's README for its exact prerequisites.

## Notes

- These are extracted from my personal setup and **genericized** — any reference to my own infra
  (vault names, hosts, project conventions) has been replaced with neutral placeholders.
- Two of the three are written in **French** (their natural working language); the instructions are
  language-agnostic in spirit and Claude operates fine in either language.

## License

[MIT](LICENSE). `deck-builder` reuses MIT-licensed design-token tables and text-measurement ideas —
attribution is in [`skills/deck-builder/SKILL.md`](skills/deck-builder/SKILL.md#attribution--licenses).
