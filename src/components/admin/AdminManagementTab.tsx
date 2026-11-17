/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  Shield,
  Edit2,
  Ban,
  CheckCircle2,
  Trash2,
  Lock,
  X,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { db, OWNER_EMAIL } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import {
  AdminAccountStatus,
  AdminPermissionsMap,
  AdminUser,
  PermissionAction,
  PermissionSection,
} from '../../types';
import {
  createEmptyPermissions,
  createFullPermissions,
  formatRoleLabel,
  PERMISSION_ACTIONS,
  PERMISSION_SECTIONS,
} from '../../utils/permissions';

export default function AdminManagementTab({
  onNotice,
}: {
  onNotice: (msg: string) => void;
}) {
  const { idToken, isOwner } = useAuth();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [editRole, setEditRole] = useState<'full_admin' | 'limited_admin'>('limited_admin');
  const [editPerms, setEditPerms] = useState<AdminPermissionsMap>(createEmptyPermissions());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOwner) return;
    const unsub = onSnapshot(
      collection(db, 'adminUsers'),
      (snap) => {
        const list: AdminUser[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : String(data.createdAt || ''),
            lastLoginAt: data.lastLoginAt?.toDate ? data.lastLoginAt.toDate().toISOString() : data.lastLoginAt,
          };
        });
        list.sort((a, b) => (a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : a.name.localeCompare(b.name)));
        setAdmins(list);
        setLoadError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Error loading adminUsers:', err);
        setLoadError(
          err?.message?.toLowerCase().includes('permission')
            ? 'Firestore permission denied reading adminUsers. Deploy firestore.rules to Firebase project atharv-kamath.'
            : `Failed to load administrators: ${err?.message || 'Unknown error'}`
        );
        setLoading(false);
      }
    );
    return () => unsub();
  }, [isOwner]);

  const openEditPermissions = (adm: AdminUser) => {
    setEditingAdmin(adm);
    setEditRole(adm.role === 'full_admin' ? 'full_admin' : 'limited_admin');
    setEditPerms(adm.permissions || createEmptyPermissions());
  };

  const togglePerm = (sec: PermissionSection, act: PermissionAction) => {
    setEditPerms((prev) => ({
      ...prev,
      [sec]: {
        ...(prev[sec] || { view: false, create: false, edit: false, delete: false, publish: false }),
        [act]: !prev[sec]?.[act],
      },
    }));
  };

  const handleSavePermissions = async () => {
    if (!editingAdmin || !idToken) return;
    setSaving(true);
    try {
      const resp = await fetch(`/api/admin/users/${editingAdmin.uid}/permissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          role: editRole,
          permissions: editRole === 'full_admin' ? createFullPermissions() : editPerms,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        onNotice(data.message || 'Failed to update permissions.');
      } else {
        onNotice(`Updated permissions for ${editingAdmin.name}.`);
        setEditingAdmin(null);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (adm: AdminUser, status: AdminAccountStatus) => {
    if (!idToken) return;
    const resp = await fetch(`/api/admin/users/${adm.uid}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ status }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      onNotice(data.message || 'Failed to update status.');
    } else {
      onNotice(`Set ${adm.name} status to ${status}.`);
    }
  };

  const handleRemoveAdmin = async (adm: AdminUser) => {
    if (!idToken) return;
    const resp = await fetch(`/api/admin/users/${adm.uid}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const data = await resp.json();
    if (!resp.ok) {
      onNotice(data.message || 'Failed to remove administrator.');
    } else {
      onNotice(`Removed administrator ${adm.name}.`);
    }
  };

  const summarizePermissions = (adm: AdminUser): string => {
    if (adm.role === 'owner' || adm.role === 'full_admin') return 'All Sections';
    const activeSecs = PERMISSION_SECTIONS.filter((s) =>
      Object.values(adm.permissions?.[s.key] || {}).some(Boolean)
    ).map((s) => s.label);
    return activeSecs.length ? activeSecs.join(', ') : 'No permissions';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-[#0b1220]/60 border border-white/5 p-5 rounded-2xl">
        <h3 className="text-white font-bold text-sm">Authorized Administrators</h3>
        <p className="text-gray-400 text-xs mt-1">
          Manage roles, section permissions, suspension, and revocation. Changes take effect immediately via real-time database listeners.
        </p>
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
            <RefreshCw size={14} className="animate-spin text-cyan-400" /> Loading administrators...
          </div>
        ) : loadError ? (
          <div className="p-10 text-center text-red-400 text-xs font-mono">
            Unable to display administrator directory until Firestore read succeeds.
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 text-gray-400 font-mono text-[10px] uppercase bg-white/[0.02]">
                <th className="p-4">Name</th>
                <th className="p-4">Email</th>
                <th className="p-4">Role</th>
                <th className="p-4">Status</th>
                <th className="p-4">Last Login</th>
                <th className="p-4">Permissions</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {admins.map((adm) => {
                const isOwnerRow = adm.role === 'owner' || adm.email.toLowerCase() === OWNER_EMAIL.toLowerCase();
                return (
                  <tr key={adm.uid} className="hover:bg-white/[0.02]">
                    <td className="p-4 font-bold text-white">{adm.name}</td>
                    <td className="p-4 font-mono text-gray-300">{adm.email}</td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                          isOwnerRow
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : adm.role === 'full_admin'
                            ? 'bg-indigo-500/20 text-indigo-300'
                            : 'bg-cyan-500/15 text-cyan-300'
                        }`}
                      >
                        {formatRoleLabel(adm.role)}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-0.5 rounded font-mono text-[10px] uppercase font-bold ${
                          adm.status === 'active'
                            ? 'bg-green-500/15 text-green-400'
                            : adm.status === 'suspended'
                            ? 'bg-amber-500/15 text-amber-400'
                            : 'bg-red-500/15 text-red-400'
                        }`}
                      >
                        {adm.status}
                      </span>
                    </td>
                    <td className="p-4 text-gray-400 font-mono">
                      {adm.lastLoginAt ? new Date(adm.lastLoginAt).toLocaleString() : '—'}
                    </td>
                    <td className="p-4 text-gray-300 max-w-xs truncate" title={summarizePermissions(adm)}>
                      {summarizePermissions(adm)}
                    </td>
                    <td className="p-4 text-right">
                      {isOwnerRow ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-purple-300 bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/20">
                          <Lock size={11} /> Protected Owner
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditPermissions(adm)}
                            className="px-2.5 py-1.5 bg-cyan-500/15 hover:bg-cyan-500 text-cyan-300 hover:text-black rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                            title="Edit Permissions"
                          >
                            <Edit2 size={11} /> Edit
                          </button>
                          {adm.status === 'active' ? (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(adm, 'suspended')}
                              className="px-2.5 py-1.5 bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-black rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Ban size={11} /> Suspend
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(adm, 'active')}
                              className="px-2.5 py-1.5 bg-green-500/15 hover:bg-green-500 text-green-300 hover:text-black rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <CheckCircle2 size={11} /> Activate
                            </button>
                          )}
                          {adm.status !== 'revoked' && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(adm, 'revoked')}
                              className="px-2.5 py-1.5 bg-red-500/15 hover:bg-red-500 text-red-300 hover:text-white rounded-lg font-bold cursor-pointer"
                            >
                              Revoke
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveAdmin(adm)}
                            className="p-1.5 bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white rounded-lg cursor-pointer"
                            title="Remove Administrator"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Permissions Modal */}
      {editingAdmin && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-[#0c1220] border border-white/15 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div>
                <h4 className="text-white font-bold text-base flex items-center gap-2">
                  <Shield size={16} className="text-cyan-400" /> Edit Permissions — {editingAdmin.name}
                </h4>
                <p className="text-gray-400 text-xs">{editingAdmin.email}</p>
              </div>
              <button
                onClick={() => setEditingAdmin(null)}
                className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 flex-grow">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setEditRole('limited_admin')}
                  className={`p-3.5 rounded-2xl border text-left cursor-pointer ${
                    editRole === 'limited_admin'
                      ? 'bg-cyan-500/15 border-cyan-500 text-white'
                      : 'bg-white/5 border-white/10 text-gray-400'
                  }`}
                >
                  <div className="font-bold text-xs">Limited Administrator</div>
                </button>
                <button
                  type="button"
                  onClick={() => setEditRole('full_admin')}
                  className={`p-3.5 rounded-2xl border text-left cursor-pointer ${
                    editRole === 'full_admin'
                      ? 'bg-indigo-500/15 border-indigo-400 text-white'
                      : 'bg-white/5 border-white/10 text-gray-400'
                  }`}
                >
                  <div className="font-bold text-xs">Full Administrator</div>
                </button>
              </div>

              {editRole === 'limited_admin' && (
                <div className="border border-white/10 rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/10 text-gray-300 font-mono text-[10px] uppercase">
                        <th className="p-3">Section</th>
                        {PERMISSION_ACTIONS.map((a) => (
                          <th key={a.key} className="p-3 text-center">
                            {a.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {PERMISSION_SECTIONS.map((sec) => (
                        <tr key={sec.key}>
                          <td className="p-3 font-bold text-white">{sec.label}</td>
                          {PERMISSION_ACTIONS.map((act) => (
                            <td key={act.key} className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={Boolean(editPerms?.[sec.key]?.[act.key])}
                                onChange={() => togglePerm(sec.key, act.key)}
                                className="rounded border-white/20 bg-[#070a11] text-cyan-500 cursor-pointer"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-white/10 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingAdmin(null)}
                className="px-4 py-2 bg-white/5 text-gray-300 rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSavePermissions}
                className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl text-xs cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Permissions'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
