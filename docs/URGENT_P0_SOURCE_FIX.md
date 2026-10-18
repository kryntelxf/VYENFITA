# URGENT P0 — Fix Incomplete Source Code

**Created:** 2026-10-18
**Priority:** P0 (Blocker — nothing else can proceed)
**Estimated effort:** 1–2 laptop sessions (4–8 hours)

---

## Problem Statement

VYENFITA AI Service **cannot start**. `yarn dev` exits with status 1.

**Root cause (verified via Codespaces + ts-node bypass attempts):**

1. `src/index.ts` has bugs: missing modules, missing properties, wrong arguments
2. `src/routes/index.ts` references controllers that **do not exist** in the repo
3. `ValidationMiddleware.validate()` and `.schemas` are referenced but **never implemented**

This is not a "small bug" — the source code is **incomplete**.

---

## Why This Wasn't Caught Earlier

- All ~485 unit tests pass because they **mock** their dependencies
- No integration test exercises "API can start + /health returns 200"
- Handoff claimed "Phase 0–25 complete" — but that referred to **files existing**, not **code running**

**Lesson learned:** A smoke test (API boots + /health 200) is worth more than 100 unit tests when the app doesn't run.

---

## Fix Plan (Laptop Required)

### Step 1: Identify Missing Files (15 min)

```bash
cd app/ai

# Start the dev server and capture the FIRST error
yarn dev 2>&1 | head -50 > /tmp/error-1.log

# Read /tmp/error-1.log — it will tell you exactly which import failed
```

The error will point to a missing file or an undefined property. Note it down.

### Step 2: Inventory Missing Controllers (30 min)

```bash
# See what's actually referenced
grep -r "controllers/" src/routes/ | sort -u

# See what's actually present
ls src/controllers/
```

Diff the two lists. Every referenced controller that doesn't exist = a file to create.

From the Codespaces session, at least these are missing:

- `ai.controller.ts` (or whatever createAIRouter uses)
- `generation.controller.ts`
- `multi-step.controller.ts`
- `bi.controller.ts`
- `versioning.controller.ts`
- `agent.controller.ts`
- `visualization.controller.ts`
- `export-import.controller.ts`
- `notification.controller.ts`
- `activity-log.controller.ts`
- `nl-to-sql.controller.ts`
- `scheduled-report.controller.ts`
- `code-generator.controller.ts`
- `plugin.controller.ts`
- `marketplace.controller.ts`

### Step 3: Create ValidationMiddleware (30 min)

Create `src/middleware/validation.middleware.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

export class ValidationMiddleware {
  static validate(schema: ZodSchema) {
    return (req: Request, res: Response, next: NextFunction) => {
      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: result.error.errors,
        });
      }
      req.body = result.data;
      next();
    };
  }

  static schemas = {
    chat: z.object({
      messages: z
        .array(
          z.object({
            role: z.enum(['system', 'user', 'assistant']),
            content: z.string(),
          })
        )
        .min(1),
    }),
    generateApplication: z.object({
      description: z.string().min(10).max(5000),
      context: z.record(z.any()).optional(),
    }),
    generateWorkflow: z.object({
      description: z.string().min(10).max(5000),
    }),
    switchProvider: z.object({
      provider: z.enum(['openai', 'anthropic']),
    }),
  };
}
```

(Adjust based on actual Zod usage — `import z` at top.)

### Step 4: Create Controllers (2–4 hours)

For each missing controller, create a minimal but working implementation.

**DO NOT** create silent mocks or stubs that return `{ success: true, data: {} }`. That hides failures.

**DO** create controllers that:

- Have correct method signatures (matching what routes call)
- Return **501 Not Implemented** for methods not yet wired to service
- Log a TODO warning

Example pattern:

```typescript
// src/controllers/ai.controller.ts
import { Request, Response } from 'express';

export class AIController {
  async healthCheck(_req: Request, res: Response) {
    res.json({ success: true, status: 'ok' });
  }

  async chat(_req: Request, res: Response) {
    // TODO: wire to AIService.chat()
    res.status(501).json({ success: false, error: 'Chat endpoint not yet wired' });
  }

  async generateWorkflow(_req: Request, res: Response) {
    res.status(501).json({ success: false, error: 'Workflow generation not yet wired' });
  }
}
```

Then in a follow-up session, wire each 501 endpoint to its actual service.

### Step 5: Create Missing Route Files (1–2 hours)

Same as Step 4: create minimal working routes, or extract from `src/routes/index.ts` if it's a monolith.

### Step 6: Verify API Boots

```bash
cd app/ai
yarn dev

# In another terminal
curl -sf http://localhost:3001/health
# Expected: {"status":"ok",...}
```

### Step 7: Run k6 Smoke Test (Final verification)

```bash
cd app/ai/load-tests
BASE_URL=http://localhost:3001 k6 run scenarios/smoke.js
```

If this passes → **P2.7 is finally VERIFIED**.

---

## Rules During Fix

1. **Inspect first** — read error, don't guess
2. **One file at a time** — create → verify import → next
3. **No silent mocks** — if not implemented, return 501
4. **Commit per logical group** — controllers in one commit, routes in another
5. **Update handoff** after each milestone

---

## Definition of Done for P0 Fix

- [ ] `yarn dev` starts without error
- [ ] `curl http://localhost:3001/health` returns 200
- [ ] `curl http://localhost:3001/metrics` returns Prometheus text
- [ ] At least one real endpoint (e.g., `/api/v1/auth/register`) works end-to-end
- [ ] k6 smoke test passes against VYENFITA
- [ ] CI still green (unit tests)
- [ ] Handoff updated

---

## What NOT to Do

- ❌ Do not "hide" missing files with silent stubs
- ❌ Do not claim "API works" without `curl /health` returning 200
- ❌ Do not proceed to P2.8/P3 until this is done
- ❌ Do not re-run the failed Codespaces bypass attempts — they won't help

---

## See Also

- `docs/HANDOVER_UPDATE_2026-10-11.md`
- `docs/P2_ROADMAP.md`
