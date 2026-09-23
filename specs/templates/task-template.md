# Task Breakdown: <Task Title>

## Status

DRAFT

## References

- RnA: `rna.md`
- Specification: `spec.md`
- Plan: `plan.md`

## Dependency Graph

```text
T001 → T002 → T003
             ↘ T004
```

## Tasks

### T001 — <Task Name>

- **Description:** _What needs to be done._
- **Files:** _Which files to create or modify._
- **Dependencies:** _Which tasks must be complete first (or "none")._
- **Expected result:** _What the system can do after this task._
- **Verification:** _How to verify this task is done._
- **Acceptance criteria:** _Testable criterion from spec._
- **Estimated complexity:** S | M | L

---

### T002 — <Task Name>

- **Description:**
- **Files:**
- **Dependencies:** T001
- **Expected result:**
- **Verification:**
- **Acceptance criteria:**
- **Estimated complexity:** S | M | L

---

### T003 — <Task Name>

- **Description:**
- **Files:**
- **Dependencies:** T002
- **Expected result:**
- **Verification:**
- **Acceptance criteria:**
- **Estimated complexity:** S | M | L

## Parallelizable Tasks

_Tasks that can run in parallel (no mutual dependencies)._

- T001 and T002 can run in parallel.

## Sequential Tasks

_Tasks that must run in order._

- T003 depends on T001.

## Test Tasks

_Tasks specifically for writing tests._

-

## Documentation Tasks

_Tasks for updating documentation._

-

## Final Verification Checklist

- [ ] All functional requirements implemented
- [ ] All acceptance criteria verified
- [ ] Tests pass
- [ ] Type checking passes (`npm run typecheck`)
- [ ] Linting passes (`npm run lint`)
- [ ] Database validation passes
- [ ] Security review passes
- [ ] Documentation updated
