---
name: Do not run tests
description: User does not want Claude to run tests automatically
type: feedback
---

Do not run tests (pytest, npm test, etc.) unless the user explicitly asks.

**Why:** User prefers to run tests themselves.

**How to apply:** After writing test files or changing code, do not call pytest or any test runner. Just report what was created/changed.
