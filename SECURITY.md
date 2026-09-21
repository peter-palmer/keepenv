# Security policy

Keepenv is a tool for handling secrets, so security reports are taken
seriously and get priority over feature work.

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Use GitHub's private reporting instead:
[Report a vulnerability](https://github.com/peter-palmer/keepenv/security/advisories/new).

You can expect an acknowledgement within 72 hours and an assessment within
seven days. If a fix is warranted, it ships in a patch release and the
advisory credits you unless you prefer otherwise.

## What counts as a vulnerability

Anything that breaks one of the guarantees below:

- An environment value reaching Keepenv's own storage, a log, a crash report,
  a window title or a URL.
- A path outside a registered project root becoming readable or writable
  through the app.
- Any outbound network request.
- Keepenv destroying or corrupting a `.env` file, including silently
  overwriting a file that changed on disk.
- Arbitrary code or command execution through file contents, file names or
  project paths.

## Design constraints that back those guarantees

- The webview has no generic filesystem access. There is no `tauri-plugin-fs`,
  no `tauri-plugin-shell`, and no HTTP client anywhere in the dependency tree.
- Every filesystem operation resolves its path in `src-tauri/src/paths.rs`,
  which requires a project id registered in Keepenv's own store plus a file
  name matching the `.env` family with no separators and no `..`.
- The persistence layer accepts only `Project` and `Preferences` — closed
  structs of scalar fields with no free-form map — so there is no representable
  way to store a variable name or value.
- `git` is invoked from Rust with a fixed argument vector. No shell is involved
  and no argument is influenced by the frontend.
- The window runs under a strict CSP with no remote origins. The `opener`
  plugin is called from Rust so the webview is never granted `open-url`.

## Scope

Out of scope: physical access to an unlocked machine, malicious software
already running as your user, and anything requiring you to run untrusted code
yourself. Keepenv reads and writes plaintext `.env` files by design — it does
not encrypt them, because your applications need to read them.

## Supported versions

The latest release is supported. Keepenv is pre-1.0; there are no backports.
