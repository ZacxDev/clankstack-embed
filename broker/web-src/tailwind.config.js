/**
 * Tailwind config for the clankstack broker's server-rendered pages.
 *
 * The broker has NO Node build step and its Dockerfile must stay Node-free, so
 * the stylesheet is pre-built with the standalone Tailwind CLI and the minified
 * output is committed to git and served via go:embed. See web-src/README.md for
 * the exact rebuild command.
 *
 * `content` globs every source that can emit a utility class so the JIT pass
 * keeps the right classes and purges the rest. NOTE: Tailwind resolves these
 * paths relative to the CURRENT WORKING DIRECTORY of the CLI, which the rebuild
 * command (web-src/README.md) runs from the repo root — so they are written
 * relative to the repo root, not to this file.
 */
module.exports = {
  // Class-based dark mode: toggled by adding/removing `class="dark"` on <html>.
  // (Not `media` — we want an explicit, persisted user choice via localStorage.)
  darkMode: 'class',
  content: [
    'broker/internal/broker/web/demo.html',
    'broker/internal/broker/admin_templates.go',
  ],
  theme: {
    extend: {
      colors: {
        // The clankstack purple accent, exposed as a Tailwind color so we can
        // use bg-accent / text-accent / ring-accent etc.
        accent: {
          DEFAULT: '#7c3aed',
          fg: '#ffffff',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
