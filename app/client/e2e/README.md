# VYENFITA E2E — Builder

End-to-end tests for the VYENFITA Builder UI, using [Playwright](https://playwright.dev/).

---

## Prerequisites

- Node.js 20+
- Yarn 1.22+
- Chromium (installed via `yarn install:browsers`)

---

## First-Time Setup

```bash
cd app/client/e2e
yarn install
yarn install:browsers
```

---

## Running Tests

### Against a running dev server

```bash
# In terminal 1: start the client
cd app/client
yarn start

# In terminal 2: run E2E tests
cd app/client/e2e
yarn test
```

### With auto-start server

```bash
cd app/client/e2e
E2E_AUTOSTART=true yarn test
```

### Headed mode (see browser)

```bash
yarn test:headed
```

### UI mode (Playwright's interactive mode — recommended for debugging)

```bash
yarn test:ui
```

### Single test file

```bash
yarn test tests/builder/load.spec.ts
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `E2E_BASE_URL` | `http://localhost:3000` | URL to test against |
| `E2E_AUTOSTART` | `false` | If true, Playwright starts the dev server |
| `CI` | — | Set automatically in CI; affects retries and reporters |

---

## Test Structure

```
app/client/e2e/
├── playwright.config.ts
├── package.json
├── README.md
└── tests/
    └── builder/
        ├── load.spec.ts        # Builder loads, no console errors
        ├── drag-drop.spec.ts   # Add/delete widget
        ├── properties.spec.ts  # Change props
        ├── undo-redo.spec.ts   # Ctrl+Z / Ctrl+Shift+Z
        └── templates.spec.ts   # Template picker
```

---

## Known Limitations

Many tests currently `test.skip()` if the builder uses selectors we don't
match. This is intentional — the builder needs `data-testid` attributes
added before selectors can be locked in.

### Adding data-testid attributes

To make tests reliable, add these `data-testid` attributes to the builder:

| Element | Suggested data-testid |
|---------|----------------------|
| Builder container | `builder-root` |
| Toolbar | `builder-toolbar` |
| Save button | `builder-save` |
| Preview toggle | `builder-preview` |
| Templates button | `builder-templates` |
| Code view button | `builder-code` |
| Widget palette | `builder-palette` |
| Palette item | `palette-item-{widgetType}` |
| Canvas | `builder-canvas` |
| Widget on canvas | `widget-{widgetId}` |
| Selected widget | `widget-{widgetId}-selected` |
| Properties panel | `builder-properties` |
| Page manager | `builder-pages` |

Once these are in place, replace the fallback selectors
(`getByText(...)`) with `getByTestId(...)`.

---

## CI

E2E tests run in `.github/workflows/e2e-builder.yml` on:

- Push to `vyenfita-development` (paths: `app/client/src/vyenfita/builder/**`)
- Pull requests
- Manual `workflow_dispatch`

---

## Debugging

### View last failure

```bash
yarn report
```

### Trace viewer

After a CI failure, download the trace artifact and run:

```bash
npx playwright show-trace path/to/trace.zip
```

---

## See Also

- `docs/E2E_TESTING.md`
- Playwright docs: https://playwright.dev/docs/intro
