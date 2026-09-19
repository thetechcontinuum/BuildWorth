import React from "react";
import { prisma } from "@buildworth/database";
import { requireServerAdmin } from "@/lib/admin-page-guard";
import { ShieldCheck, Search, Filter, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Audit Logs — BuildWorth Admin",
};

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: { entityType?: string; action?: string; page?: string };
}) {
  await requireServerAdmin();

  const page = Math.max(1, parseInt(searchParams.page || "1", 10));
  const limit = 25;
  const entityType = searchParams.entityType || undefined;
  const action = searchParams.action || undefined;

  const where: any = {};
  if (entityType && entityType !== "ALL") where.entityType = entityType;
  if (action && action !== "ALL") where.action = action;

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Administrative Audit Logs</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Immutable, sanitized ledger of administrative mutations, configuration changes, and ingestion triggers.
          </p>
        </div>
        <div className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300">
          Total Records: <strong className="text-white">{total}</strong>
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden shadow-xl">
        {logs.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-sm">No audit logs match current filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-900/50 text-zinc-400 uppercase tracking-wider font-semibold border-b border-zinc-800">
                <tr>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity Type / ID</th>
                  <th className="py-3 px-4">Admin User</th>
                  <th className="py-3 px-4">Reason / Details</th>
                  <th className="py-3 px-4">IP Address</th>
                  <th className="py-3 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-900/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-indigo-400">
                      {log.action}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-900 border border-zinc-700 text-zinc-300 mr-2">
                        {log.entityType}
                      </span>
                      <span className="font-mono text-zinc-500 text-[11px]">{log.entityId?.slice(0, 10)}...</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-zinc-200 font-medium">{log.user?.email || "System"}</div>
                      <div className="text-[10px] text-zinc-500 font-mono">{log.user?.role}</div>
                    </td>
                    <td className="py-3.5 px-4 max-w-sm">
                      <div className="text-zinc-300 truncate">{log.reason || "N/A"}</div>
                      {log.details && (
                        <div className="text-[10px] font-mono text-zinc-500 truncate mt-0.5">
                          {JSON.stringify(log.details)}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-zinc-500">{log.ipAddress || "—"}</td>
                    <td className="py-3.5 px-4 text-right text-zinc-400 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
