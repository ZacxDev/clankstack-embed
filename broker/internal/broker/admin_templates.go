package broker

// adminTemplates holds every server-rendered admin page. They share a base
// layout via the {{define}} blocks below. Styling mirrors the demo page
// (web/demo.html): a clean, minimal inline-CSS look with light/dark support.
//
// All interpolated values flow through html/template, which contextually
// auto-escapes them — user-supplied fields (agent names, origins, greetings)
// are rendered as text, never markup. No template.HTML is used on any data.
const adminTemplates = `
{{define "head"}}<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>clankstack admin</title>
    <style>
      :root { color-scheme: light dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0; min-height: 100vh; font-family: system-ui, -apple-system, sans-serif;
        background: radial-gradient(1200px 600px at 50% -10%, #ede9fe 0%, #f8fafc 45%, #f1f5f9 100%);
        color: #0f172a;
      }
      a { color: #7c3aed; }
      main { width: 100%; max-width: 1040px; margin: 0 auto; padding: 2.5rem 1.25rem 5rem; }
      header.bar { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
      h1 { font-size: clamp(1.4rem, 3vw, 2rem); margin: 0; letter-spacing: -0.02em; }
      h2 { font-size: .95rem; text-transform: uppercase; letter-spacing: .06em; opacity: .6; margin: 0 0 .75rem; }
      .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 1.25rem 1.5rem; margin: 1rem 0; }
      code { background: #f1f5f9; padding: .15rem .4rem; border-radius: 6px; font-size: .9em; word-break: break-all; }
      table { width: 100%; border-collapse: collapse; font-size: .9rem; }
      th, td { text-align: left; padding: .6rem .5rem; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
      th { font-size: .72rem; text-transform: uppercase; letter-spacing: .05em; opacity: .55; }
      .pill { display: inline-block; padding: .12rem .55rem; border-radius: 999px; font-size: .72rem; font-weight: 600; }
      .pill.on { background: #dcfce7; color: #166534; }
      .pill.off { background: #fee2e2; color: #991b1b; }
      .muted { opacity: .6; }
      form.inline { display: inline; margin: 0; }
      button, .btn {
        font: inherit; cursor: pointer; border: 1px solid #cbd5e1; background: #fff; color: #0f172a;
        padding: .35rem .7rem; border-radius: 8px; font-size: .82rem;
      }
      button:hover { border-color: #94a3b8; }
      button.primary, .btn.primary { background: #7c3aed; border-color: #7c3aed; color: #fff; }
      button.danger { color: #b91c1c; border-color: #fca5a5; }
      label { display: block; font-size: .82rem; font-weight: 600; margin: .9rem 0 .3rem; }
      label .hint { font-weight: 400; opacity: .6; }
      input[type=text], input[type=password], input[type=number], textarea {
        width: 100%; font: inherit; padding: .5rem .6rem; border: 1px solid #cbd5e1; border-radius: 8px;
        background: #fff; color: #0f172a;
      }
      textarea { min-height: 4.5rem; resize: vertical; }
      .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 1rem; }
      .err { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: .6rem .8rem; border-radius: 10px; margin: 0 0 1rem; font-size: .9rem; }
      .flash { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; padding: .6rem .8rem; border-radius: 10px; margin: 0 0 1rem; font-size: .9rem; }
      .actions { display: flex; gap: .35rem; flex-wrap: wrap; }
      .copy { cursor: pointer; }
      @media (prefers-color-scheme: dark) {
        body { background: radial-gradient(1200px 600px at 50% -10%, #2e1065 0%, #0b1120 50%, #020617 100%); color: #e2e8f0; }
        .card { background: #0f172a; border-color: #1e293b; }
        code { background: #1e293b; }
        th, td { border-color: #1e293b; }
        button, .btn { background: #0f172a; color: #e2e8f0; border-color: #334155; }
        button.primary, .btn.primary { background: #7c3aed; border-color: #7c3aed; color: #fff; }
        input[type=text], input[type=password], input[type=number], textarea { background: #0b1120; color: #e2e8f0; border-color: #334155; }
      }
    </style>
  </head>
  <body>
    <main>
{{end}}

{{define "foot"}}
    </main>
    <script>
      document.addEventListener('click', function (ev) {
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
      <header class="bar"><h1>clankstack admin</h1></header>
      <div class="card" style="max-width: 420px;">
        <h2>Sign in</h2>
        {{if .Error}}<div class="err">{{.Error}}</div>{{end}}
        <form method="POST" action="/admin/login">
          <label>Management key <span class="hint">(sk_live_…)</span></label>
          <input type="password" name="secret_key" autocomplete="off" autofocus required />
          <div style="margin-top: 1rem;">
            <button class="primary" type="submit">Sign in</button>
          </div>
        </form>
      </div>
{{template "foot"}}{{end}}

{{define "list"}}{{template "head"}}
      <header class="bar">
        <h1>Embeds</h1>
        <div class="actions">
          <a class="btn primary" href="/admin/embeds/new">+ New embed</a>
          <form class="inline" method="POST" action="/admin/logout"><button type="submit">Sign out</button></form>
        </div>
      </header>
      {{if .Flash}}<div class="flash">{{.Flash}}</div>{{end}}
      <div class="card">
      {{if .Embeds}}
        <table>
          <thead>
            <tr>
              <th>Agent</th>
              <th>Publishable key</th>
              <th>Origins</th>
              <th>Resolution</th>
              <th>Status</th>
              <th>Daily budget</th>
              <th>Used today</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
          {{range .Embeds}}
            <tr>
              <td>{{.Agent}}<div class="muted" style="font-size:.78rem;">{{.ID}}</div></td>
              <td><code class="copy" data-copy="{{.PublishableKey}}" title="click to copy">{{.PublishableKey}}</code></td>
              <td>{{range .AllowedOrigins}}<div>{{.}}</div>{{end}}</td>
              <td>{{if .AgentRef}}agent_ref<div class="muted" style="font-size:.78rem;">{{.Embed.AgentRef}}</div>{{else}}explicit{{end}}</td>
              <td>{{if eq .Status "enabled"}}<span class="pill on">enabled</span>{{else}}<span class="pill off">{{.Status}}</span>{{end}}</td>
              <td>{{.DailyTokenBudget}}</td>
              <td>{{.UsedToday}}</td>
              <td>
                <div class="actions">
                  <form class="inline" method="POST" action="/admin/embeds/{{.ID}}/rotate-key" onsubmit="return confirm('Rotate the publishable key? The old key stops working immediately.');">
                    <button type="submit">Rotate key</button>
                  </form>
                  <form class="inline" method="POST" action="/admin/embeds/{{.ID}}/toggle">
                    <button type="submit">{{if eq .Status "enabled"}}Disable{{else}}Enable{{end}}</button>
                  </form>
                  <form class="inline" method="POST" action="/admin/embeds/{{.ID}}/delete" onsubmit="return confirm('Delete this embed permanently?');">
                    <button class="danger" type="submit">Delete</button>
                  </form>
                </div>
              </td>
            </tr>
          {{end}}
          </tbody>
        </table>
      {{else}}
        <p class="muted">No embeds yet. <a href="/admin/embeds/new">Create one</a>.</p>
      {{end}}
      </div>
{{template "foot"}}{{end}}

{{define "new"}}{{template "head"}}
      <header class="bar">
        <h1>New embed</h1>
        <a class="btn" href="/admin">Back</a>
      </header>
      <div class="card">
        {{if .Error}}<div class="err">{{.Error}}</div>{{end}}
        <form method="POST" action="/admin/embeds">
          <label>Agent <span class="hint">(display name shown to visitors)</span></label>
          <input type="text" name="agent" required />

          <label>Allowed origins <span class="hint">(comma or newline separated, exact match e.g. https://foo.com)</span></label>
          <textarea name="allowed_origins" required></textarea>

          <div class="grid2">
            <div>
              <label>Daily token budget</label>
              <input type="number" name="daily_token_budget" min="0" value="100000" />
            </div>
            <div>
              <label>Sessions / minute</label>
              <input type="number" name="sessions_per_min" min="0" value="30" />
            </div>
            <div>
              <label>Per-session message budget</label>
              <input type="number" name="per_session_msg_budget" min="0" value="20" />
            </div>
            <div>
              <label>Per-session token budget</label>
              <input type="number" name="per_session_tok_budget" min="0" value="20000" />
            </div>
          </div>

          <h2 style="margin-top:1.5rem;">Upstream — explicit gateway</h2>
          <div class="grid2">
            <div>
              <label>Gateway URL <span class="hint">(or use agent_ref below)</span></label>
              <input type="text" name="gateway_url" placeholder="http://gateway.namespace.svc:port" />
            </div>
            <div>
              <label>Hooks token <span class="hint">(required with gateway URL)</span></label>
              <input type="password" name="hooks_token" autocomplete="off" />
            </div>
          </div>

          <h2 style="margin-top:1.5rem;">Upstream — in-cluster agent_ref</h2>
          <label>Agent ref <span class="hint">(namespace/name; leave gateway URL empty)</span></label>
          <input type="text" name="agent_ref" placeholder="namespace/agent-name" />

          <h2 style="margin-top:1.5rem;">Presentation (optional)</h2>
          <div class="grid2">
            <div>
              <label>Model</label>
              <input type="text" name="model" />
            </div>
            <div>
              <label>Title</label>
              <input type="text" name="title" />
            </div>
          </div>
          <label>Greeting</label>
          <input type="text" name="greeting" />

          <div style="margin-top: 1.25rem;">
            <button class="primary" type="submit">Create embed</button>
          </div>
        </form>
      </div>
{{template "foot"}}{{end}}

{{define "created"}}{{template "head"}}
      <header class="bar">
        <h1>Embed created</h1>
        <a class="btn" href="/admin">Back to list</a>
      </header>
      <div class="card">
        <h2>Publishable key</h2>
        <p class="muted">Embed id <code>{{.ID}}</code>. Use this publishable key in the page tag — it carries no secret.</p>
        <p><code class="copy" data-copy="{{.PublishableKey}}" title="click to copy">{{.PublishableKey}}</code></p>
        <p style="margin-top:1.25rem;"><a class="btn primary" href="/admin">Done</a></p>
      </div>
{{template "foot"}}{{end}}
`
