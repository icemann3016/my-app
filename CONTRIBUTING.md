# How we work together (with Claude)

We each work with our own Claude on our own computer. GitHub keeps us in sync, and `CLAUDE.md` keeps both Claudes following the same rules.

## One-time setup (each person)

1. Install [Node.js 22+](https://nodejs.org), Git and the [GitHub CLI](https://cli.github.com) (`brew install gh`), then log in with `gh auth login` (GitHub.com → HTTPS → login with browser). Your normal GitHub password does **not** work on the command line.
2. Accept the GitHub invite to the repo, then clone it:
   ```bash
   git clone https://github.com/icemann3016/my-app.git
   cd my-app
   npm install
   cp .env.example .env.local
   ```
   Ask Zlati for the Supabase keys (shared via a password manager) and put them in `.env.local`.
3. Open the folder with Claude (Claude Code in the terminal, or connect the folder in the Claude desktop app).

## Daily loop

1. **Pick a task** from GitHub Issues and assign it to yourself.
2. **Update and branch:**
   ```bash
   git checkout main && git pull
   git checkout -b <yourname>/<task>
   ```
3. **Build it with Claude.** Paste in the issue or describe the task. Claude follows `CLAUDE.md`.
4. **Check it:** `npm run typecheck && npm run lint && npm test && npm run build`
5. **Push and open a pull request:**
   ```bash
   git push -u origin <yourname>/<task>
   ```
6. **The other person reviews** (Claude can help: "review this PR"). Then merge.
7. Back to step 1.

## Rules of thumb

- Small PRs, merged often. Aim for less than a day of work each.
- Don't work on the same files at the same time. Check the "Who owns what" table in `CLAUDE.md`.
- If you make a decision (library, structure, naming), add it to the decisions log in `CLAUDE.md` in the same PR.
- Personal Claude notes go in `CLAUDE.local.md`. It's git-ignored, so it isn't shared.
