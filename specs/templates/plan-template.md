# Implementation Plan: <Task Title>

## Status

DRAFT

## References

- RnA: `rna.md`
- Specification: `spec.md`

## Design Summary

_One paragraph summary of the technical approach._

## Architecture

_How does this fit into the existing architecture? Diagram if helpful._

```text
[Client] → [API Route] → [Service Layer] → [Prisma] → [PostgreSQL]
```

## Components and Modules

_List all new/modified components, services, and modules._

| File | New/Modified | Purpose |
|------|-------------|---------|
| | | |

## Data Model Changes

_Schema changes, new tables, new fields, new indexes._

```prisma
// Example new model or field
```

## API and Server Actions

_New/modified API routes and their request/response shapes._

### `METHOD /api/path`

**Request:**
```json
{}
```

**Response:**
```json
{}
```

**Errors:**
| Status | Condition |
|--------|----------|
| 400 | Validation error |
| 401 | Not authenticated |
| 404 | Not found |

## Validation Strategy

_What is validated where (client vs server), with what schemas._

## Authentication and Authorization

_Which routes/components require auth? How is it enforced?_

## Error Handling

_How are errors handled at each layer?_

## Storage and External Integrations

_Any file storage or external service interactions._

## Technical Design Patterns

_Design patterns used (e.g. repository pattern, optimistic updates, etc.)._

## Migration Strategy

_Database migration approach: new migration file, seed changes, etc._

## Implementation Sequence

### Phase 1 — Foundation

_Schema, migrations, service functions._

### Phase 2 — API Layer

_API routes, validation._

### Phase 3 — UI Layer

_Components, pages, client-side logic._

## Testing Strategy

### Unit Tests

_Functions and utilities to unit test._

### Integration Tests

_API routes to integration test._

### End-to-End Tests

_User flows to end-to-end test._

## Verification Commands

```bash
# Type check
npm run typecheck

# Lint
npm run lint

# Tests
npm test

# Build
npm run build

# DB: generate
npm run prisma:generate

# DB: migrate
npm run prisma:migrate
```

## Rollback Strategy

_How to revert if implementation fails._

## Performance Considerations

_Query optimization, pagination, caching, etc._

## Security Review Checklist

- [ ] Input validated server-side
- [ ] Auth enforced on all protected endpoints
- [ ] No secrets exposed to client
- [ ] No internal error details leaked
- [ ] Audit events recorded
- [ ] File paths sanitized (if applicable)

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| | |

## Definition of Done

- [ ] All functional requirements implemented
- [ ] All acceptance criteria verified
- [ ] Type checking passes
- [ ] Linting passes
- [ ] Tests pass
- [ ] Database validation passes
- [ ] Security checklist complete
- [ ] Documentation updated
