#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoots = ["web/app", "web/lib", "web/components"];
const verifyPath = path.join(repoRoot, "supabase/verify/frontend_direct_relation_contract_verify.sql");
const reviewPath = path.join(repoRoot, "supabase/review/frontend_direct_data_access.generated.md");
const sourceExtensions = new Set([".js", ".jsx", ".ts", ".tsx"]);
const ignoredDirectories = new Set([".next", "node_modules"]);
const writeMode = process.argv.includes("--write");

const allowedDynamicAccess = new Map([
  [
    "web/app/api/account/delete/route.ts::table",
    {
      context: "Account deletion public fallback; private-schema cleanup requires obs_delete_account_owned_data.",
      expectedSource: "ACCOUNT_DELETION_FALLBACK_TABLES",
      expectedRelations: [
        "obs_router_shadow_log",
        // Reviewed: carries user_id but has no foreign key to auth.users, so
        // nothing cascades it away and it must be cleared explicitly.
        "obs_reading_log_entries",
        "assessment_answers",
        "assessment_attempts",
      ],
    },
  ],
]);

const fail = (message) => {
  console.error(`ERROR: ${message}`);
  process.exit(1);
};

const listSourceFiles = (directory) => {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...listSourceFiles(path.join(directory, entry.name)));
      }
      continue;
    }

    if (entry.isFile() && sourceExtensions.has(path.extname(entry.name))) {
      files.push(path.join(directory, entry.name));
    }
  }

  return files;
};

const escapeSqlLiteral = (value) => value.replaceAll("'", "''");

const lineNumberAt = (source, index) => source.slice(0, index).split("\n").length;

