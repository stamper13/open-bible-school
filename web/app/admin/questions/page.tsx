"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { authCallbackUrl } from "@/lib/auth/redirect";
import { BIBLE_BOOK_CODES } from "@/lib/bibleTaxonomy";
import { ADMIN_QUESTIONS_STYLES_1 } from "./adminQuestionsStyles";
import {
  REVIEW_STATUSES,
  DIMENSIONS,
  EMPTY_AUDIT,
  normalizeQualityItem,
  formatUnknown,
  QuestionBankAudit,
  ConsoleState,
  type RawRow,
  type ReviewStatus,
  type QualityItem,
  type AuditData,
} from "./adminQuestionsParts";


export default function QuestionQualityPage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [reviewer, setReviewer] = useState("");
  const [items, setItems] = useState<QualityItem[]>([]);
  const [coverageRows, setCoverageRows] = useState<RawRow[]>([]);
  const [auditData, setAuditData] = useState<AuditData>(EMPTY_AUDIT);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditLoaded, setAuditLoaded] = useState(false);
  const [activeView, setActiveView] = useState<"queue" | "coverage" | "audit">("queue");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [bookFilter, setBookFilter] = useState("");
  const [dimensionFilter, setDimensionFilter] = useState("");
  const [needsAttention, setNeedsAttention] = useState(true);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>("pending");
  const [reviewNotes, setReviewNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const selectedItem = items.find(item => item.id === selectedId) ?? null;
  const coverageColumns = useMemo(() => {
    const first = coverageRows[0];
    if (!first) return [];
    const preferred = [
      "testament", "section", "book_code", "dimension_key", "active_questions",
      "question_count", "metadata_complete_count", "needs_attention_count",
    ];
    const available = Object.keys(first);
    const ordered = preferred.filter(key => available.includes(key));
    return [...ordered, ...available.filter(key => !ordered.includes(key))].slice(0, 8);
  }, [coverageRows]);

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => {
      setAccessToken(data.session?.access_token ?? null);
      setAuthChecked(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccessToken(session?.access_token ?? null);
      setAuthChecked(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadQualityData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setLoadError("");
    const params = new URLSearchParams({
      status: statusFilter,
      book: bookFilter,
      dimension: dimensionFilter,
      needs_attention: String(needsAttention),
      limit: "50",
      offset: String(offset),
    });
    try {
      const response = await fetch(`/api/admin/question-quality?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const body = await response.json() as {
        error?: string;
        reviewer?: string;
        queue?: RawRow[];
        coverage?: RawRow[];
      };
      if (!response.ok) throw new Error(body.error || "Question quality data could not be loaded.");
      const nextItems = (body.queue ?? []).map(normalizeQualityItem);
      setReviewer(body.reviewer ?? "");
      setItems(nextItems);
      setCoverageRows(body.coverage ?? []);
      setSelectedId(current => current && nextItems.some(item => item.id === current)
        ? current
        : nextItems[0]?.id ?? null);
    } catch (error) {
      setItems([]);
      setCoverageRows([]);
      setSelectedId(null);
      setLoadError(error instanceof Error ? error.message : "Question quality data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, bookFilter, dimensionFilter, needsAttention, offset, statusFilter]);

  useEffect(() => {
    void loadQualityData();
  }, [loadQualityData]);

  const loadAuditData = useCallback(async () => {
    if (!accessToken || auditLoading) return;
    setAuditLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/admin/question-quality?mode=audit", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const body = await response.json() as {
        error?: string;
        reviewer?: string;
        audit?: Partial<AuditData>;
      };
      if (!response.ok) throw new Error(body.error || "Question-bank audit data could not be loaded.");
      setReviewer(body.reviewer ?? "");
      setAuditData({
        summary: body.audit?.summary ?? [],
        readiness: body.audit?.readiness ?? [],
        metadata: body.audit?.metadata ?? [],
        coverage: body.audit?.coverage ?? [],
        repetition: body.audit?.repetition ?? [],
        difficulty: body.audit?.difficulty ?? [],
        distractors: body.audit?.distractors ?? [],
        malformed: body.audit?.malformed ?? [],
      });
      setAuditLoaded(true);
    } catch (error) {
      setAuditData(EMPTY_AUDIT);
      setAuditLoaded(true);
      setLoadError(error instanceof Error ? error.message : "Question-bank audit data could not be loaded.");
    } finally {
      setAuditLoading(false);
    }
  }, [accessToken, auditLoading]);

  useEffect(() => {
    if (activeView === "audit" && !auditLoaded && !auditLoading) {
      void loadAuditData();
    }
  }, [activeView, auditLoaded, auditLoading, loadAuditData]);

  useEffect(() => {
    if (!selectedItem) return;
    setReviewStatus(selectedItem.reviewStatus);
    setReviewNotes(selectedItem.reviewNotes);
    setSaveMessage("");
  }, [selectedItem]);

  const signIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: authCallbackUrl({ next: "/admin/questions" }),
      },
    });
  };

  const submitReview = async (nextStatus: ReviewStatus) => {
    if (!selectedItem || !accessToken) return;
    const confirmQuarantine = nextStatus === "quarantined"
      ? window.confirm("Quarantine this question? It will be removed from active assessment serving.")
      : false;
    if (nextStatus === "quarantined" && !confirmQuarantine) return;

    setSaving(true);
    setSaveMessage("");
    try {
      const response = await fetch("/api/admin/question-quality", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          generatedQuestionId: selectedItem.id,
          reviewStatus: nextStatus,
          reviewNotes,
          confirmQuarantine,
        }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "The review action failed.");
      setReviewStatus(nextStatus);
      setSaveMessage(nextStatus === "quarantined" ? "Question quarantined." : "Review saved.");
      await loadQualityData();
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "The review action failed.");
    } finally {
      setSaving(false);
    }
  };

  if (!authChecked) {
    return <ConsoleState title="Checking admin access" copy="Verifying the current session." />;
  }
  if (!accessToken) {
    return (
      <ConsoleState
        title="Internal question review"
        copy="Sign in with an allowlisted administrator account to continue."
        action={<button className="state-action" type="button" onClick={signIn}>Sign in</button>}
      />
    );
  }

  return (
    <div className="admin-shell">
      <style>{ADMIN_QUESTIONS_STYLES_1}</style>

      <header className="admin-nav">
        <div className="admin-brand">Open Bible Assessment · Quality Console</div>
        <div className="admin-nav-meta">
          <span>{reviewer || "Authorized reviewer"}</span>
          <Link href="/">Dashboard</Link>
        </div>
      </header>

      <main className="admin-main">
        <div className="admin-head">
          <div>
            <p className="admin-kicker">Internal tools</p>
            <h1 className="admin-title">Question quality</h1>
            <p className="admin-sub">Review statistical signals, user reports, metadata, and serving status.</p>
          </div>
          <div className="view-tabs" role="tablist" aria-label="Quality console views">
            <button type="button" role="tab" aria-selected={activeView === "queue"} className={`view-tab ${activeView === "queue" ? "is-active" : ""}`} onClick={() => setActiveView("queue")}>Review queue</button>
            <button type="button" role="tab" aria-selected={activeView === "coverage"} className={`view-tab ${activeView === "coverage" ? "is-active" : ""}`} onClick={() => setActiveView("coverage")}>Coverage</button>
            <button type="button" role="tab" aria-selected={activeView === "audit"} className={`view-tab ${activeView === "audit" ? "is-active" : ""}`} onClick={() => setActiveView("audit")}>Bank audit</button>
          </div>
        </div>

        {loadError ? (
          <div className="queue-state">
            <div>
              <strong>Console unavailable</strong>
              {loadError}
            </div>
          </div>
        ) : activeView === "audit" ? (
          <QuestionBankAudit audit={auditData} loading={auditLoading} />
        ) : activeView === "coverage" ? (
          <section className="coverage-pane" aria-labelledby="coverage-heading">
            <p className="coverage-note" id="coverage-heading">Server-side coverage data across the active question bank.</p>
            {loading ? (
              <div className="queue-state">Loading coverage...</div>
            ) : coverageRows.length === 0 ? (
              <div className="queue-state">No coverage rows were returned.</div>
            ) : (
              <table className="coverage-table">
                <thead>
                  <tr>{coverageColumns.map(column => <th key={column}>{column.replaceAll("_", " ")}</th>)}</tr>
                </thead>
                <tbody>
                  {coverageRows.map((row, index) => (
                    <tr key={`${formatUnknown(row.book_code ?? row.section ?? "coverage")}:${index}`}>
                      {coverageColumns.map(column => <td key={column}>{formatUnknown(row[column])}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ) : (
          <>
            <section className="toolbar" aria-label="Question quality filters">
              <div className="field">
                <label htmlFor="status-filter">Review status</label>
                <select id="status-filter" value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setOffset(0); }}>
                  <option value="all">All statuses</option>
                  {REVIEW_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="book-filter">Book</label>
                <select id="book-filter" value={bookFilter} onChange={event => { setBookFilter(event.target.value); setOffset(0); }}>
                  <option value="">All books</option>
                  {BIBLE_BOOK_CODES.map(code => <option key={code} value={code}>{code}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="dimension-filter">Dimension</label>
                <select id="dimension-filter" value={dimensionFilter} onChange={event => { setDimensionFilter(event.target.value); setOffset(0); }}>
                  <option value="">All dimensions</option>
                  {DIMENSIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </div>
              <label className="attention-toggle">
                <input type="checkbox" checked={needsAttention} onChange={event => { setNeedsAttention(event.target.checked); setOffset(0); }} />
                Needs attention only
              </label>
              <div className="attention-mark">{items.length} shown</div>
            </section>

            <section className="workspace" aria-label="Question review workspace">
              <div className="queue-pane">
                {loading ? (
                  <div className="queue-state"><div><strong>Loading review queue</strong>Gathering question quality signals.</div></div>
                ) : items.length === 0 ? (
                  <div className="queue-state"><div><strong>Queue is clear</strong>No questions match the current filters.</div></div>
                ) : (
                  <table className="queue-table">
                    <thead>
                      <tr>
                        <th>Question</th><th>Book</th><th>Dimension</th><th>Responses</th>
                        <th>Correct</th><th>IDK</th><th>Reports</th><th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(item => (
                        <tr key={item.id} className={selectedId === item.id ? "is-selected" : ""}>
                          <td>
                            <button type="button" className="question-select" onClick={() => setSelectedId(item.id)}>
                              <span className="question-prompt">{item.prompt || "Prompt unavailable"}</span>
                              <span className="question-id">{item.id}</span>
                            </button>
                          </td>
                          <td className="queue-code">{item.bookCode || "--"}</td>
                          <td className="queue-dimension">{item.dimensionKey || "--"}</td>
                          <td>{item.responseCount}</td>
                          <td>{item.percentCorrect === null ? "--" : `${Math.round(item.percentCorrect)}%`}</td>
                          <td>{item.idkCount}</td>
                          <td className={item.reportCount > 0 ? "attention-mark" : ""}>{item.reportCount}</td>
                          <td><span className={`status-pill ${item.reviewStatus}`}>{item.reviewStatus}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div className="pager">
                  <button type="button" disabled={offset === 0 || loading} onClick={() => setOffset(value => Math.max(0, value - 50))}>Previous</button>
                  <span>Rows {items.length ? offset + 1 : 0}-{offset + items.length}</span>
                  <button type="button" disabled={items.length < 50 || loading} onClick={() => setOffset(value => value + 50)}>Next</button>
                </div>
              </div>

              <aside className="review-panel" aria-label="Selected question review">
                {!selectedItem ? (
                  <div className="review-empty">Select a question to review its evidence and status.</div>
                ) : (
                  <>
                    <p className="review-kicker">{selectedItem.needsAttention ? "Needs attention" : "Question review"}</p>
                    <h2 className="review-title">{selectedItem.prompt || "Prompt unavailable"}</h2>
                    <p className="review-id">{selectedItem.id}</p>
                    <div className="review-meta">
                      <div><span>Book</span><strong>{selectedItem.bookCode || "--"}</strong></div>
                      <div><span>Dimension</span><strong>{selectedItem.dimensionKey || "--"}</strong></div>
                      <div><span>Question type</span><strong>{selectedItem.questionType || "--"}</strong></div>
                      <div><span>Metadata</span><strong>{selectedItem.metadataStatus}</strong></div>
                      <div><span>Responses</span><strong>{selectedItem.responseCount}</strong></div>
                      <div><span>Percent correct</span><strong>{selectedItem.percentCorrect === null ? "--" : `${Math.round(selectedItem.percentCorrect)}%`}</strong></div>
                    </div>
                    <section className="detail-block">
                      <h3>Choice distribution</h3>
                      <pre>{formatUnknown(selectedItem.choiceDistribution)}</pre>
                    </section>
                    <section className="detail-block">
                      <h3>User reports</h3>
                      <pre>{selectedItem.reportCount} reports · {formatUnknown(selectedItem.reportCategories)}</pre>
                    </section>
                    <div className="review-form">
                      <div className="field">
                        <label htmlFor="review-status">Review status</label>
                        <select id="review-status" value={reviewStatus} onChange={event => setReviewStatus(event.target.value as ReviewStatus)}>
                          {REVIEW_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="review-notes">Review notes</label>
                        <textarea id="review-notes" value={reviewNotes} onChange={event => setReviewNotes(event.target.value)} placeholder="Textual, statistical, or metadata observations..." />
                      </div>
                      <div className="review-actions">
                        <button className="review-save" type="button" disabled={saving} onClick={() => void submitReview(reviewStatus)}>
                          {saving ? "Saving..." : "Save review"}
                        </button>
                        {reviewStatus !== "quarantined" && (
                          <button className="review-quarantine" type="button" disabled={saving} onClick={() => void submitReview("quarantined")}>
                            Quarantine
                          </button>
                        )}
                      </div>
                      <p className="save-message" role="status">{saveMessage}</p>
                    </div>
                  </>
                )}
              </aside>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

