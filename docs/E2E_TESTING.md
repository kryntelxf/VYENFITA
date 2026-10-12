# E2E Testing with Playwright

VYENFITA uses [Playwright](https://playwright.dev/) for end-to-end testing of the frontend.

Currently, E2E tests cover the **VYENFITA Builder** (`app/client/src/vyenfita/builder/`).

---

## Quick Start

```bash
# In terminal 1: start client
cd app/client && yarn start

# In terminal 2: run E2E
cd app/client/e2e
yarn install
yarn install:browsers
yarn test
```

---

## CI Integration

E2E tests run automatically on:

- Push to `vyenfita-development` that touches `app/client/src/vyenfita/builder/**`
- Pull requests against `vyenfita-development`

Workflow: `.github/workflows/e2e-builder.yml`

---

## Test Coverage

| Test Suite | Focus | Status |
|-----------|-------|--------|
| `load.spec.ts` | Builder loads cleanly | ✅ Active |
| `drag-drop.spec.ts` | Add/select/delete widget | 🟡 Needs data-testid |
| `properties.spec.ts` | Change widget props | 🟡 Needs data-testid |
| `undo-redo.spec.ts` | Ctrl+Z / Ctrl+Shift+Z | 🟡 Needs data-testid |
| `templates.spec.ts` | Template picker | ✅ Active |

Tests marked "🟡" use text-based fallback selectors and may `test.skip()`
if the exact label isn't found. Once the builder has `data-testid`
attributes (see `app/client/e2e/README.md`), the selectors should be
tightened.

---

## Debugging Tips

1. **Run headed**: `yarn test:headed`
2. **UI mode**: `yarn test:ui` (interactive debugger, recommended)
3. **Trace viewer**: after CI failure, `npx playwright show-trace <trace.zip>`
4. **Screenshots**: auto-saved on failure in `test-results/`

---

## Adding a New Test

1. Create `tests/<feature>/<name>.spec.ts`
2. Import `test, expect` from `@playwright/test`
3. Add `data-testid` to the target UI element (if not present)
4. Write the test using `page.getByTestId(...)`
5. Run locally with `yarn test tests/<feature>/<name>.spec.ts`
6. Commit — CI will pick it up automatically

---

## Roadmap

- [ ] Add `data-testid` attributes to all builder components
- [ ] Replace text-based selectors with `getByTestId`
- [ ] Add multi-page E2E flow (create app → save → reload → verify)
- [ ] Add Code View round-trip test (edit JSON → apply → canvas updates)
- [ ] Add collaboration feature test (comments, presence)

---

## See Also

- `app/client/e2e/README.md`
- Playwright docs: https://playwright.dev/
