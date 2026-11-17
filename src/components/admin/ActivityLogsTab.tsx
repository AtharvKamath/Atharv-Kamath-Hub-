/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore';
import { Activity, RefreshCw, AlertTriangle } from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { AdminAuditLog } from '../../types';

export default function ActivityLogsTab() {
  const { isOwner } = useAuth();
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOwner) return;
    const q = query(collection(db, 'adminAuditLogs'), orderBy('timestamp', 'desc'), limit(150));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: AdminAuditLog[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            ...data,
            timestamp: data.timestamp?.toDate
              ? data.timestamp.toDate().toISOString()
              : String(data.timestamp || ''),
          };
        });
        setLogs(list);
        setLoadError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Error loading audit logs:', err);
        setLoadError(
          err?.message?.toLowerCase().includes('permission')
            ? 'Firestore permission denied reading adminAuditLogs. Deploy firestore.rules to Firebase project atharv-kamath.'
            : `Failed to load audit logs: ${err?.message || 'Unknown error'}`
        );
        setLoading(false);
      }
    );
    return () => unsub();
  }, [isOwner]);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="bg-[#0b1220]/60 border border-white/5 p-5 rounded-2xl flex items-center gap-3">
        <Activity size={18} className="text-cyan-400" />
        <div>
          <h3 className="text-white font-bold text-sm">Security &amp; Administration Audit Logs</h3>
          <p className="text-gray-400 text-xs">
            Immutable record of approvals, permission updates, game file uploads, and security quarantine events.
          </p>
        </div>
      </div>

      {loadError && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-300 text-xs flex items-start gap-2.5">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-red-400" />
          <span>{loadError}</span>
        </div>
      )}

      <div className="bg-[#0b1220]/60 border border-white/5 rounded-2xl overflow-x-auto">
        {loading ? (
          <div className="p-10 text-center text-gray-400 text-xs font-mono flex items-center justify-center gap-2">
            <RefreshCw size={14} className="animate-spin text-cyan-400" /> Loading audit trail...
          </div>
        ) : loadError ? (
          <div className="p-10 text-center text-red-400 text-xs font-mono">
            Unable to load security audit logs until Firestore read succeeds.
          </div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center text-gray-500 text-xs font-mono">No audit log events recorded yet.</div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 text-gray-400 font-mono text-[10px] uppercase bg-white/[0.02]">
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">Actor</th>
                <th className="p-3.5">Action</th>
                <th className="p-3.5">Target</th>
                <th className="p-3.5">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {logs.map((log) => (
                <tr key={log.logId} className="hover:bg-white/[0.02]">
                  <td className="p-3.5 font-mono text-gray-400 whitespace-nowrap">
                    {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                  </td>
                  <td className="p-3.5 font-mono text-cyan-300">{log.actorEmail || log.actorUid}</td>
                  <td className="p-3.5">
                    <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded font-mono text-[10px] text-white">
                      {log.action}
                    </span>
                  </td>
                  <td className="p-3.5 font-mono text-gray-400">{log.targetId}</td>
                  <td className="p-3.5 text-gray-300">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
