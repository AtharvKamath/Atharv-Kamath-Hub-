/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  orderBy,
  query,
} from 'firebase/firestore';
import {
  Mail,
  Check,
  Reply,
  Trash2,
  AlertCircle,
  Clock,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { ContactMessage, InquiryStatus } from '../../types';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrors';

export default function DirectInquiriesTab({
  onNotice,
}: {
  onNotice: (msg: string) => void;
}) {
  const { idToken, hasPermission } = useAuth();
  const canView = hasPermission('directInquiry', 'view');
  const canEdit = hasPermission('directInquiry', 'edit');
  const canDelete = hasPermission('directInquiry', 'delete');

  const [inquiries, setInquiries] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | InquiryStatus>('all');

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    const q = query(collection(db, 'inquiries'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: ContactMessage[] = snap.docs.map((d) => {
          const data = d.data() as any;
          const createdIso = data.createdAt?.toDate
            ? data.createdAt.toDate().toISOString()
            : String(data.createdAt || '');
          return {
            id: data.inquiryId || d.id,
            name: data.name || '',
            email: data.email || '',
            subject: data.subject || '',
            category: data.category || 'General Inquiry',
            message: data.message || '',
            date: createdIso ? new Date(createdIso).toLocaleString() : '',
            createdAt: createdIso,
            read: data.status !== 'unread',
            status: data.status || 'unread',
            notificationStatus: data.notificationStatus || 'pending',
            notificationError: data.notificationError || '',
          };
        });
        setInquiries(list);
        setLoadError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Error loading inquiries:', err);
        setLoadError(
          err?.message?.toLowerCase().includes('permission')
            ? 'Firestore permission denied reading inquiries. Deploy firestore.rules to Firebase project atharv-kamath.'
            : `Failed to load inquiries: ${err?.message || 'Unknown error'}`
        );
        setLoading(false);
      }
    );
    return () => unsub();
  }, [canView]);

  const handleRetryEmail = async (id: string) => {
    if (!canEdit || !idToken) return;
    setRetryingId(id);
    try {
      const resp = await fetch(`/api/admin/inquiries/${id}/retry-email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.notificationStatus === 'sent') {
        onNotice('Inquiry email delivered successfully to owner inbox.');
      } else {
        onNotice(data?.message || 'Email delivery retry failed.');
      }
    } catch (err: any) {
      onNotice(err?.message || 'Network error retrying email delivery.');
    } finally {
      setRetryingId(null);
    }
  };

  const handleSetStatus = async (id: string, status: InquiryStatus) => {
    if (!canEdit) return;
    try {
      await updateDoc(doc(db, 'inquiries', id), { status });
      onNotice(`Marked inquiry as ${status}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `inquiries/${id}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canDelete) return;
    try {
      await deleteDoc(doc(db, 'inquiries', id));
      onNotice('Inquiry deleted.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `inquiries/${id}`);
    }
  };

  if (!canView) {
    return (
      <div className="p-10 text-center text-red-400 text-xs font-mono">
        You do not have permission to view Direct Inquiries.
      </div>
    );
  }

  const filtered = inquiries.filter((i) => (filterStatus === 'all' ? true : i.status === filterStatus));

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(['all', 'unread', 'read', 'replied'] as const).map((st) => (
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
              {st} ({st === 'all' ? inquiries.length : inquiries.filter((i) => i.status === st).length})
            </button>
          ))}
        </div>
      </div>

      {loadError && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-300 text-xs flex items-start gap-2.5">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-red-400" />
          <span>{loadError}</span>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-gray-400 text-xs font-mono flex items-center justify-center gap-2">
          <RefreshCw size={14} className="animate-spin text-cyan-400" /> Loading direct inquiries...
        </div>
      ) : loadError ? (
        <div className="py-12 text-center text-red-400 font-mono text-xs bg-[#0b1220]/60 border border-white/5 rounded-2xl">
          Unable to load Direct Inquiries until Firestore access is enabled.
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-gray-500 font-mono text-sm bg-[#0b1220]/60 border border-white/5 rounded-2xl">
          No {filterStatus === 'all' ? '' : filterStatus} inquiries found.
        </div>
      ) : (
        <div className="space-y-4 text-xs font-mono">
          {filtered.map((msg) => (
            <div
              key={msg.id}
              id={`message-item-${msg.id}`}
              className={`p-5 rounded-2xl border ${
                msg.status === 'unread'
                  ? 'bg-cyan-500/5 border-cyan-500/25'
                  : 'bg-[#0b1220]/60 border-white/5'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-white font-bold text-sm font-sans">{msg.name}</h4>
                    <span className="px-2 py-0.5 bg-indigo-500/15 text-indigo-300 rounded text-[10px]">
                      {msg.category}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                        msg.status === 'unread'
                          ? 'bg-cyan-500/20 text-cyan-300'
                          : msg.status === 'replied'
                          ? 'bg-green-500/15 text-green-400'
                          : 'bg-white/10 text-gray-300'
                      }`}
                    >
                      {msg.status}
                    </span>
                    {msg.notificationStatus === 'sent' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/10 text-green-400 rounded text-[10px]">
                        <CheckCircle2 size={10} /> Email Delivered
                      </span>
                    ) : msg.notificationStatus === 'queued_retry' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-300 rounded text-[10px]">
                        <Clock size={10} /> Email Queued Retry
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/10 text-red-400 rounded text-[10px]"
                        title={msg.notificationError || 'Email delivery failed'}
                      >
                        <AlertCircle size={10} /> Email Not Sent
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 text-[11px] mt-1">
                    {msg.email} • {msg.date}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {canEdit && msg.status === 'unread' && (
                    <button
                      type="button"
                      onClick={() => handleSetStatus(msg.id, 'read')}
                      className="px-2.5 py-1 bg-cyan-500 hover:bg-cyan-400 text-black rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Check size={11} /> Mark as Read
                    </button>
                  )}
                  {canEdit && msg.status !== 'replied' && (
                    <button
                      type="button"
                      onClick={() => handleSetStatus(msg.id, 'replied')}
                      className="px-2.5 py-1 bg-green-500/15 hover:bg-green-500 text-green-300 hover:text-black rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Reply size={11} /> Mark as Replied
                    </button>
                  )}
                  <a
                    href={`mailto:${msg.email}?subject=${encodeURIComponent(`Re: ${msg.subject}`)}`}
                    onClick={() => canEdit && handleSetStatus(msg.id, 'replied')}
                    className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-gray-200 rounded-lg text-[10px] font-bold flex items-center gap-1"
                  >
                    <Mail size={11} /> Reply
                  </a>
                  {canEdit &&
                    (msg.notificationStatus === 'failed' || msg.notificationStatus === 'queued_retry') && (
                      <button
                        type="button"
                        disabled={retryingId === msg.id}
                        onClick={() => handleRetryEmail(msg.id)}
                        className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-black rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw size={11} className={retryingId === msg.id ? 'animate-spin' : ''} /> Retry Email
                      </button>
                    )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => handleDelete(msg.id)}
                      className="p-1.5 hover:bg-red-500/15 text-red-400 rounded-lg border border-red-500/15 cursor-pointer"
                      title="Delete Inquiry"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>

              <h5 className="text-cyan-400 font-bold mb-1.5 font-sans text-xs">
                Subject: {msg.subject || 'No subject'}
              </h5>
              <p className="text-gray-300 leading-relaxed font-sans font-light whitespace-pre-wrap">
                {msg.message}
              </p>
              {msg.notificationError && msg.notificationStatus !== 'sent' && (
                <p className="text-[10px] text-amber-400/80 mt-2">
                  Email Delivery Note: {msg.notificationError}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
