# Bible Data Ingest Tools

These scripts populate and recompute data in Supabase. Several scripts delete
or replace rows before inserting their output, so treat them as operational
tools rather than ordinary application commands.

Required local environment variables:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Keep `.env`, `node_modules/`, raw input datasets, and generated output files out
of Git. Review a script's target tables and project URL before running it.
