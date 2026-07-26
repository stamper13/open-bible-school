# Supabase Change Layout

Only forward, production-safe schema migrations belong in `migrations/`.
Supabase applies every SQL file in that directory when migrations are pushed.

- `migrations/`: forward schema and function changes
- `rollback/`: explicitly invoked operational rollback scripts
- `verify/`: read-only or transaction-rolled-back verification scripts
- `manual/`: one-time data recomputations that intentionally persist changes
- `diagnostics/`: read-only investigation queries

## Applying a change

1. Apply the matching file from `migrations/` in timestamp order.
2. Run its companion script from `verify/`.
3. Keep the rollback file available, but do not run it during normal deployment.
4. Record the applied migration in the deployment notes.

The current repository contains additive migrations for the existing project.
A schema-only dump of the live Supabase project is still needed before a fresh,
empty project can be recreated solely from this repository.
