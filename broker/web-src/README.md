# broker web styling (Tailwind, pre-built)

The broker serves its HTML pages (`/demo`, `/admin/*`) styled with Tailwind
utility classes. The broker has **no Node build step** and its Dockerfile must
stay Node-free, so the stylesheet is **pre-built and committed**, then served
via `go:embed` at `GET /assets/app.css`.

## Files

- `tailwind.config.js` — Tailwind config (`darkMode: 'class'`, `content` globs
  the templates so used classes are scanned and the rest purged).
- `app.css` — the Tailwind **input** (`@tailwind` directives + a few `@apply`
  component classes shared by the demo and admin pages).
- The **built output** is committed at `../internal/broker/web/app.css` — that
  is the file `go:embed` serves. Do not hand-edit it; regenerate instead.

## Rebuild the stylesheet

After changing any template class, config, or `app.css`, regenerate the built
CSS with the standalone Tailwind CLI (NixOS, no Node required):

```sh
nix-shell -p tailwindcss --run \
  "tailwindcss -c broker/web-src/tailwind.config.js \
     -i broker/web-src/app.css \
     -o broker/internal/broker/web/app.css --minify"
```

Run from the repo root. Commit BOTH the source here and the rebuilt
`internal/broker/web/app.css`.

Dark mode is class-based: each page sets `class="dark"` on `<html>` before
paint (tiny inline `<head>` script reading `localStorage.theme`, defaulting to
the system preference) and a header toggle flips it and persists the choice.
