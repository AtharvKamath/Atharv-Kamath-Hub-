/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  orderBy,
  query,
} from 'firebase/firestore';
import {
  CheckCircle2,
  XCircle,
  Eye,
  Clock,
  Shield,
  RefreshCw,
  X,
  AlertTriangle,
} from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import {
  AdminPermissionsMap,
  AdminRequest,
  AdminRole,
  PermissionAction,
  PermissionSection,
  ReviewPeriodOption,
} from '../../types';
import {
  createEmptyPermissions,
  createFullPermissions,
  PERMISSION_ACTIONS,
  PERMISSION_SECTIONS,
} from '../../utils/permissions';

export default function OwnerRequestsTab({
  onNotice,
}: {
  onNotice: (msg: string) => void;
}) {
  const { user, idToken, isOwner } = useAuth();
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reviewPeriod, setReviewPeriod] = useState<ReviewPeriodOption>('7d');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'expired'>('pending');

  // Approve modal state
  const [approvingReq, setApprovingReq] = useState<AdminRequest | null>(null);
  const [assignRole, setAssignRole] = useState<'full_admin' | 'limited_admin'>('limited_admin');
  const [assignPerms, setAssignPerms] = useState<AdminPermissionsMap>(createEmptyPermissions());
  const [actionLoading, setActionLoading] = useState(false);

  // Reject modal state
  const [rejectingReq, setRejectingReq] = useState<AdminRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // View details modal state
  const [viewingReq, setViewingReq] = useState<AdminRequest | null>(null);

  useEffect(() => {
    if (!isOwner) return;
    getDoc(doc(db, 'adminConfig', 'settings')).then((snap) => {
      if (snap.exists()) {
        const p = snap.data()?.reviewPeriod;
        if (p === '24h' || p === '3d' || p === '7d') setReviewPeriod(p);
      }
    }).catch(() => {});

    const q = query(collection(db, 'adminRequests'), orderBy('requestedAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: AdminRequest[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            ...data,
            requestedAt: data.requestedAt?.toDate
              ? data.requestedAt.toDate().toISOString()
              : String(data.requestedAt || ''),
            expiresAt: data.expiresAt?.toDate
              ? data.expiresAt.toDate().toISOString()
              : String(data.expiresAt || ''),
            reviewedAt: data.reviewedAt?.toDate
              ? data.reviewedAt.toDate().toISOString()
              : data.reviewedAt,
          };
        });
        setRequests(list);
        setLoadError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Error loading admin requests:', err);
        setLoadError(
          err?.message?.toLowerCase().includes('permission')
            ? 'Firestore permission denied reading adminRequests. Deploy firestore.rules to Firebase project atharv-kamath and verify Owner email.'
            : `Failed to load admin requests: ${err?.message || 'Unknown error'}`
        );
        setLoading(false);
      }
    );

    return () => unsub();
  }, [isOwner]);

  const handleSaveReviewPeriod = async (nextPeriod: ReviewPeriodOption) => {
    if (!isOwner || !user) return;
    setReviewPeriod(nextPeriod);
    try {
      await setDoc(doc(db, 'adminConfig', 'settings'), {
        reviewPeriod: nextPeriod,
        updatedAt: serverTimestamp(),
        updatedBy: user.email || '',
      });
      onNotice(`Default request review deadline set to ${nextPeriod}.`);
    } catch (err: any) {
      onNotice(`Failed to update review period: ${err?.message}`);
    }
  };

  const handleExpireStale = async () => {
    if (!idToken) return;
    setActionLoading(true);
    try {
      const resp = await fetch('/api/admin/requests/expire-stale', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await resp.json();
      if (resp.ok) {
        onNotice(`Expired ${data.expiredCount || 0} stale request(s).`);
      } else {
        onNotice(data.message || 'Could not expire stale requests.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const openApproveDialog = (req: AdminRequest) => {
    setApprovingReq(req);
    setAssignRole('limited_admin');
    setAssignPerms(createEmptyPermissions());
  };

  const togglePerm = (section: PermissionSection, action: PermissionAction) => {
    setAssignPerms((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [action]: !prev[section][action],
      },
    }));
  };

  const toggleEntireSection = (section: PermissionSection, val: boolean) => {
    setAssignPerms((prev) => ({
      ...prev,
      [section]: { view: val, create: val, edit: val, delete: val, publish: val },
    }));
  };

  const handleConfirmApprove = async () => {
    if (!approvingReq || !idToken) return;
    setActionLoading(true);
    try {
      const resp = await fetch(`/api/admin/requests/${approvingReq.requestId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          role: assignRole,
          permissions: assignRole === 'full_admin' ? createFullPermissions() : assignPerms,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        onNotice(data.message || 'Approval failed.');
      } else {
        onNotice(
          data.emailStatus === 'sent'
            ? `Approved ${approvingReq.name} and sent email notification.`
            : `Approved ${approvingReq.name}. (Email status: ${data.emailStatus})`
        );
        setApprovingReq(null);
      }
    } catch (err: any) {
      onNotice(err?.message || 'Network error approving request.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingReq || !idToken) return;
    setActionLoading(true);
    try {
      const resp = await fetch(`/api/admin/requests/${rejectingReq.requestId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ reason: rejectionReason }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        onNotice(data.message || 'Rejection failed.');
      } else {
        onNotice(`Rejected request from ${rejectingReq.name}.`);
        setRejectingReq(null);
        setRejectionReason('');
      }
    } catch (err: any) {
      onNotice(err?.message || 'Network error rejecting request.');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredRequests = requests.filter((r) =>
    filterStatus === 'all' ? true : r.status === filterStatus
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Controls & Review Period Config */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0b1220]/60 border border-white/5 p-5 rounded-2xl">
        <div>
          <h3 className="text-white font-bold text-sm">Review Deadline & Expiration Policy</h3>
          <p className="text-gray-400 text-xs mt-0.5">
            Pending requests automatically expire if not reviewed within this timeframe.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['24h', '3d', '7d'] as ReviewPeriodOption[]).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => handleSaveReviewPeriod(opt)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold cursor-pointer transition-all ${
                reviewPeriod === opt
                  ? 'bg-cyan-500 text-black'
                  : 'bg-white/5 text-gray-400 hover:text-white border border-white/10'
              }`}
            >
              {opt === '24h' ? '24 Hours' : opt === '3d' ? '3 Days' : '7 Days'}
            </button>
          ))}
          <button
            type="button"
            disabled={actionLoading}
            onClick={handleExpireStale}
            className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Clock size={12} /> Expire Overdue
          </button>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="flex flex-wrap gap-2">
        {(['pending', 'approved', 'rejected', 'expired', 'all'] as const).map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setFilterStatus(st)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono uppercase cursor-pointer ${
              filterStatus === st
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                : 'bg-white/5 text-gray-400 hover:text-white border border-white/5'
            }`}
          >
            {st} ({st === 'all' ? requests.length : requests.filter((r) => r.status === st).length})
          </button>
        ))}
      </div>

      {loadError && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-300 text-xs flex items-start gap-2.5">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-red-400" />
          <span>{loadError}</span>
        </div>
      )}

      {/* Requests Table */}
      <div className="bg-[#0b1220]/60 border border-white/5 rounded-2xl overflow-x-auto">
        {loading ? (
          <div className="p-10 text-center text-gray-400 text-xs font-mono flex items-center justify-center gap-2">
            <RefreshCw size={14} className="animate-spin text-cyan-400" /> Loading access requests...
          </div>
        ) : loadError ? (
          <div className="p-10 text-center text-red-400 text-xs font-mono">
            Unable to load administrator requests due to Firestore permissions/connectivity.
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-xs font-mono">
            No {filterStatus === 'all' ? '' : filterStatus} administrator access requests found.
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 text-gray-400 font-mono text-[10px] uppercase bg-white/[0.02]">
                <th className="p-4">Applicant Name</th>
                <th className="p-4">Email</th>
                <th className="p-4">Registered</th>
                <th className="p-4">Verified</th>
                <th className="p-4">Status</th>
                <th className="p-4">Deadline</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredRequests.map((req) => {
                const isOverdue = req.status === 'pending' && req.expiresAt && new Date(req.expiresAt).getTime() < Date.now();
                return (
                  <tr key={req.requestId} className="hover:bg-white/[0.02]">
                    <td className="p-4 font-bold text-white">{req.name}</td>
                    <td className="p-4 font-mono text-gray-300">{req.email}</td>
                    <td className="p-4 text-gray-400 font-mono">
                      {req.requestedAt ? new Date(req.requestedAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 bg-green-500/15 text-green-400 rounded font-mono text-[10px]">
                        {req.verified ? 'Verified' : 'Unverified'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-0.5 rounded font-mono text-[10px] uppercase font-bold ${
                          req.status === 'approved'
                            ? 'bg-green-500/15 text-green-400'
                            : req.status === 'rejected'
                            ? 'bg-red-500/15 text-red-400'
                            : req.status === 'expired' || isOverdue
                            ? 'bg-amber-500/15 text-amber-400'
                            : 'bg-cyan-500/15 text-cyan-400'
                        }`}
                      >
                        {isOverdue ? 'Overdue' : req.status}
                      </span>
                    </td>
                    <td className="p-4 text-gray-400 font-mono">
                      {req.expiresAt ? new Date(req.expiresAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewingReq(req)}
                          className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg cursor-pointer"
                          title="View Details"
                        >
                          <Eye size={13} />
                        </button>
                        {req.status === 'pending' && !isOverdue && (
                          <>
                            <button
                              type="button"
                              onClick={() => openApproveDialog(req)}
                              className="px-2.5 py-1.5 bg-green-500/15 hover:bg-green-500 text-green-400 hover:text-black rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <CheckCircle2 size={12} /> Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRejectingReq(req);
                                setRejectionReason('');
                              }}
                              className="px-2.5 py-1.5 bg-red-500/15 hover:bg-red-500 text-red-400 hover:text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <XCircle size={12} /> Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* === PERMISSION SELECTION DIALOG (APPROVE) === */}
      {approvingReq && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-[#0c1220] border border-white/15 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div>
                <h4 className="text-white font-bold text-base flex items-center gap-2">
                  <Shield size={16} className="text-cyan-400" /> Approve &amp; Assign Permissions
                </h4>
                <p className="text-gray-400 text-xs mt-0.5">
                  Applicant: <strong className="text-white">{approvingReq.name}</strong> ({approvingReq.email})
                </p>
              </div>
              <button
                onClick={() => setApprovingReq(null)}
                className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 flex-grow">
              {/* Role Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAssignRole('limited_admin')}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    assignRole === 'limited_admin'
                      ? 'bg-cyan-500/15 border-cyan-500 text-white'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold text-xs">Limited Administrator</div>
                  <div className="text-[11px] opacity-80 mt-1">
                    Access only the specific sections and actions checked below.
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setAssignRole('full_admin')}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    assignRole === 'full_admin'
                      ? 'bg-indigo-500/15 border-indigo-400 text-white'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold text-xs">Full Administrator</div>
                  <div className="text-[11px] opacity-80 mt-1">
                    Manage all website content &amp; inquiries, excluding Owner-only controls.
                  </div>
                </button>
              </div>

              {assignRole === 'limited_admin' && (
                <div className="border border-white/10 rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/10 text-gray-300 font-mono text-[10px] uppercase">
                        <th className="p-3">Website Section</th>
                        {PERMISSION_ACTIONS.map((act) => (
                          <th key={act.key} className="p-3 text-center">
                            {act.label}
                          </th>
                        ))}
                        <th className="p-3 text-center">All</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {PERMISSION_SECTIONS.map((sec) => {
                        const secPerms = assignPerms[sec.key];
                        const allChecked = PERMISSION_ACTIONS.every((a) => secPerms[a.key]);
                        return (
                          <tr key={sec.key} className="hover:bg-white/[0.02]">
                            <td className="p-3">
                              <div className="font-bold text-white">{sec.label}</div>
                              <div className="text-[10px] text-gray-500">{sec.description}</div>
                            </td>
                            {PERMISSION_ACTIONS.map((act) => (
                              <td key={act.key} className="p-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={secPerms[act.key]}
                                  onChange={() => togglePerm(sec.key, act.key)}
                                  className="rounded border-white/20 bg-[#070a11] text-cyan-500 cursor-pointer"
                                />
                              </td>
                            ))}
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={allChecked}
                                onChange={() => toggleEntireSection(sec.key, !allChecked)}
                                className="rounded border-white/20 bg-[#070a11] text-indigo-500 cursor-pointer"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-white/10 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setApprovingReq(null)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmApprove}
                className="px-5 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-bold rounded-xl text-xs cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? 'Approving...' : 'Confirm Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === REJECT CONFIRMATION DIALOG === */}
      {rejectingReq && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-[#0c1220] border border-white/15 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h4 className="text-white font-bold text-base">Reject Administrator Request</h4>
            <p className="text-gray-400 text-xs">
              Are you sure you want to reject <strong className="text-white">{rejectingReq.name}</strong> ({rejectingReq.email})?
            </p>
            <div>
              <label className="block text-gray-400 text-[11px] font-semibold uppercase mb-1.5">
                Rejection Reason (Optional)
              </label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Provide an optional note for the applicant..."
                className="w-full px-3 py-2 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white resize-none"
              />
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRejectingReq(null)}
                className="px-4 py-2 bg-white/5 text-gray-300 rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmReject}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === VIEW DETAILS MODAL === */}
      {viewingReq && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-[#0c1220] border border-white/15 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h4 className="text-white font-bold text-base">Request Details</h4>
              <button
                onClick={() => setViewingReq(null)}
                className="p-1 bg-white/5 rounded-lg text-gray-400 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-gray-500">Request ID</span>
                <span className="text-gray-200">{viewingReq.requestId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Applicant</span>
                <span className="text-white font-bold">{viewingReq.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Email</span>
                <span className="text-cyan-400">{viewingReq.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Verified</span>
                <span className="text-green-400">{viewingReq.verified ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className="text-white uppercase">{viewingReq.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Submitted</span>
                <span className="text-gray-300">
                  {viewingReq.requestedAt ? new Date(viewingReq.requestedAt).toLocaleString() : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Expires</span>
                <span className="text-gray-300">
                  {viewingReq.expiresAt ? new Date(viewingReq.expiresAt).toLocaleString() : '—'}
                </span>
              </div>
              {viewingReq.reviewedBy && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Reviewed By</span>
                  <span className="text-gray-300">{viewingReq.reviewedBy}</span>
                </div>
              )}
              {viewingReq.rejectionReason && (
                <div className="pt-2 border-t border-white/10">
                  <span className="text-gray-500 block mb-1">Rejection Reason</span>
                  <p className="text-red-300">{viewingReq.rejectionReason}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
