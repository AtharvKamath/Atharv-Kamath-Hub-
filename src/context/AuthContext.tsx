/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  getRedirectResult,
} from 'firebase/auth';
import {
  doc,
  onSnapshot,
  collection,
  query,
  where,
  updateDoc,
  serverTimestamp,
  orderBy,
  limit,
} from 'firebase/firestore';
import { auth, db, OWNER_EMAIL } from '../firebase';
import {
  AdminRequest,
  AdminUser,
  PermissionAction,
  PermissionSection,
} from '../types';
import { hasAdminPermission } from '../utils/permissions';

interface AuthContextValue {
  user: User | null;
  idToken: string | null;
  authLoading: boolean;
  adminProfile: AdminUser | null;
  adminRequest: AdminRequest | null;
  adminDataLoading: boolean;
  firestoreAuthError: string | null;
  ownerVerificationError: string | null;
  redirectAuthError: string | null;
  clearRedirectAuthError: () => void;
  isOwnerEmailCandidate: boolean;
  isOwner: boolean;
  isAuthorizedAdmin: boolean;
  hasPermission: (section: PermissionSection, action: PermissionAction) => boolean;
  signOutAdmin: () => Promise<void>;
  refreshAuthState: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authRevision, setAuthRevision] = useState(0);
  const [adminProfile, setAdminProfile] = useState<AdminUser | null>(null);
  const [ownerVerifiedUid, setOwnerVerifiedUid] = useState<string | null>(null);
  const [ownerVerifiedProfile, setOwnerVerifiedProfile] = useState<AdminUser | null>(null);
  const [ownerVerificationError, setOwnerVerificationError] = useState<string | null>(null);
  const [redirectAuthError, setRedirectAuthError] = useState<string | null>(null);
  const [adminRequest, setAdminRequest] = useState<AdminRequest | null>(null);
  const [adminDataLoading, setAdminDataLoading] = useState(false);
  const [firestoreAuthError, setFirestoreAuthError] = useState<string | null>(null);

  const isOwnerEmailCandidate = Boolean(
    user &&
      user.email &&
      user.email.toLowerCase() === OWNER_EMAIL.toLowerCase()
  );

  const effectiveAdminProfile =
    adminProfile ||
    (ownerVerifiedProfile && user && ownerVerifiedProfile.uid === user.uid
      ? ownerVerifiedProfile
      : null);

  // Security rule: NEVER grant Owner purely from email string.
  // Requires verified email + backend UID/role verification + active 'owner' record matching user.uid.
  const isOwner = Boolean(
    user &&
      user.emailVerified &&
      isOwnerEmailCandidate &&
      ownerVerifiedUid === user.uid &&
      effectiveAdminProfile?.uid === user.uid &&
      effectiveAdminProfile?.role === 'owner' &&
      effectiveAdminProfile?.status === 'active'
  );

  const isAuthorizedAdmin = Boolean(
    user &&
      user.emailVerified &&
      (isOwner ||
        (effectiveAdminProfile?.status === 'active' &&
          (effectiveAdminProfile.role === 'full_admin' ||
            effectiveAdminProfile.role === 'limited_admin')))
  );

  const clearRedirectAuthError = useCallback(() => {
    setRedirectAuthError(null);
  }, []);

  const refreshAuthState = useCallback(async () => {
    const current = auth.currentUser;
    if (!current) {
      setUser(null);
      setIdToken(null);
      setAdminProfile(null);
      setOwnerVerifiedUid(null);
      setOwnerVerifiedProfile(null);
      setOwnerVerificationError(null);
      setAdminRequest(null);
      setFirestoreAuthError(null);
      return;
    }
    await current.reload();
    const freshToken = await current.getIdToken(true);
    setUser(current);
    setIdToken(freshToken);
    setAuthRevision((r) => r + 1);
  }, []);

  // Centralized Firebase Auth state listener & root redirect result handler
  useEffect(() => {
    sessionStorage.removeItem('admin_authorized');

    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          await result.user.reload();
          const token = await result.user.getIdToken(true);
          setUser(result.user);
          setIdToken(token);
          setAuthRevision((r) => r + 1);
        }
      })
      .catch((err: any) => {
        const code = err?.code || '';
        const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
        if (code === 'auth/unauthorized-domain') {
          setRedirectAuthError(
            `This domain (${host}) is not listed in Firebase Console → Authentication → Settings → Authorized domains.`
          );
        } else if (err?.message) {
          setRedirectAuthError(err.message);
        }
      });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setIdToken(null);
        setAdminProfile(null);
        setOwnerVerifiedUid(null);
        setOwnerVerifiedProfile(null);
        setOwnerVerificationError(null);
        setAdminRequest(null);
        setFirestoreAuthError(null);
        setAuthLoading(false);
        return;
      }

      setUser(firebaseUser);
      try {
        const token = await firebaseUser.getIdToken();
        setIdToken(token);
      } catch {
        setIdToken(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Backend Owner UID/role verification + Firestore listeners for verified signed-in user
  useEffect(() => {
    if (!user || !user.emailVerified) {
      setAdminProfile(null);
      setOwnerVerifiedUid(null);
      setOwnerVerifiedProfile(null);
      setOwnerVerificationError(null);
      setAdminRequest(null);
      setFirestoreAuthError(null);
      setAdminDataLoading(false);
      return;
    }

    let cancelled = false;
    setAdminDataLoading(true);
    setFirestoreAuthError(null);
    setOwnerVerificationError(null);

    const matchesOwnerEmail =
      Boolean(user.email) && user.email!.toLowerCase() === OWNER_EMAIL.toLowerCase();

    let profileLoaded = false;
    let requestLoaded = !matchesOwnerEmail ? false : true; // Owner never uses approval requests
    let ownerVerifyLoaded = !matchesOwnerEmail;

    const markDone = () => {
      if (profileLoaded && requestLoaded && ownerVerifyLoaded && !cancelled) {
        setAdminDataLoading(false);
      }
    };

    if (matchesOwnerEmail && idToken) {
      fetch('/api/admin/owner/verify', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      })
        .then(async (resp) => {
          if (cancelled) return;
          const body = await resp.json().catch(() => ({}));
          if (resp.ok && body?.success && body?.verifiedOwner && body?.ownerUid === user.uid) {
            setOwnerVerifiedUid(user.uid);
            if (body.profile) {
              setOwnerVerifiedProfile(body.profile as AdminUser);
            }
            setOwnerVerificationError(null);
          } else {
            setOwnerVerifiedUid(null);
            setOwnerVerifiedProfile(null);
            setOwnerVerificationError(
              body?.message || `Backend Owner verification failed (HTTP ${resp.status}).`
            );
          }
        })
        .catch((err) => {
          if (cancelled) return;
          setOwnerVerifiedUid(null);
          setOwnerVerificationError(err?.message || 'Unable to verify Owner UID on backend.');
        })
        .finally(() => {
          ownerVerifyLoaded = true;
          markDone();
        });
    } else if (matchesOwnerEmail && !idToken) {
      ownerVerifyLoaded = false;
    }

    const adminDocRef = doc(db, 'adminUsers', user.uid);
    const unsubProfile = onSnapshot(
      adminDocRef,
      (snap) => {
        if (snap.exists()) {
          setAdminProfile(snap.data() as AdminUser);
        } else {
          setAdminProfile(null);
        }
        profileLoaded = true;
        markDone();
      },
      (error) => {
        console.warn('Admin profile listener:', error.message);
        if (error.message.toLowerCase().includes('permission')) {
          setFirestoreAuthError(
            `Firestore permission denied reading adminUsers/${user.uid}. Ensure firestore.rules are deployed to Firebase project atharv-kamath.`
          );
        }
        setAdminProfile(null);
        profileLoaded = true;
        markDone();
      }
    );

    let unsubRequest: (() => void) | null = null;
    let unsubFallbackRequest: (() => void) | null = null;

    if (!matchesOwnerEmail) {
      const reqQuery = query(
        collection(db, 'adminRequests'),
        where('uid', '==', user.uid),
        orderBy('requestedAt', 'desc'),
        limit(1)
      );

      unsubRequest = onSnapshot(
        reqQuery,
        (snap) => {
          if (!snap.empty) {
            const docData = snap.docs[0].data() as any;
            const normalized: AdminRequest = {
              ...docData,
              requestedAt: docData.requestedAt?.toDate
                ? docData.requestedAt.toDate().toISOString()
                : String(docData.requestedAt || ''),
              expiresAt: docData.expiresAt?.toDate
                ? docData.expiresAt.toDate().toISOString()
                : String(docData.expiresAt || ''),
              reviewedAt: docData.reviewedAt?.toDate
                ? docData.reviewedAt.toDate().toISOString()
                : docData.reviewedAt,
            };
            setAdminRequest(normalized);
          } else {
            setAdminRequest(null);
          }
          requestLoaded = true;
          markDone();
        },
        (error) => {
          console.warn('Admin request listener fallback:', error.message);
          const simpleQuery = query(collection(db, 'adminRequests'), where('uid', '==', user.uid));
          unsubFallbackRequest?.();
          unsubFallbackRequest = onSnapshot(
            simpleQuery,
            (simpleSnap) => {
              if (!simpleSnap.empty) {
                const all = simpleSnap.docs.map((d) => {
                  const docData = d.data() as any;
                  return {
                    ...docData,
                    requestedAt: docData.requestedAt?.toDate
                      ? docData.requestedAt.toDate().toISOString()
                      : String(docData.requestedAt || ''),
                    expiresAt: docData.expiresAt?.toDate
                      ? docData.expiresAt.toDate().toISOString()
                      : String(docData.expiresAt || ''),
                  } as AdminRequest;
                });
                all.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
                setAdminRequest(all[0] || null);
              } else {
                setAdminRequest(null);
              }
              requestLoaded = true;
              markDone();
            },
            (fallbackErr) => {
              if (fallbackErr.message.toLowerCase().includes('permission')) {
                setFirestoreAuthError(
                  `Firestore permission denied reading adminRequests. Ensure firestore.rules are deployed to Firebase project atharv-kamath.`
                );
              }
              setAdminRequest(null);
              requestLoaded = true;
              markDone();
            }
          );
        }
      );
    } else {
      setAdminRequest(null);
    }

    return () => {
      cancelled = true;
      unsubProfile();
      unsubRequest?.();
      unsubFallbackRequest?.();
    };
  }, [user?.uid, user?.emailVerified, user?.email, idToken, authRevision]);

  // Update lastLoginAt when an active non-owner admin logs in
  useEffect(() => {
    if (!user || !user.emailVerified || !effectiveAdminProfile || effectiveAdminProfile.status !== 'active') return;
    if (isOwner) return;
    const sessionKey = `last_login_recorded_${user.uid}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, '1');
    updateDoc(doc(db, 'adminUsers', user.uid), {
      lastLoginAt: serverTimestamp(),
    }).catch(() => {});
  }, [user, effectiveAdminProfile, isOwner]);

  const signOutAdmin = useCallback(async () => {
    sessionStorage.removeItem('admin_authorized');
    sessionStorage.removeItem('pending_admin_auth_modal');
    if (user?.uid) {
      sessionStorage.removeItem(`last_login_recorded_${user.uid}`);
    }
    setAdminProfile(null);
    setOwnerVerifiedUid(null);
    setOwnerVerifiedProfile(null);
    setOwnerVerificationError(null);
    setAdminRequest(null);
    setFirestoreAuthError(null);
    setIdToken(null);
    await firebaseSignOut(auth);
    if (window.location.search.includes('page=admin') || window.location.hash === '#admin') {
      window.history.replaceState(null, '', '/');
    }
  }, [user?.uid]);

  const hasPermission = useCallback(
    (section: PermissionSection, action: PermissionAction) => {
      return hasAdminPermission(effectiveAdminProfile, isOwner, section, action);
    },
    [effectiveAdminProfile, isOwner]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        idToken,
        authLoading,
        adminProfile: effectiveAdminProfile,
        adminRequest,
        adminDataLoading,
        firestoreAuthError,
        ownerVerificationError,
        redirectAuthError,
        clearRedirectAuthError,
        isOwnerEmailCandidate,
        isOwner,
        isAuthorizedAdmin,
        hasPermission,
        signOutAdmin,
        refreshAuthState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
