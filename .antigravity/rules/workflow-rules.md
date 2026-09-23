# Workflow Rules: Rules → RnA → spec.md → plan.md + task.md → Approval → Implementation

For every new task in this project:

## 1. RULES FIRST

- Read `.antigravity/rules/workflow-rules.md`.
- Read other applicable rules in `.antigravity/rules/`.
- Confirm which rules apply to the task.

## 2. RnA (RESEARCH & ANALYSIS)

- Inspect relevant files, routes, components, services, schema, tests, and docs.
- Identify unknowns, risks, constraints, and integration points.
- Create or update:
  `specs/<task-slug>/rna.md`
- Use the RnA template in `specs/templates/rna-template.md`.
- STOP and ask the user:
  "Is this RnA correct and complete? What should change?"

## 3. spec.md (SPECIFICATION)

- After RnA approval, create or update:
  `specs/<task-slug>/spec.md`
- Use the spec template in `specs/templates/spec-template.md`.
- STOP and ask:
  "Is this spec.md correct and complete for this task?"

## 4. plan.md + task.md (DESIGN & TASKS)

- After spec.md approval, create or update:
  `specs/<task-slug>/plan.md`
  `specs/<task-slug>/task.md`
- Use the templates in `specs/templates/plan-template.md` and `task-template.md`.
- Ensure both align with `spec.md` and all project rules.
- STOP and ask:
  "Are plan.md and task.md acceptable for implementation and future reuse?"

## 5. IMPLEMENTATION

- Implement only after explicit approval of:
  - RnA
  - spec.md
  - plan.md
  - task.md
- Follow `plan.md` and `task.md` strictly.
- Produce small, reviewable diffs.
- Update task status as work progresses.

## 6. VERIFICATION

- Before declaring a task complete, run applicable verification commands:
  - Type check
  - Lint
  - Tests
  - Database validation
  - Build
- Fix all errors before finishing.

## MANDATORY ARTIFACTS

For every task, the following files are mandatory and must exist under
`specs/<task-slug>/`:

- rna.md
- spec.md
- plan.md
- task.md

Never skip, rename, or replace these filenames.
Never implement code before all four are approved.