const operationAfter = (source, endIndex) => {
  const tail = source.slice(endIndex, endIndex + 280);
  const match = tail.match(/\.(select|insert|delete|update|upsert)\s*\(/);
  return match?.[1] ?? "unknown";
};

const parseConstStringArrays = (source) => {
  const arrays = new Map();
  const arrayPattern = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*\[([\s\S]*?)\]\s*(?:as\s+const\s*)?;/g;

  for (const match of source.matchAll(arrayPattern)) {
    const strings = [...match[2].matchAll(/["']([A-Za-z0-9_]+)["']/g)].map((stringMatch) => stringMatch[1]);
    if (strings.length > 0) {
      arrays.set(match[1], strings);
    }
  }

  return arrays;
};

const parseForOfSources = (source) => {
  const loopSources = new Map();
  const loopPattern = /\bfor\s*\(\s*const\s+([A-Za-z_$][\w$]*)\s+of\s+([A-Za-z_$][\w$]*)\s*\)/g;

  for (const match of source.matchAll(loopPattern)) {
    loopSources.set(match[1], match[2]);
  }

  return loopSources;
};

const resolveImportPath = (fromFile, importSource) => {
  if (importSource.startsWith("@/")) {
    return path.join(repoRoot, "web", importSource.slice(2));
  }

  if (importSource.startsWith(".")) {
    return path.resolve(path.dirname(fromFile), importSource);
  }

  return null;
};

const resolveImportedConstArray = (source, fromFile, name) => {
  const importPattern = new RegExp(`import\\s*\\{[\\s\\S]*?\\b${name}\\b[\\s\\S]*?\\}\\s*from\\s*["']([^"']+)["']`, "m");
  const importMatch = source.match(importPattern);
  if (!importMatch) {
    return [];
  }

  const basePath = resolveImportPath(fromFile, importMatch[1]);
  if (!basePath) {
    return [];
  }

  const candidatePaths = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
  ];
  const importedPath = candidatePaths.find((candidate) => fs.existsSync(candidate));
  if (!importedPath) {
    return [];
  }

  const importedSource = fs.readFileSync(importedPath, "utf8");
  return parseConstStringArrays(importedSource).get(name) ?? [];
};

const isArrayFrom = (source, dotIndex) => source.slice(Math.max(0, dotIndex - 5), dotIndex) === "Array";

const literalAccess = [];
const dynamicAccess = [];

for (const sourceRoot of sourceRoots) {
  const absoluteRoot = path.join(repoRoot, sourceRoot);
  if (!fs.existsSync(absoluteRoot)) {
    continue;
  }

  for (const file of listSourceFiles(absoluteRoot)) {
    const source = fs.readFileSync(file, "utf8");
    const relativeFile = path.relative(repoRoot, file);
    const constArrays = parseConstStringArrays(source);
    const loopSources = parseForOfSources(source);
    const fromPattern = /\.from\s*\(\s*([^)]+?)\s*\)/g;

    for (const match of source.matchAll(fromPattern)) {
      if (isArrayFrom(source, match.index)) {
        continue;
      }

      const argument = match[1].trim();
      const line = lineNumberAt(source, match.index);
      const operation = operationAfter(source, match.index + match[0].length);
      const literalMatch = argument.match(/^["']([A-Za-z0-9_]+)["']$/);

      if (literalMatch) {
        literalAccess.push({
          relation: literalMatch[1],
          file: relativeFile,
          line,
          operation,
        });
        continue;
      }

      const identifierMatch = argument.match(/^([A-Za-z_$][\w$]*)$/);
      const expression = identifierMatch?.[1] ?? argument;
      const sourceArray = identifierMatch ? loopSources.get(expression) : undefined;
      const inferredRelations = sourceArray
        ? constArrays.get(sourceArray) ?? resolveImportedConstArray(source, file, sourceArray)
        : [];

      dynamicAccess.push({
        expression,
        file: relativeFile,
        line,
        operation,
        sourceArray: sourceArray ?? "",
        inferredRelations,
      });
    }
  }
}

const sortedRelations = [...new Set(literalAccess.map((access) => access.relation))].sort();

if (sortedRelations.length === 0 && dynamicAccess.length === 0) {
  fail("no frontend direct Supabase .from() calls were found; check sourceRoots or parser pattern.");
}

const failures = [];

for (const access of dynamicAccess) {
  const key = `${access.file}::${access.expression}`;
  const allow = allowedDynamicAccess.get(key);
  if (!allow) {
    failures.push(`Unreviewed dynamic .from(${access.expression}) at ${access.file}:${access.line}`);
    continue;
  }

  if (allow.expectedSource !== access.sourceArray) {
    failures.push(
      `Dynamic .from(${access.expression}) at ${access.file}:${access.line} is sourced from ${access.sourceArray || "unknown"}, expected ${allow.expectedSource}.`,
    );
  }

  const expected = [...allow.expectedRelations].sort();
  const actual = [...access.inferredRelations].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(
      `Dynamic .from(${access.expression}) at ${access.file}:${access.line} changed relation names; update allowedDynamicAccess after review.`,
    );
  }
}

if (failures.length > 0) {
  console.error("Frontend direct data access check failed:");
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

const literalByRelation = new Map();
for (const access of literalAccess) {
  const group = literalByRelation.get(access.relation) ?? [];
  group.push(access);
  literalByRelation.set(access.relation, group);
}

const sqlValues = sortedRelations
  .map((name) => `      ('${escapeSqlLiteral(name)}')`)
  .join(",\n");

const generatedSql = `-- Generated by scripts/check-frontend-direct-data-access.mjs --write.
-- Verifies that every string-literal relation called through .from("...")
-- by web/app, web/lib, and web/components exists in the public schema.
-- Dynamic .from(...) sites are documented in supabase/review/frontend_direct_data_access.generated.md
-- and intentionally reviewed separately.

do $$
declare
  v_missing jsonb;
begin
  with frontend_relation(name) as (
    values
${sqlValues}
  ), live_public_relation as (
    select distinct c.relname as name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm', 'f')
  )
  select coalesce(jsonb_agg(f.name order by f.name), '[]'::jsonb)
  into v_missing
  from frontend_relation f
  left join live_public_relation live using (name)
  where live.name is null;

  if jsonb_array_length(v_missing) > 0 then
    raise exception 'FAIL: frontend direct relation contract missing relations: %', v_missing;
  end if;
end;
$$;
`;

const formatCallers = (accesses) =>
  accesses
    .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.operation.localeCompare(b.operation))
    .map((access) => `${access.file}:${access.line} (${access.operation})`)
    .join("<br>");

const literalRows = [...literalByRelation.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([relation, accesses]) => `| \`${relation}\` | ${formatCallers(accesses)} |`)
  .join("\n");

const dynamicRows = dynamicAccess
  .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
  .map((access) => {
    const key = `${access.file}::${access.expression}`;
    const allow = allowedDynamicAccess.get(key);
    const inferred = access.inferredRelations.length > 0
      ? access.inferredRelations.map((name) => `\`${name}\``).join(", ")
      : "_not inferred_";

    return `| \`${access.file}:${access.line}\` | \`${access.expression}\` | \`${access.operation}\` | \`${access.sourceArray || "unknown"}\` | ${inferred} | ${allow?.context ?? "_unreviewed_"} |`;
  })
  .join("\n");

const generatedReview = `# Frontend Direct Data Access

Generated by \`scripts/check-frontend-direct-data-access.mjs --write\`.

This inventory tracks direct Supabase Data API access from \`web/app\`, \`web/lib\`, and \`web/components\`.
String-literal \`.from("...")\` relation names are also emitted into
\`supabase/verify/frontend_direct_relation_contract_verify.sql\` so a database target can prove those relations still exist.

Dynamic \`.from(...)\` sites are intentionally not included in the SQL existence verifier because they can include
historical or optional cleanup names. They are allowlisted here so new dynamic access cannot appear silently.

## String-Literal Relation Calls

| Relation | Caller(s) |
|---|---|
${literalRows}

## Dynamic Relation Calls

| Caller | Expression | Operation | Inferred source | Inferred relation names | Review note |
|---|---|---|---|---|---|
${dynamicRows || "| _none_ | _none_ | _none_ | _none_ | _none_ | _none_ |"}
`;

if (writeMode) {
  fs.mkdirSync(path.dirname(reviewPath), { recursive: true });
  fs.writeFileSync(verifyPath, generatedSql);
  fs.writeFileSync(reviewPath, generatedReview);
  console.log(
    `Wrote ${path.relative(repoRoot, verifyPath)} with ${sortedRelations.length} relation names.`,
  );
  console.log(
    `Wrote ${path.relative(repoRoot, reviewPath)} with ${dynamicAccess.length} dynamic .from() site(s).`,
  );
  process.exit(0);
}

const currentSql = fs.existsSync(verifyPath)
  ? fs.readFileSync(verifyPath, "utf8")
  : "";
const currentReview = fs.existsSync(reviewPath)
  ? fs.readFileSync(reviewPath, "utf8")
  : "";

if (currentSql !== generatedSql || currentReview !== generatedReview) {
  if (currentSql !== generatedSql) {
    console.error(`${path.relative(repoRoot, verifyPath)} is out of date.`);
  }
  if (currentReview !== generatedReview) {
    console.error(`${path.relative(repoRoot, reviewPath)} is out of date.`);
  }
  console.error("Run: node scripts/check-frontend-direct-data-access.mjs --write");
  process.exit(1);
}

console.log(
  `PASS: frontend direct relation contract lists ${sortedRelations.length} relation names and ${dynamicAccess.length} reviewed dynamic .from() site(s).`,
);
