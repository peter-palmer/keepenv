/* Screenshot harness: renders the real UI against an in-memory backend so
   the README images show the actual interface.

   Every value below is fabricated. Never put a real credential here — this
   file is committed, and a project about secret hygiene should not ship
   strings that trip secret scanners. */
(() => {
  const params = new URLSearchParams(location.search);
  const theme = params.get("theme") === "light" ? "light" : "dark";
  const scene = params.get("scene") || "variables";

  const files = {
    ".env": [
      "# ─── Stripe ──────────────────────────────────────────",
      "",
      'STRIPE_SECRET_KEY="sk_test_EXAMPLE_NOT_A_REAL_KEY"',
      "STRIPE_WEBHOOK_SECRET=whsec_EXAMPLE_NOT_A_REAL_SECRET",
      "",
      "# ─── Database ────────────────────────────────────────",
      "DATABASE_URL='postgres://app:hunter2@localhost:5432/app_dev'",
      "REDIS_URL=redis://127.0.0.1:6379/0",
      "",
      "# Public — safe to expose to the browser",
      "NEXT_PUBLIC_API_URL=http://localhost:3000",
      "NEXT_PUBLIC_SENTRY_DSN=https://EXAMPLE@o0.ingest.example.test/0",
      "",
      "FEATURE_FLAGS=",
      "  export LEGACY_API_TOKEN = a1b2c3d4   # remove after the v3 migration",
      "",
    ].join("\n"),
    ".env.local": "DATABASE_URL='postgres://app:hunter2@localhost:5432/app_local'\nDEBUG=true\n",
    ".env.production": "NODE_ENV=production\r\nAPI_URL=https://api.example.com\r\n",
    ".env.example": "STRIPE_SECRET_KEY=\nDATABASE_URL=\n",
  };

  const projects = [
    { id: "p1", name: "storefront", rootPath: "/Users/dev/code/storefront", addedAt: "", order: 0 },
    { id: "p2", name: "billing-api", rootPath: "/Users/dev/code/billing-api", addedAt: "", order: 1 },
    { id: "p3", name: "admin-dashboard", rootPath: "/Users/dev/code/admin-dashboard", addedAt: "", order: 2 },
    { id: "p4", name: "marketing-site", rootPath: "/Users/dev/code/marketing-site", addedAt: "", order: 3 },
  ];

  const dg = (s) => "sha" + Array.from(s).reduce((a, c) => ((a * 31 + c.charCodeAt(0)) >>> 0), 7).toString(16);
  const git = { ".env": "notIgnored", ".env.local": "ignored", ".env.production": "ignored", ".env.example": "tracked" };
  let externallyChanged = false;

  window.__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: "main" }, currentWebview: { windowLabel: "main", label: "main" } },
    transformCallback: (cb) => { const id = Math.floor(Math.random() * 1e9); window["_cb" + id] = cb; return id; },
    invoke: async (cmd, args = {}) => {
      switch (cmd) {
        case "plugin:event|listen": return 1;
        case "list_projects": return projects;
        case "get_preferences": return { theme, lastProjectId: "p1" };
        case "set_preferences": return args.preferences;
        case "home_directory": return "/Users/dev";
        case "git_status": return { state: git[args.fileName] || "notIgnored" };
        case "reveal_project": case "reveal_env_file": return null;
        case "list_env_files":
          return args.projectId === "p1"
            ? Object.keys(files).map((n) => ({ name: n, sizeBytes: files[n].length, modifiedAtMs: Date.now(), isSymlink: false }))
            : [];
        case "read_env_file": {
          const c = files[args.fileName];
          return { name: args.fileName, content: c, digest: dg(c), sizeBytes: c.length, modifiedAtMs: Date.now() };
        }
        case "write_env_file":
          if (externallyChanged) throw { kind: "conflict", message: `"${args.fileName}" changed on disk since Keepenv loaded it.` };
          files[args.fileName] = args.content;
          return { digest: dg(args.content), sizeBytes: args.content.length, modifiedAtMs: Date.now() };
        default: throw { kind: "unknown", message: "unstubbed: " + cmd };
      }
    },
  };

  // macOS draws the traffic lights over the sidebar; render them so the shot
  // matches what the window actually looks like.
  const lights = document.createElement("style");
  lights.textContent = `
    body::before {
      content: ""; position: fixed; left: 20px; top: 19px; z-index: 999;
      width: 52px; height: 12px;
      background:
        radial-gradient(circle 6px at 6px 6px,  #ff5f57 98%, transparent 100%),
        radial-gradient(circle 6px at 26px 6px, #febc2e 98%, transparent 100%),
        radial-gradient(circle 6px at 46px 6px, #28c840 98%, transparent 100%);
    }`;
  document.head.appendChild(lights);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const byText = (t) => Array.from(document.querySelectorAll("button")).find((b) => b.textContent.trim() === t);
  const rowOf = (k) => Array.from(document.querySelectorAll('input[aria-label="Variable name"]'))
    .find((i) => i.value === k)?.closest("div.group");
  const setNative = (el, v) => {
    const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement : window.HTMLInputElement;
    Object.getOwnPropertyDescriptor(proto.prototype, "value").set.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };

  window.addEventListener("load", async () => {
    await sleep(900);
    if (scene === "reveal" || scene === "raw" || scene === "conflict") {
      rowOf("NEXT_PUBLIC_API_URL")?.querySelector('button[aria-label="Reveal value"]')?.click();
      rowOf("REDIS_URL")?.querySelector('button[aria-label="Reveal value"]')?.click();
      await sleep(250);
    }
    if (scene === "raw") {
      byText("Reveal all")?.click();
      await sleep(200);
      byText("Raw")?.click();
      await sleep(300);
    }
    if (scene === "conflict") {
      externallyChanged = true;
      const v = rowOf("REDIS_URL")?.querySelector('input[aria-label="Variable value"]');
      if (v) setNative(v, "redis://127.0.0.1:6379/2");
      await sleep(250);
      byText("Save")?.click();
      await sleep(600);
    }
    document.documentElement.setAttribute("data-shot-ready", "1");
  });
})();
