package broker

// adminTemplates holds every server-rendered admin page. They share a base
// layout via the {{define}} blocks below. Styling uses Tailwind utility classes
// from the pre-built stylesheet served at /assets/app.css (see web-src/), the
// same look as the demo page (web/demo.html): clean, purple accent, class-based
// dark mode with a header toggle.
//
// All interpolated values flow through html/template, which contextually
// auto-escapes them — user-supplied fields (agent names, origins, greetings)
// are rendered as text, never markup. No template.HTML is used on any data.
//
// The {{define "toggle"}} block is the shared dark-mode toggle button; each
// page drops it into its own header bar.
const adminTemplates = `
{{define "toggle"}}<button type="button" class="cs-toggle shrink-0" data-theme-toggle title="Toggle dark mode" aria-label="Toggle dark mode">
  <svg class="cs-icon-sun h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>
  <svg class="cs-icon-moon h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
</button>{{end}}

{{define "head"}}<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>clankstack admin</title>
    <script>
      (function () {
        try {
          var t = localStorage.getItem('theme');
          if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
          }
        } catch (e) {}
      })();
    </script>
    <link rel="stylesheet" href="/assets/app.css" />
  </head>
  <body class="cs-bg min-h-screen font-sans antialiased">
    <main class="mx-auto w-full max-w-5xl px-5 pb-24 pt-10">
{{end}}

{{define "foot"}}
    </main>
    <script>
      document.addEventListener('click', function (ev) {
        // Dark-mode toggle: flip the class and persist the explicit choice.
        if (ev.target.closest('[data-theme-toggle]')) {
          var isDark = document.documentElement.classList.toggle('dark');
          try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch (e) {}
          return;
        }
        // Click-to-copy on .copy elements.
        var el = ev.target.closest('.copy');
        if (!el) return;
        var val = el.getAttribute('data-copy') || el.textContent;
        navigator.clipboard && navigator.clipboard.writeText(val.trim());
        var old = el.textContent;
        el.textContent = 'copied';
        setTimeout(function () { el.textContent = old; }, 1000);
      });
    </script>
  </body>
</html>
{{end}}

{{define "login"}}{{template "head"}}
      <header class="mb-6 flex items-center justify-between gap-4">
        <h1 class="m-0 text-2xl font-bold tracking-tight">clankstack admin</h1>
        {{template "toggle"}}
      </header>
      <div class="cs-card my-4 max-w-md">
        <h2 class="cs-h2">Sign in</h2>
        {{if .Error}}<div class="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{{.Error}}</div>{{end}}
        <form method="POST" action="/admin/login">
          <label class="cs-label">Management key <span class="cs-hint">(sk_live_…)</span></label>
          <input class="cs-input" type="password" name="secret_key" autocomplete="off" autofocus required />
          <div class="mt-4">
            <button class="cs-btn cs-btn-primary" type="submit">Sign in</button>
          </div>
        </form>
      </div>
{{template "foot"}}{{end}}

{{define "list"}}{{template "head"}}
      <header class="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 class="m-0 text-2xl font-bold tracking-tight">Embeds</h1>
        <div class="flex flex-wrap items-center gap-2">
          <a class="cs-btn cs-btn-primary" href="/admin/embeds/new">+ New embed</a>
          <form class="m-0 inline" method="POST" action="/admin/logout"><button class="cs-btn" type="submit">Sign out</button></form>
          {{template "toggle"}}
        </div>
      </header>
      {{if .Flash}}<div class="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">{{.Flash}}</div>{{end}}
      <div class="cs-card my-4 overflow-x-auto">
      {{if .Embeds}}
        <table class="w-full border-collapse text-sm">
          <thead>
            <tr class="text-left">
              <th class="border-b border-slate-200 px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">Agent</th>
              <th class="border-b border-slate-200 px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">Publishable key</th>
              <th class="border-b border-slate-200 px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">Origins</th>
              <th class="border-b border-slate-200 px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">Resolution</th>
              <th class="border-b border-slate-200 px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">Status</th>
              <th class="border-b border-slate-200 px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">Daily budget</th>
              <th class="border-b border-slate-200 px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">Used today</th>
              <th class="border-b border-slate-200 px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody>
          {{range .Embeds}}
            <tr class="align-top">
              <td class="border-b border-slate-200 px-2 py-2.5 dark:border-slate-800">{{.Agent}}<div class="text-xs text-slate-500 dark:text-slate-400">{{.ID}}</div></td>
              <td class="border-b border-slate-200 px-2 py-2.5 dark:border-slate-800"><code class="cs-code copy cursor-pointer" data-copy="{{.PublishableKey}}" title="click to copy">{{.PublishableKey}}</code></td>
              <td class="border-b border-slate-200 px-2 py-2.5 dark:border-slate-800">{{range .AllowedOrigins}}<div>{{.}}</div>{{end}}</td>
              <td class="border-b border-slate-200 px-2 py-2.5 dark:border-slate-800">{{if .AgentRef}}agent_ref<div class="text-xs text-slate-500 dark:text-slate-400">{{.Embed.AgentRef}}</div>{{else}}explicit{{end}}</td>
              <td class="border-b border-slate-200 px-2 py-2.5 dark:border-slate-800">{{if eq .Status "enabled"}}<span class="cs-pill cs-pill-on">enabled</span>{{else}}<span class="cs-pill cs-pill-off">{{.Status}}</span>{{end}}</td>
              <td class="border-b border-slate-200 px-2 py-2.5 dark:border-slate-800">{{.DailyTokenBudget}}</td>
              <td class="border-b border-slate-200 px-2 py-2.5 dark:border-slate-800">{{.UsedToday}}</td>
              <td class="border-b border-slate-200 px-2 py-2.5 dark:border-slate-800">
                <div class="flex flex-wrap gap-1.5">
                  <form class="m-0 inline" method="POST" action="/admin/embeds/{{.ID}}/rotate-key" onsubmit="return confirm('Rotate the publishable key? The old key stops working immediately.');">
                    <button class="cs-btn" type="submit">Rotate key</button>
                  </form>
                  <form class="m-0 inline" method="POST" action="/admin/embeds/{{.ID}}/toggle">
                    <button class="cs-btn" type="submit">{{if eq .Status "enabled"}}Disable{{else}}Enable{{end}}</button>
                  </form>
                  <form class="m-0 inline" method="POST" action="/admin/embeds/{{.ID}}/delete" onsubmit="return confirm('Delete this embed permanently?');">
                    <button class="cs-btn cs-btn-danger" type="submit">Delete</button>
                  </form>
                </div>
              </td>
            </tr>
          {{end}}
          </tbody>
        </table>
      {{else}}
        <p class="text-slate-500 dark:text-slate-400">No embeds yet. <a class="text-accent hover:underline" href="/admin/embeds/new">Create one</a>.</p>
      {{end}}
      </div>
{{template "foot"}}{{end}}

{{define "new"}}{{template "head"}}
      <header class="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 class="m-0 text-2xl font-bold tracking-tight">New embed</h1>
        <div class="flex items-center gap-2">
          <a class="cs-btn" href="/admin">Back</a>
          {{template "toggle"}}
        </div>
      </header>
      <div class="cs-card my-4">
        {{if .Error}}<div class="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{{.Error}}</div>{{end}}
        <form method="POST" action="/admin/embeds">
          <label class="cs-label">Agent <span class="cs-hint">(display name shown to visitors)</span></label>
          <input class="cs-input" type="text" name="agent" required />

          <label class="cs-label">Allowed origins <span class="cs-hint">(comma or newline separated, exact match e.g. https://foo.com)</span></label>
          <textarea class="cs-input min-h-[4.5rem] resize-y" name="allowed_origins" required></textarea>

          <div class="grid gap-x-4 sm:grid-cols-2">
            <div>
              <label class="cs-label">Daily token budget</label>
              <input class="cs-input" type="number" name="daily_token_budget" min="0" value="100000" />
            </div>
            <div>
              <label class="cs-label">Sessions / minute</label>
              <input class="cs-input" type="number" name="sessions_per_min" min="0" value="30" />
            </div>
            <div>
              <label class="cs-label">Per-session message budget</label>
              <input class="cs-input" type="number" name="per_session_msg_budget" min="0" value="20" />
            </div>
            <div>
              <label class="cs-label">Per-session token budget</label>
              <input class="cs-input" type="number" name="per_session_tok_budget" min="0" value="20000" />
            </div>
          </div>

          <h2 class="cs-h2 mt-6">Upstream — explicit gateway</h2>
          <div class="grid gap-x-4 sm:grid-cols-2">
            <div>
              <label class="cs-label">Gateway URL <span class="cs-hint">(or use agent_ref below)</span></label>
              <input class="cs-input" type="text" name="gateway_url" placeholder="http://gateway.namespace.svc:port" />
            </div>
            <div>
              <label class="cs-label">Hooks token <span class="cs-hint">(required with gateway URL)</span></label>
              <input class="cs-input" type="password" name="hooks_token" autocomplete="off" />
            </div>
          </div>

          <h2 class="cs-h2 mt-6">Upstream — in-cluster agent_ref</h2>
          <label class="cs-label">Agent ref <span class="cs-hint">(namespace/name; leave gateway URL empty)</span></label>
          <input class="cs-input" type="text" name="agent_ref" placeholder="namespace/agent-name" />

          <h2 class="cs-h2 mt-6">Presentation (optional)</h2>
          <div class="grid gap-x-4 sm:grid-cols-2">
            <div>
              <label class="cs-label">Model</label>
              <input class="cs-input" type="text" name="model" />
            </div>
            <div>
              <label class="cs-label">Title</label>
              <input class="cs-input" type="text" name="title" />
            </div>
          </div>
          <label class="cs-label">Greeting</label>
          <input class="cs-input" type="text" name="greeting" />

          <div class="mt-5">
            <button class="cs-btn cs-btn-primary" type="submit">Create embed</button>
          </div>
        </form>
      </div>
{{template "foot"}}{{end}}

{{define "created"}}{{template "head"}}
      <header class="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 class="m-0 text-2xl font-bold tracking-tight">Embed created</h1>
        <div class="flex items-center gap-2">
          <a class="cs-btn" href="/admin">Back to list</a>
          {{template "toggle"}}
        </div>
      </header>
      <div class="cs-card my-4">
        <h2 class="cs-h2">Publishable key</h2>
        <p class="text-slate-500 dark:text-slate-400">Embed id <code class="cs-code">{{.ID}}</code>. Use this publishable key in the page tag — it carries no secret.</p>
        <p class="mt-2"><code class="cs-code copy cursor-pointer" data-copy="{{.PublishableKey}}" title="click to copy">{{.PublishableKey}}</code></p>
        <p class="mt-5"><a class="cs-btn cs-btn-primary" href="/admin">Done</a></p>
      </div>
{{template "foot"}}{{end}}
`
