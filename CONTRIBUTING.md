# Contributing to Keepenv

Thanks for considering it. Keepenv is small on purpose, so the most useful
contributions are usually bug fixes, parser edge cases and platform support —
not new surface area.

## Before you start

Open an issue first for anything beyond a bug fix. It saves you writing code
that gets declined for scope reasons. Things that are **out of scope** by
design: cloud sync, accounts, teams, remote secret providers, encryption of
`.env` files, telemetry of any kind, and anything that makes a network request.

## Setup

You need Node 20+, Rust (stable) and Xcode Command Line Tools.

```bash
git clone https://github.com/peter-palmer/keepenv.git
cd keepenv
npm install
npm run tauri dev
```

## Before you open a pull request

```bash
npm run check
```

That runs the TypeScript checks, the frontend tests, Clippy with warnings
denied, and the Rust tests. CI runs the same thing, so a green local `check`
means a green PR.

## The two rules that matter

**1. No environment value may reach Keepenv's own storage, a log, an error
message, a window title or a URL.** The persistence layer accepts only
`Project` and `Preferences`. If a change needs to widen those types, that is a
design discussion, not an implementation detail.

**2. Editing must stay lossless.** `serialize(parse(text)) === text` has to
hold for every input, and editing one variable must not alter any other line's
bytes. The property tests in `src/lib/env/` guard this. If you touch the
parser, add cases rather than relaxing assertions.

## Parser changes

`src/lib/env/` is the most sensitive part of the codebase and carries the most
tests. A parser PR should include:

- A round-trip case in `parse.test.ts` proving the new input survives
  unchanged.
- A case in `edit.test.ts` proving an edit touches only the intended line.
- A note in the PR describing which real-world `.env` dialect motivated it.

If you found a file Keepenv mangles, an issue with the smallest reproducing
file is genuinely valuable even without a fix.

## Style

Match the surrounding code. The codebase uses strict TypeScript, explicit
types, JSDoc on exported functions, and comments that explain *why* rather
than restating the code. Keep filesystem work out of React components — it
belongs behind `src/services/`.

## Commits

Clear, imperative subject lines. Conventional Commits are welcome but not
required.
