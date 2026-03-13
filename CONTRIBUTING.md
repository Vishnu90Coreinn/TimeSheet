# Contributing

## Branch Naming
- Features: `feature/<featureNameOrID>`
- Bug fixes: `bugfix/<bugNameOrID>`

## Pull Request Checklist
1. Rebased on latest target branch.
2. Lint passes.
3. Tests pass.
4. Build passes.
5. Backward compatibility reviewed (APIs, contracts, migrations).
6. Breaking changes documented (if any) and migration notes added.

## Minimum Validation Commands
```bash
npm run lint
npm run test
npm run build
```
