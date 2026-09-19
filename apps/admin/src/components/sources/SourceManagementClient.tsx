"use client";

import React, { useState } from "react";
import {
  Database,
  ShieldCheck,
  Play,
  Pause,
  Plus,
  RefreshCw,
  Archive,
  ExternalLink,
  Eye,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Key,
} from "lucide-react";

export interface SourceItem {
  id: string;
  key: string;
  name: string;
  description: string;
  baseUrl: string | null;
  adapterType: string;
  accessMethod: string;
  sourceFamily: string;
  isEnabled: boolean;
  policyStatus: string;
  rateLimitPerMinute: number;
  permittedExcerptLength: number;
  attributionRequired: boolean;
  termsNotes: string | null;
  lastSuccessfulCollection: string | null;
  lastRun: {
    status: string;
    signalsIngested: number;
    startedAt: string;
    errorMessage: string | null;
  } | null;
  configPresent: boolean;
}

export function SourceManagementClient({ initialSources }: { initialSources: SourceItem[] }) {
  const [sources, setSources] = useState<SourceItem[]>(initialSources);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [previewItems, setPreviewItems] = useState<{ sourceName: string; items: any[] } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // New RSS Source modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newRssName, setNewRssName] = useState("");
  const [newRssUrl, setNewRssUrl] = useState("");
  const [newRssDescription, setNewRssDescription] = useState("");
  const [newRssFamily, setNewRssFamily] = useState("COMMUNITY");
  const [isAdding, setIsAdding] = useState(false);

  const togglePauseResume = async (source: SourceItem) => {
    setActiveActionId(source.id);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/admin/sources/${source.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Action": "1",
        },
        body: JSON.stringify({ isEnabled: !source.isEnabled }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update source state");
      }

      setSources((prev) =>
        prev.map((s) => (s.id === source.id ? { ...s, isEnabled: data.source.isEnabled } : s)),
      );
      setActionSuccess(`Source '${source.name}' is now ${data.source.isEnabled ? "ACTIVE" : "PAUSED"}.`);
    } catch (err: any) {
      setActionError(err.message || "Failed to update source state");
    } finally {
      setActiveActionId(null);
    }
  };

  const archiveSource = async (source: SourceItem) => {
    if (!confirm(`Are you sure you want to archive '${source.name}'? It will be disabled but historical evidence will remain intact.`)) {
      return;
    }

    setActiveActionId(source.id);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/admin/sources/${source.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Action": "1",
        },
        body: JSON.stringify({ archive: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to archive source");
      }

      setSources((prev) =>
        prev.map((s) =>
          s.id === source.id
            ? { ...s, isEnabled: false, policyStatus: "BLOCKED", termsNotes: data.source.termsNotes }
            : s,
        ),
      );
      setActionSuccess(`Source '${source.name}' archived successfully.`);
    } catch (err: any) {
      setActionError(err.message || "Failed to archive source");
    } finally {
      setActiveActionId(null);
    }
  };

  const testSourcePreview = async (source: SourceItem) => {
    setActiveActionId(source.id);
    setActionError(null);
    setActionSuccess(null);
    setPreviewItems(null);

    try {
      const res = await fetch(`/api/admin/sources/${source.id}/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Action": "1",
        },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to preview source signals");
      }

      setPreviewItems({
        sourceName: source.name,
        items: data.items,
      });
      setActionSuccess(`Fetched ${data.items.length} genuine preview items from ${source.name}.`);
    } catch (err: any) {
      setActionError(err.message || "Failed to test source");
    } finally {
      setActiveActionId(null);
    }
  };

  const triggerIngestion = async (source: SourceItem) => {
    setActiveActionId(source.id);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/admin/sources/${source.id}/trigger`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Action": "1",
        },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to trigger ingestion");
      }

      setActionSuccess(
        `Ingestion run '${data.run.runId.slice(0, 8)}' finished: ${data.run.counters.fetched} items fetched, ${data.run.counters.published} published.`,
      );
    } catch (err: any) {
      setActionError(err.message || "Failed to trigger ingestion");
    } finally {
      setActiveActionId(null);
    }
  };

  const handleCreateRss = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdding(true);
    setActionError(null);

    try {
      const res = await fetch("/api/admin/sources", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Action": "1",
        },
        body: JSON.stringify({
          name: newRssName,
          feedUrl: newRssUrl,
          description: newRssDescription,
          sourceFamily: newRssFamily,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to add RSS source");
      }

      setSources((prev) => [...prev, { ...data.source, runs: [], lastRun: null, configPresent: true }]);
      setIsAddModalOpen(false);
      setNewRssName("");
      setNewRssUrl("");
      setNewRssDescription("");
      setActionSuccess(`RSS Source '${data.source.name}' successfully added and validated.`);
    } catch (err: any) {
      setActionError(err.message || "Failed to add RSS source");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert Notifications */}
      {actionError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{actionError}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Action Header */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-zinc-400">
          Showing <strong className="text-white font-mono">{sources.length}</strong> configured source connectors.
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" /> Add RSS Source
        </button>
      </div>

      {/* Sources Grid */}
      <div className="grid grid-cols-1 gap-4">
        {sources.map((src) => {
          const isProcessing = activeActionId === src.id;

          return (
            <div
              key={src.id}
              className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-xl space-y-4"
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                        src.isEnabled
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-zinc-800 text-zinc-400 border border-zinc-700/80"
                      }`}
                    >
                      {src.isEnabled ? "ACTIVE" : "PAUSED"}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                        src.policyStatus === "ALLOWED"
                          ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                          : src.policyStatus === "BLOCKED"
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}
                    >
                      {src.policyStatus}
                    </span>
                    <span className="text-[11px] text-zinc-400 font-mono bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                      {src.sourceFamily}
                    </span>
                  </div>

                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    {src.name}
                    <span className="text-xs font-mono font-normal text-zinc-500">({src.key})</span>
                  </h2>
                  <p className="text-xs text-zinc-400">{src.description}</p>
                  {src.baseUrl && (
                    <div className="pt-1">
                      <a
                        href={src.baseUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 font-mono break-all"
                      >
                        {src.baseUrl} <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Operations Buttons */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    onClick={() => testSourcePreview(src)}
                    disabled={isProcessing}
                    className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-medium border border-zinc-700/80 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Eye className="w-3.5 h-3.5 text-indigo-400" /> Test & Preview
                  </button>

                  <button
                    onClick={() => triggerIngestion(src)}
                    disabled={isProcessing || !src.isEnabled || src.policyStatus === "BLOCKED"}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-medium border border-indigo-500/30 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Play className="w-3 h-3 fill-indigo-300" /> Ingest
                  </button>

                  <button
                    onClick={() => togglePauseResume(src)}
                    disabled={isProcessing}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 disabled:opacity-50 ${
                      src.isEnabled
                        ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30"
                        : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    }`}
                  >
                    {src.isEnabled ? (
                      <>
                        <Pause className="w-3 h-3" /> Pause
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-emerald-300" /> Resume
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => archiveSource(src)}
                    disabled={isProcessing || src.policyStatus === "BLOCKED"}
                    className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-300 text-xs font-medium border border-zinc-800 hover:border-rose-500/30 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Archive className="w-3.5 h-3.5" /> Archive
                  </button>
                </div>
              </div>

              {/* Telemetry and Compliance Specs */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs pt-3 border-t border-zinc-800/80 text-zinc-400">
                <div>
                  <span className="text-zinc-500 block">Adapter & Protocol</span>
                  <span className="text-zinc-200 font-mono text-[11px]">
                    {src.adapterType} • {src.accessMethod}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Rate Limit & Excerpt</span>
                  <span className="text-zinc-200 font-mono text-[11px]">
                    {src.rateLimitPerMinute} req/min (≤{src.permittedExcerptLength} chars)
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Credentials & Config</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono">
                    <Key className="w-3 h-3 text-indigo-400" />
                    {src.configPresent ? (
                      <span className="text-emerald-400">Config Present</span>
                    ) : (
                      <span className="text-amber-400">Config Missing / Blocked</span>
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Last Collection</span>
                  <span className="text-zinc-200 font-mono text-[11px]">
                    {src.lastSuccessfulCollection
                      ? new Date(src.lastSuccessfulCollection).toLocaleDateString()
                      : "Never"}
                  </span>
                </div>
              </div>

              {src.termsNotes && (
                <div className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/60 text-xs text-zinc-400 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <span>{src.termsNotes}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Preview Modal */}
      {previewItems && (
        <div className="p-6 rounded-2xl bg-zinc-950 border border-indigo-500/30 shadow-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-indigo-400" /> Genuine Fetched Preview: {previewItems.sourceName}
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Bounded preview of empirical records fetched safely via connection pinning and SSRF defense.
              </p>
            </div>
            <button
              onClick={() => setPreviewItems(null)}
              className="text-xs text-zinc-500 hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="space-y-3">
            {previewItems.items.map((item, idx) => (
              <div
                key={item.externalId || idx}
                className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/80 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">{item.title}</span>
                  <span className="text-[10px] text-zinc-500 font-mono">{item.author}</span>
                </div>
                <p className="text-zinc-300 font-mono text-[11px]">"{item.excerpt}"</p>
                <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 underline break-all"
                  >
                    {item.url}
                  </a>
                  {item.promptInjectionDetected && (
                    <span className="text-rose-400 font-bold uppercase">Prompt Injection Flagged</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Generic RSS Source Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Add Generic RSS Source</h3>
            <p className="text-xs text-zinc-400">
              Register a generic RSS feed without code changes. Feed URL will be strictly validated against SSRF blocklists.
            </p>

            <form onSubmit={handleCreateRss} className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-300 font-medium mb-1">Source Name</label>
                <input
                  type="text"
                  required
                  value={newRssName}
                  onChange={(e) => setNewRssName(e.target.value)}
                  placeholder="e.g. Asian Tech Daily"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Feed Canonical URL</label>
                <input
                  type="url"
                  required
                  value={newRssUrl}
                  onChange={(e) => setNewRssUrl(e.target.value)}
                  placeholder="https://example.com/feed.xml"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Description / Topic Focus</label>
                <input
                  type="text"
                  value={newRssDescription}
                  onChange={(e) => setNewRssDescription(e.target.value)}
                  placeholder="Market news and startup funding"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Source Family</label>
                <select
                  value={newRssFamily}
                  onChange={(e) => setNewRssFamily(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="COMMUNITY">COMMUNITY</option>
                  <option value="DISCOVERY">DISCOVERY</option>
                  <option value="DEVELOPER_ECOSYSTEM">DEVELOPER_ECOSYSTEM</option>
                  <option value="ENTERPRISE_SOFTWARE">ENTERPRISE_SOFTWARE</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isAdding ? "Validating & Adding..." : "Register Source"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
