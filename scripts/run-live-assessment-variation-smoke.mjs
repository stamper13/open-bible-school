import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const envPath = path.join(repoRoot, "web", ".env.local");

function readEnvFile(filePath) {
  const env = {};
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
  return env;
}

const fileEnv = readEnvFile(envPath);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? fileEnv.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? fileEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const firstQuestionRuns = Number.parseInt(process.env.LIVE_SMOKE_FIRST_RUNS ?? "6", 10);
const fullSessionQuestionCount = Number.parseInt(process.env.LIVE_SMOKE_FULL_QUESTIONS ?? "20", 10);
const runDelayMs = Number.parseInt(process.env.LIVE_SMOKE_RUN_DELAY_MS ?? "0", 10);

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

function newClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeChoices(choices) {
  return Array.isArray(choices) ? choices : [];
}

function firstWrongishChoice(choices) {
  const first = normalizeChoices(choices).find((choice) => choice?.id && choice.id !== "__IDK__");
  return first?.id ?? "__IDK__";
}

function summarize(items) {
  const byQuestion = new Map();
  const bySection = new Map();
  const byBook = new Map();
  for (const item of items) {
    byQuestion.set(item.questionId, (byQuestion.get(item.questionId) ?? 0) + 1);
    bySection.set(item.section ?? item.scope ?? "unknown", (bySection.get(item.section ?? item.scope ?? "unknown") ?? 0) + 1);
    byBook.set(item.bookCode ?? "unknown", (byBook.get(item.bookCode ?? "unknown") ?? 0) + 1);
  }
  return {
    count: items.length,
    distinctQuestions: byQuestion.size,
    repeatedQuestionCount: [...byQuestion.values()].filter((count) => count > 1).length,
    sections: Object.fromEntries([...bySection.entries()].sort()),
    topBooks: [...byBook.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
  };
}

function requireSmokePass(summary) {
  const failures = [];
  const minimumDistinctFirstQuestions = Math.min(4, Math.max(2, firstQuestionRuns - 1));
  const minimumFullSessionQuestions = Math.max(1, Math.floor(fullSessionQuestionCount * 0.9));

  for (const testament of ["OT", "NT"]) {
    const first = summary.firstQuestionSummary[testament];
    if (first.count < firstQuestionRuns) {
      failures.push(`${testament} first-question smoke served only ${first.count}/${firstQuestionRuns} attempts`);
    }
    if (first.distinctQuestions < minimumDistinctFirstQuestions) {
      failures.push(`${testament} first-question smoke had only ${first.distinctQuestions} distinct questions`);
    }
  }

  for (const [label, full] of Object.entries(summary.fullSessionSummary)) {
    if (full.count < minimumFullSessionQuestions) {
      failures.push(`${label} full-session smoke served only ${full.count}/${fullSessionQuestionCount} questions`);
    }
    if (full.repeatedQuestionCount > 0) {
      failures.push(`${label} full-session smoke repeated ${full.repeatedQuestionCount} question(s)`);
    }
  }

  if (Object.keys(summary.fullSessionSummary.OT_IDK.sections).length < 4) {
    failures.push("OT full-session smoke did not cover all four OT sections");
  }
  if (Object.keys(summary.fullSessionSummary.NT_SMOKE.sections).length < 3) {
    failures.push("NT full-session smoke covered fewer than three NT divisions");
  }

  if (failures.length > 0) {
    throw new Error(`Live assessment variation smoke failed:\n- ${failures.join("\n- ")}`);
  }
}

async function signIn(client) {
  const { data, error } = await client.auth.signInAnonymously();
  if (error) throw error;
  if (!data.user?.id) throw new Error("Anonymous sign-in returned no user");
  return data.user.id;
}

async function startOt(client, targetQuestionCount) {
  const { data, error } = await client.rpc("obs_start_or_resume_ot_assessment_v2", {
    p_unit_key: null,
    p_book_code: null,
    p_start_chapter: null,
    p_end_chapter: null,
    p_target_question_count: targetQuestionCount,
    p_force_new: true,
    p_dimension_key: null,
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row?.attempt_id) throw new Error("OT start returned no attempt_id");
  return row.attempt_id;
}

async function startNt(client, targetQuestionCount) {
  const { data, error } = await client.rpc("obs_start_nt_assessment", {
    p_section: null,
    p_book_code: null,
    p_target_question_count: targetQuestionCount,
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row?.attempt_id) throw new Error("NT start returned no attempt_id");
  return row.attempt_id;
}

async function getOtQuestion(client, attemptId) {
  const { data, error } = await client.rpc("obs_get_next_ot_assessment_question", {
    p_attempt_id: attemptId,
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row?.out_generated_question_id) return null;
  return {
    questionId: row.out_generated_question_id,
    prompt: row.prompt,
    questionType: row.question_type,
    choices: row.choices,
    bookCode: row.book_code,
    section: row.section,
  };
}

async function getNtQuestion(client, attemptId) {
  const { data, error } = await client.rpc("obs_get_next_nt_assessment_question", {
    p_attempt_id: attemptId,
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row?.out_generated_question_id) return null;
  return {
    questionId: row.out_generated_question_id,
    prompt: row.prompt,
    questionType: row.question_type,
    choices: row.choices,
    bookCode: row.book_code,
    scope: row.nt_division,
  };
}

async function submitOtIdk(client, attemptId, question) {
  const { data, error } = await client.rpc("obs_submit_ot_assessment_response_v2", {
    p_attempt_id: attemptId,
    p_generated_question_id: question.questionId,
    p_response: "__IDK__",
    p_selected_choice_text: null,
    p_displayed_choices: normalizeChoices(question.choices),
  });
  if (error) throw error;
  return data?.[0] ?? null;
}

async function submitNtChoice(client, attemptId, question) {
  const { data, error } = await client.rpc("obs_submit_nt_assessment_answer", {
    p_attempt_id: attemptId,
    p_generated_question_id: question.questionId,
    p_selected_choice_id: firstWrongishChoice(question.choices),
  });
  if (error) throw error;
  return data?.[0] ?? null;
}

async function collectFirstQuestions(testament, runs) {
  const items = [];
  for (let i = 1; i <= runs; i += 1) {
    const client = newClient();
    await signIn(client);
    const attemptId = testament === "OT"
      ? await startOt(client, 20)
      : await startNt(client, 20);
    const question = testament === "OT"
      ? await getOtQuestion(client, attemptId)
      : await getNtQuestion(client, attemptId);
    if (question) items.push({ run: i, ...question });
    await client.auth.signOut();
    if (runDelayMs > 0 && i < runs) {
      await sleep(runDelayMs);
    }
  }
  return items;
}

async function runFullSession(testament, targetQuestionCount) {
  const client = newClient();
  await signIn(client);
  const attemptId = testament === "OT"
    ? await startOt(client, targetQuestionCount)
    : await startNt(client, targetQuestionCount);
  const items = [];
  for (let i = 1; i <= targetQuestionCount; i += 1) {
    const question = testament === "OT"
      ? await getOtQuestion(client, attemptId)
      : await getNtQuestion(client, attemptId);
    if (!question) break;
    items.push({ itemNumber: i, ...question });
    const result = testament === "OT"
      ? await submitOtIdk(client, attemptId, question)
      : await submitNtChoice(client, attemptId, question);
    if (result?.target_reached) break;
  }
  await client.auth.signOut();
  return items;
}

const report = {
  generatedAt: new Date().toISOString(),
  firstQuestions: {
    OT: await collectFirstQuestions("OT", firstQuestionRuns),
    NT: await collectFirstQuestions("NT", firstQuestionRuns),
  },
  fullSessions: {
    OT_IDK: await runFullSession("OT", fullSessionQuestionCount),
    NT_SMOKE: await runFullSession("NT", fullSessionQuestionCount),
  },
};

const summary = {
  generatedAt: report.generatedAt,
  firstQuestionSummary: {
    OT: summarize(report.firstQuestions.OT),
    NT: summarize(report.firstQuestions.NT),
  },
  fullSessionSummary: {
    OT_IDK: summarize(report.fullSessions.OT_IDK),
    NT_SMOKE: summarize(report.fullSessions.NT_SMOKE),
  },
};

requireSmokePass(summary);

const reportDir = path.join(repoRoot, "supabase", "review");
fs.mkdirSync(reportDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "Z");
const reportPath = path.join(reportDir, `live_assessment_variation_smoke_${stamp}.json`);
fs.writeFileSync(reportPath, `${JSON.stringify({ summary, report }, null, 2)}\n`);

console.log(JSON.stringify(summary, null, 2));
console.log(`Wrote ${reportPath}`);
