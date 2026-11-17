/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  User,
  ActionCodeSettings,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import {
  Lock,
  X,
  Eye,
  EyeOff,
  Mail,
  ShieldCheck,
  UserPlus,
  LogIn,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  LogOut,
  KeyRound,
  Crown,
  Copy,
  Check,
} from 'lucide-react';
import { auth, db, OWNER_EMAIL } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { validatePasswordStrength } from '../utils/permissions';
import { ReviewPeriodOption } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrors';

interface AdminAuthModalProps {
  onClose: () => void;
}

type ModalTab = 'owner' | 'signin' | 'register' | 'forgot';

const SHARED_PREVIEW_HOST = 'ais-pre-osrwhdpjdaiwpm22brawcx-378710074198.asia-southeast1.run.app';

export default function AdminAuthModal({ onClose }: AdminAuthModalProps) {
  const {
    user,
    adminProfile,
    adminRequest,
    adminDataLoading,
    firestoreAuthError,
    ownerVerificationError,
    redirectAuthError,
    clearRedirectAuthError,
    isOwnerEmailCandidate,
    isOwner,
    signOutAdmin,
    refreshAuthState,
  } = useAuth();

  const [tab, setTab] = useState<ModalTab>('owner');

  // Owner Sign In fields (intentionally blank on open; never prefill or expose Owner email)
  const [ownerEmailInput, setOwnerEmailInput] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [showOwnerPass, setShowOwnerPass] = useState(false);

  // Admin Sign In fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [rememberSession, setRememberSession] = useState(true);

  // Register (Request Admin Access) fields
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPass, setShowRegPass] = useState(false);

  // Forgot password
  const [forgotEmail, setForgotEmail] = useState('');

  // Status & feedback
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [ownerCredentialHelp, setOwnerCredentialHelp] = useState(false);
  const [unauthorizedDomainHost, setUnauthorizedDomainHost] = useState<string | null>(null);
  const [copiedDomain, setCopiedDomain] = useState<string | null>(null);
  const [requestSubmitError, setRequestSubmitError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const autoSubmittedUidRef = useRef<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // Surface any root Google redirect auth error
  useEffect(() => {
    if (!redirectAuthError) return;
    setErrorMsg(redirectAuthError);
    if (redirectAuthError.toLowerCase().includes('authorized domains')) {
      setUnauthorizedDomainHost(
        typeof window !== 'undefined' ? window.location.hostname : null
      );
    }
    clearRedirectAuthError();
  }, [redirectAuthError, clearRedirectAuthError]);

  // Automatically create an approval request once email is verified (NEVER for Owner email)
  useEffect(() => {
    if (!user || !user.emailVerified || isOwner || isOwnerEmailCandidate || adminDataLoading) return;
    if (adminProfile) return; // Already approved, suspended, or revoked
    if (adminRequest) return; // Already has a request (pending, rejected, expired)
    if (firestoreAuthError) return; // Cannot create/read requests until Firestore rules allow
    if (autoSubmittedUidRef.current === user.uid) return;

    autoSubmittedUidRef.current = user.uid;
    submitAdminApprovalRequest(false);
  }, [user, isOwner, isOwnerEmailCandidate, adminDataLoading, adminProfile, adminRequest, firestoreAuthError]);

  const computeExpirationDate = async (): Promise<Date> => {
    let period: ReviewPeriodOption = '7d';
    try {
      const cfgSnap = await getDoc(doc(db, 'adminConfig', 'settings'));
      if (cfgSnap.exists()) {
        const p = cfgSnap.data()?.reviewPeriod;
        if (p === '24h' || p === '3d' || p === '7d') period = p;
      }
    } catch {
      // Default 7d
    }
    const hours = period === '24h' ? 24 : period === '3d' ? 72 : 168;
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  };

  const submitAdminApprovalRequest = async (isResubmit: boolean) => {
    if (!user || !user.emailVerified || !user.email) return;
    if (user.email.toLowerCase() === OWNER_EMAIL.toLowerCase()) return;

    setSubmittingRequest(true);
    setErrorMsg('');
    setRequestSubmitError('');
    try {
      // Ensure Firebase ID token with email_verified=true is pushed to Firestore SDK before querying/writing
      const freshToken = await user.getIdToken(true);

      const existingSnap = await getDocs(
        query(collection(db, 'adminRequests'), where('uid', '==', user.uid))
      );
      const hasActivePending = existingSnap.docs.some((d) => {
        const data = d.data() as any;
        if (data.status !== 'pending') return false;
        const expMs = data.expiresAt?.toDate
          ? data.expiresAt.toDate().getTime()
          : new Date(data.expiresAt || 0).getTime();
        return !expMs || expMs > Date.now();
      });
      if (hasActivePending) {
        await refreshAuthState();
        return;
      }

      const requestId = `req_${user.uid}_${Date.now()}`;
      const expiresAtDate = await computeExpirationDate();
      const payload = {
        requestId,
        uid: user.uid,
        name: (user.displayName || user.email.split('@')[0] || 'Applicant').trim().slice(0, 120),
        email: user.email,
        verified: true,
        status: 'pending',
        requestedRole: 'limited_admin',
        requestedAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAtDate),
        notificationStatus: 'pending',
      };

      try {
        await setDoc(doc(db, 'adminRequests', requestId), payload);
      } catch (fsErr) {
        handleFirestoreError(fsErr, OperationType.CREATE, `adminRequests/${requestId}`);
      }

      const notifyResp = await fetch('/api/admin/requests/notify-owner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${freshToken}`,
        },
        body: JSON.stringify({ requestId }),
      });
      const notifyData = await notifyResp.json().catch(() => ({}));
      if (!notifyResp.ok) {
        setInfoMsg(
          notifyData?.message ||
            'Your request was saved in Firestore, though the owner email notification could not be dispatched automatically.'
        );
      } else if (notifyData?.notificationStatus && notifyData.notificationStatus !== 'sent') {
        setInfoMsg(
          'Your access request has been saved to Firestore for owner review. (Email notification to owner requires SMTP/Resend setup.)'
        );
      } else if (isResubmit) {
        setInfoMsg('Your new administrator access request has been submitted.');
      }
    } catch (err: any) {
      const msg = err?.message || 'Could not submit administrator access request.';
      setRequestSubmitError(msg);
      setErrorMsg(msg);
    } finally {
      setSubmittingRequest(false);
    }
  };

  function getPasswordResetActionCodeSettings(): ActionCodeSettings | undefined {
    if (typeof window === 'undefined') return undefined;
    const origin = window.location.origin;
    if (!origin || !/^https?:\/\//i.test(origin)) return undefined;
    return {
      url: `${origin}/`,
      handleCodeInApp: false,
    };
  }

  async function dispatchPasswordResetEmail(
    targetEmail: string
  ): Promise<{ usedFallbackContinueUrl: boolean }> {
    const actionCodeSettings = getPasswordResetActionCodeSettings();
    if (!actionCodeSettings) {
      await sendPasswordResetEmail(auth, targetEmail);
      return { usedFallbackContinueUrl: false };
    }
    try {
      await sendPasswordResetEmail(auth, targetEmail, actionCodeSettings);
      return { usedFallbackContinueUrl: false };
    } catch (err: any) {
      if (
        err?.code === 'auth/unauthorized-continue-uri' ||
        err?.code === 'auth/invalid-continue-uri'
      ) {
        await sendPasswordResetEmail(auth, targetEmail);
        return { usedFallbackContinueUrl: true };
      }
      throw err;
    }
  }

  function mapFirebaseAuthError(
    code: string,
    fallback: string,
    context: 'owner' | 'email' | 'google' = 'email'
  ) {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
    if (code === 'auth/unauthorized-domain' || code === 'auth/unauthorized-continue-uri') {
      setUnauthorizedDomainHost(host);
    } else {
      setUnauthorizedDomainHost(null);
    }

    if (
      (code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found') &&
      context === 'owner'
    ) {
      setOwnerCredentialHelp(true);
      return 'Owner sign-in failed. Either the password is incorrect, or this Owner email/password account has not been created in Firebase Console Authentication yet.';
    }

    setOwnerCredentialHelp(false);

    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Invalid email address or password. If you have not registered an administrator account yet, use Request Access or Forgot Password.';
      case 'auth/email-already-in-use':
        return 'An account with this email address already exists. Please sign in instead.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/weak-password':
        return 'Password does not meet security requirements.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a few minutes and try again.';
      case 'auth/operation-not-allowed':
        return context === 'google'
          ? 'Google Sign-In is not enabled in Firebase Console → Authentication → Sign-in method → Google.'
          : 'Email/Password sign-in is not enabled in Firebase Console → Authentication → Sign-in method.';
      case 'auth/unauthorized-domain':
        return `Google Sign-In blocked: hostname "${host}" is not authorized in Firebase Console → Authentication → Settings → Authorized domains.`;
      case 'auth/unauthorized-continue-uri':
        return `Continue URL hostname "${host}" is not authorized in Firebase Console → Authentication → Settings → Authorized domains.`;
      case 'auth/popup-blocked':
        return 'Sign-in popup was blocked by your browser. Redirecting to Google Sign-In...';
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        return 'Google sign-in window was closed before completing authentication.';
      case 'auth/account-exists-with-different-credential':
        return 'An account already exists with this email using a different sign-in method (such as Google or Email/Password).';
      case 'auth/network-request-failed':
        return 'Network error communicating with Firebase Authentication. Check your connection and try again.';
      default:
        return fallback;
    }
  }

  async function sendVerificationIfUnverified(signedUser: User) {
    if (signedUser.emailVerified) return;
    try {
      await sendEmailVerification(signedUser);
      setResendCooldown(60);
      setInfoMsg(
        `Verification link sent to ${signedUser.email}. Please verify your email address, then click "I've Verified My Email — Check Status".`
      );
    } catch (verifyErr: any) {
      if (verifyErr?.code === 'auth/too-many-requests') {
        setInfoMsg(
          `A verification email was recently sent to ${signedUser.email}. Check your inbox and spam folder.`
        );
      } else {
        setErrorMsg(
          verifyErr?.message || 'Signed in, but failed to dispatch email verification link.'
        );
      }
    }
  }

  const handleOwnerSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    setOwnerCredentialHelp(false);
    setUnauthorizedDomainHost(null);

    const normalizedEmail = ownerEmailInput.trim().toLowerCase();
    if (!normalizedEmail) {
      setErrorMsg('Please enter the Owner email address.');
      return;
    }
    if (normalizedEmail !== OWNER_EMAIL.toLowerCase()) {
      setErrorMsg(
        'This email is not authorized for Owner Login. Use the Admin Sign In tab for other administrator accounts.'
      );
      return;
    }
    if (!ownerPassword) {
      setErrorMsg('Please enter the Owner password.');
      return;
    }

    setLoading(true);
    try {
      await setPersistence(
        auth,
        rememberSession ? browserLocalPersistence : browserSessionPersistence
      );
      const cred = await signInWithEmailAndPassword(auth, normalizedEmail, ownerPassword);
      if (!cred.user.emailVerified) {
        await sendVerificationIfUnverified(cred.user);
      }
      await refreshAuthState();
    } catch (err: any) {
      setErrorMsg(mapFirebaseAuthError(err?.code, err?.message || 'Owner sign in failed.', 'owner'));
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    setOwnerCredentialHelp(false);
    setUnauthorizedDomainHost(null);

    const cleanEmail = loginEmail.trim().toLowerCase();
    if (!cleanEmail || !loginPassword) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      await setPersistence(
        auth,
        rememberSession ? browserLocalPersistence : browserSessionPersistence
      );
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, loginPassword);
      if (!cred.user.emailVerified) {
        await sendVerificationIfUnverified(cred.user);
      }
      await refreshAuthState();
    } catch (err: any) {
      setErrorMsg(mapFirebaseAuthError(err?.code, err?.message || 'Sign in failed.', 'email'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setInfoMsg('');
    setOwnerCredentialHelp(false);
    setUnauthorizedDomainHost(null);
    setLoading(true);
    try {
      await setPersistence(
        auth,
        rememberSession ? browserLocalPersistence : browserSessionPersistence
      );
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try {
        await signInWithPopup(auth, provider);
        await refreshAuthState();
      } catch (popupErr: any) {
        if (popupErr?.code === 'auth/popup-blocked') {
          setInfoMsg('Popup was blocked by browser; switching to Google redirect sign-in...');
          sessionStorage.setItem('pending_admin_auth_modal', '1');
          await signInWithRedirect(auth, provider);
          return;
        }
        throw popupErr;
      }
    } catch (err: any) {
      setErrorMsg(mapFirebaseAuthError(err?.code, err?.message || 'Google sign-in failed.', 'google'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    setOwnerCredentialHelp(false);
    setUnauthorizedDomainHost(null);

    const cleanName = regName.trim();
    const cleanEmail = regEmail.trim().toLowerCase();

    if (cleanName.length < 2) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (cleanEmail === OWNER_EMAIL.toLowerCase()) {
      setErrorMsg(
        `This email belongs to the website Owner. Please sign in on the Owner Login tab — the Owner never submits an approval request.`
      );
      return;
    }

    const strength = validatePasswordStrength(regPassword);
    if (!strength.valid) {
      setErrorMsg(`Password requirements: ${strength.errors.join(', ')}.`);
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await setPersistence(auth, browserSessionPersistence);
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, regPassword);
      await updateProfile(cred.user, { displayName: cleanName });
      await cred.user.reload();
      await sendEmailVerification(cred.user);
      setResendCooldown(60);
      setInfoMsg('Verification email sent! Please verify your email address before continuing.');
    } catch (err: any) {
      setErrorMsg(mapFirebaseAuthError(err?.code, err?.message || 'Registration failed.', 'email'));
    } finally {
      setLoading(false);
    }
  };

  const sendOwnerPasswordReset = async () => {
    setErrorMsg('');
    setInfoMsg('');
    const enteredEmail = ownerEmailInput.trim();
    if (!enteredEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(enteredEmail)) {
      setErrorMsg('Please enter the Owner email address in the Owner Email field first.');
      return;
    }
    if (enteredEmail.toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
      setErrorMsg('Entered email does not match the configured Owner account.');
      return;
    }

    setLoading(true);
    try {
      const { usedFallbackContinueUrl } = await dispatchPasswordResetEmail(enteredEmail);
      setOwnerCredentialHelp(false);
      setInfoMsg(
        usedFallbackContinueUrl
          ? `Password reset / setup email sent to ${enteredEmail} (if an Auth user exists for that address). Add this domain to Firebase Console → Authentication → Settings → Authorized domains so reset links return directly here.`
          : `Password reset / setup email sent to ${enteredEmail} (if an Auth user exists for that address). Check your inbox and spam folder.`
      );
    } catch (err: any) {
      setErrorMsg(mapFirebaseAuthError(err?.code, err?.message || 'Could not send reset email.', 'owner'));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    const enteredEmail = forgotEmail.trim();
    if (!enteredEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(enteredEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const { usedFallbackContinueUrl } = await dispatchPasswordResetEmail(enteredEmail);
      setInfoMsg(
        usedFallbackContinueUrl
          ? 'Password reset email sent! Check your inbox for reset instructions. (Add this domain to Firebase Authorized domains to redirect back here after reset.)'
          : 'Password reset email sent! Check your inbox for reset instructions.'
      );
    } catch (err: any) {
      setErrorMsg(mapFirebaseAuthError(err?.code, err?.message || 'Could not send reset email.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!auth.currentUser || resendCooldown > 0) return;
    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);
    try {
      await sendEmailVerification(auth.currentUser);
      setResendCooldown(60);
      setInfoMsg('Verification email resent! Please check your inbox and spam folder.');
    } catch (err: any) {
      setErrorMsg(
        mapFirebaseAuthError(err?.code, err?.message || 'Unable to resend verification email right now.')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCheckVerification = async () => {
    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);
    try {
      await refreshAuthState();
      if (!auth.currentUser?.emailVerified) {
        setErrorMsg('Your email is not verified yet. Please click the verification link sent to your email.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to refresh verification status.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyDomain = async (domain: string) => {
    try {
      await navigator.clipboard.writeText(domain);
      setCopiedDomain(domain);
      setTimeout(() => setCopiedDomain(null), 2000);
    } catch {
      // Clipboard blocked
    }
  };

  const passwordStrength = validatePasswordStrength(regPassword);
  const isExpiredRequest =
    adminRequest?.status === 'expired' ||
    (adminRequest?.status === 'pending' &&
      adminRequest.expiresAt &&
      new Date(adminRequest.expiresAt).getTime() < Date.now());

  return (
    <div
      id="admin-auth-overlay"
      className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 overflow-y-auto p-4 md:p-8 flex items-center justify-center"
    >
      <div className="bg-[#0c1220] border border-white/10 p-6 md:p-8 rounded-3xl max-w-md w-full shadow-2xl animate-scale-up relative">
        <button
          id="close-admin-gate-btn"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white cursor-pointer"
          title="Close"
        >
          <X size={16} />
        </button>

        {/* === SIGNED IN: EMAIL NOT VERIFIED (Owner or Admin Applicant) === */}
        {user && !user.emailVerified && (
          <div className="text-center space-y-4">
            <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
              <Mail size={28} />
            </div>
            <h3 className="text-white font-sans font-black text-xl">
              {isOwnerEmailCandidate ? 'Verify Owner Email Address' : 'Verification Email Sent'}
            </h3>
            <p className="text-gray-300 text-xs leading-relaxed">
              We sent a verification link to{' '}
              <strong className="text-cyan-400 font-mono">{user.email}</strong>.
              {isOwnerEmailCandidate
                ? ' Click the verification link in your inbox, then press Check Status below to verify your Owner UID and open the Owner Dashboard immediately.'
                : ' Please open your email and click the verification link before submitting your administrator access request.'}
            </p>

            {errorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
                {errorMsg}
              </div>
            )}
            {infoMsg && (
              <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-xs">
                {infoMsg}
              </div>
            )}

            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                disabled={loading}
                onClick={handleCheckVerification}
                className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                {isOwnerEmailCandidate
                  ? "I've Verified My Email — Enter Owner Dashboard"
                  : "I've Verified My Email — Check Status"}
              </button>

              <button
                type="button"
                disabled={loading || resendCooldown > 0}
                onClick={handleResendVerification}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {resendCooldown > 0
                  ? `Resend Verification Email (${resendCooldown}s)`
                  : 'Resend Verification Email'}
              </button>

              <button
                type="button"
                onClick={() => signOutAdmin()}
                className="w-full py-2 text-red-400 hover:text-red-300 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogOut size={13} /> Sign Out
              </button>
            </div>
          </div>
        )}

        {/* === SIGNED IN & VERIFIED OWNER CANDIDATE (VERIFYING BACKEND UID & ROLE — NEVER APPROVAL FLOW) === */}
        {user && user.emailVerified && isOwnerEmailCandidate && !isOwner && (
          <div className="text-center space-y-4">
            {adminDataLoading ? (
              <div className="py-10 space-y-3">
                <RefreshCw size={28} className="text-purple-400 animate-spin mx-auto" />
                <p className="text-gray-200 text-xs font-mono">
                  Verifying immutable Owner UID &amp; role on backend...
                </p>
              </div>
            ) : (
              <>
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
                  <AlertTriangle size={28} />
                </div>
                <h3 className="text-white font-sans font-black text-xl">
                  Owner Backend Verification Failed
                </h3>
                <p className="text-gray-300 text-xs leading-relaxed">
                  Owner access is never granted automatically by email alone. Backend verification of your Firebase UID and <code className="text-cyan-300">owner</code> role returned an error:
                </p>
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs text-left break-words">
                  {ownerVerificationError ||
                    firestoreAuthError ||
                    'Could not verify immutable Owner UID and active Owner role in Firestore.'}
                </div>
                <div className="space-y-2.5 pt-1">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleCheckVerification}
                    className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                    Retry Owner Verification
                  </button>
                  <button
                    type="button"
                    onClick={() => signOutAdmin()}
                    className="w-full py-2.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <LogOut size={13} /> Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* === SIGNED IN & VERIFIED NON-OWNER: LOADING / PENDING / REJECTED / SUSPENDED === */}
        {user && user.emailVerified && !isOwnerEmailCandidate && !isOwner && (
          <div className="text-center space-y-4">
            {adminDataLoading || submittingRequest ? (
              <div className="py-10 space-y-3">
                <RefreshCw size={28} className="text-cyan-400 animate-spin mx-auto" />
                <p className="text-gray-300 text-xs font-mono">Checking administrator authorization...</p>
              </div>
            ) : adminProfile?.status === 'suspended' || adminProfile?.status === 'revoked' ? (
              <>
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
                  <AlertTriangle size={28} />
                </div>
                <h3 className="text-white font-sans font-black text-xl">
                  Access {adminProfile.status === 'suspended' ? 'Suspended' : 'Revoked'}
                </h3>
                <p className="text-gray-300 text-xs leading-relaxed">
                  Your administrator access for <strong className="text-white">{user.email}</strong> has been{' '}
                  {adminProfile.status} by the website owner.
                </p>
                <button
                  type="button"
                  onClick={() => signOutAdmin()}
                  className="w-full py-2.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut size={14} /> Sign Out
                </button>
              </>
            ) : adminRequest?.status === 'rejected' ? (
              <>
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
                  <AlertTriangle size={28} />
                </div>
                <h3 className="text-white font-sans font-black text-xl">Request Not Approved</h3>
                <p className="text-gray-300 text-xs leading-relaxed">
                  Your administrator access request was not approved.
                </p>
                {adminRequest.rejectionReason && (
                  <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-left text-xs text-gray-300">
                    <span className="text-gray-500 font-mono text-[10px] uppercase block mb-1">Reason</span>
                    {adminRequest.rejectionReason}
                  </div>
                )}
                <div className="bg-[#070a11] border border-white/5 rounded-xl p-3.5 text-left space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Account Email</span>
                    <span className="text-gray-200">{user.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Request Status</span>
                    <span className="text-red-400 font-bold uppercase">Rejected</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => signOutAdmin()}
                  className="w-full py-2.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut size={14} /> Sign Out
                </button>
              </>
            ) : isExpiredRequest ? (
              <>
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
                  <Clock size={28} />
                </div>
                <h3 className="text-white font-sans font-black text-xl">Request Expired</h3>
                <p className="text-gray-300 text-xs leading-relaxed">
                  Your previous administrator access request expired without review. You may submit a new request for review.
                </p>
                {errorMsg && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
                    {errorMsg}
                  </div>
                )}
                <div className="space-y-2.5 pt-2">
                  <button
                    type="button"
                    disabled={submittingRequest}
                    onClick={() => submitAdminApprovalRequest(true)}
                    className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Submit New Access Request
                  </button>
                  <button
                    type="button"
                    onClick={() => signOutAdmin()}
                    className="w-full py-2 text-red-400 hover:text-red-300 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <LogOut size={13} /> Sign Out
                  </button>
                </div>
              </>
            ) : !adminRequest || requestSubmitError || firestoreAuthError ? (
              <>
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
                  <AlertTriangle size={28} />
                </div>
                <h3 className="text-white font-sans font-black text-xl">
                  Administrator Request Not Submitted
                </h3>
                <p className="text-gray-300 text-xs leading-relaxed">
                  Your email (<strong className="text-white">{user.email}</strong>) is verified, but we could not save your approval request to Firestore yet.
                </p>
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs text-left break-words">
                  {firestoreAuthError ||
                    requestSubmitError ||
                    errorMsg ||
                    'No adminRequests record exists for your account yet.'}
                </div>
                <div className="space-y-2.5 pt-1">
                  <button
                    type="button"
                    disabled={submittingRequest}
                    onClick={() => {
                      autoSubmittedUidRef.current = null;
                      submitAdminApprovalRequest(true);
                    }}
                    className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw size={13} className={submittingRequest ? 'animate-spin' : ''} />
                    Retry Access Request Submission
                  </button>
                  <button
                    type="button"
                    onClick={() => signOutAdmin()}
                    className="w-full py-2.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <LogOut size={13} />
                    Sign Out
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={28} />
                </div>
                <h3 className="text-white font-sans font-black text-xl">Request Pending Approval</h3>
                <div className="text-gray-300 text-xs leading-relaxed space-y-2 text-left bg-white/5 border border-white/10 rounded-2xl p-4">
                  <p className="text-green-400 font-semibold">
                    Your email has been verified successfully.
                  </p>
                  <p>
                    Your administrator access request has been submitted to the website owner and is currently awaiting approval. You will receive an email after the owner reviews your request.
                  </p>
                  <p className="text-cyan-300 font-mono text-[11px] pt-1">
                    Expected review time: 24 hours to 7 days.
                  </p>
                </div>

                {errorMsg && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
                    {errorMsg}
                  </div>
                )}
                {infoMsg && (
                  <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-xs">
                    {infoMsg}
                  </div>
                )}

                <div className="bg-[#070a11] border border-white/5 rounded-xl p-3.5 text-left space-y-2 text-xs font-mono">
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500">Account Email</span>
                    <span className="text-gray-200 truncate">{user.email}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500">Request Status</span>
                    <span className="text-amber-400 font-bold uppercase">{adminRequest.status}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500">Submission Date</span>
                    <span className="text-gray-300">
                      {adminRequest.requestedAt
                        ? new Date(adminRequest.requestedAt).toLocaleDateString()
                        : new Date().toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleCheckVerification}
                    className="flex-1 py-2.5 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                    Check Status
                  </button>
                  <button
                    type="button"
                    onClick={() => signOutAdmin()}
                    className="flex-1 py-2.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <LogOut size={13} />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* === SIGNED OUT: OWNER LOGIN / ADMIN SIGN IN / REQUEST ACCESS / FORGOT PASSWORD === */}
        {!user && (
          <>
            <div className="text-center mb-5">
              <div
                className={`p-3.5 border rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-3 ${
                  tab === 'owner'
                    ? 'bg-purple-500/10 border-purple-500/25 text-purple-400'
                    : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
                }`}
              >
                {tab === 'owner' ? (
                  <Crown size={24} />
                ) : tab === 'register' ? (
                  <UserPlus size={24} />
                ) : tab === 'forgot' ? (
                  <KeyRound size={24} />
                ) : (
                  <Lock size={24} />
                )}
              </div>
              <h3 className="text-white font-sans font-black text-lg">
                {tab === 'owner' ? 'Website Owner Login' : 'Administrator Portal'}
              </h3>
              <p className="text-gray-400 text-xs mt-1">
                {tab === 'owner'
                  ? 'Direct verified sign-in for the primary Owner account.'
                  : 'Sign in with an approved account or request administrator access.'}
              </p>
            </div>

            {tab !== 'forgot' && (
              <div className="grid grid-cols-3 gap-1 p-1 bg-[#070a11] border border-white/10 rounded-xl mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setTab('owner');
                    setErrorMsg('');
                    setInfoMsg('');
                    setOwnerCredentialHelp(false);
                    setUnauthorizedDomainHost(null);
                  }}
                  className={`py-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    tab === 'owner'
                      ? 'bg-purple-500 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Crown size={12} /> Owner
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab('signin');
                    setErrorMsg('');
                    setInfoMsg('');
                    setOwnerCredentialHelp(false);
                    setUnauthorizedDomainHost(null);
                  }}
                  className={`py-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    tab === 'signin'
                      ? 'bg-cyan-500 text-black'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <LogIn size={12} /> Admin
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab('register');
                    setErrorMsg('');
                    setInfoMsg('');
                    setOwnerCredentialHelp(false);
                    setUnauthorizedDomainHost(null);
                  }}
                  className={`py-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    tab === 'register'
                      ? 'bg-cyan-500 text-black'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <UserPlus size={12} /> Request
                </button>
              </div>
            )}

            {errorMsg && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs space-y-2">
                <div>{errorMsg}</div>

                {ownerCredentialHelp && (
                  <div className="pt-2 border-t border-red-500/20 text-[11px] text-gray-200 space-y-2">
                    <div className="font-bold text-amber-300">
                      How to provision or recover your Owner password:
                    </div>
                    <ol className="list-decimal pl-4 space-y-1 text-gray-300">
                      <li>
                        Open <strong>Firebase Console → Authentication → Users</strong>.
                      </li>
                      <li>
                        If the Owner email is not listed with Email/Password, click <strong>Add user</strong>, enter the configured Owner email and a strong password.
                      </li>
                      <li>
                        If it already exists (e.g. from Google Sign-In) or you forgot the password, click below to send a Password Setup / Reset link to the entered email:
                      </li>
                    </ol>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={sendOwnerPasswordReset}
                      className="w-full py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 rounded-lg text-[11px] font-bold cursor-pointer disabled:opacity-50"
                    >
                      Send Password Reset / Setup Email
                    </button>
                  </div>
                )}

                {unauthorizedDomainHost && (
                  <div className="pt-2 border-t border-red-500/20 text-[11px] text-gray-200 space-y-2">
                    <div className="font-bold text-amber-300">
                      Add these hostnames in Firebase Console → Authentication → Settings → Authorized domains:
                    </div>
                    {[unauthorizedDomainHost, SHARED_PREVIEW_HOST]
                      .filter((h, i, arr) => h && arr.indexOf(h) === i)
                      .map((host) => (
                        <div
                          key={host}
                          className="flex items-center justify-between gap-2 bg-[#070a11] border border-white/10 px-2.5 py-1.5 rounded-lg font-mono text-[10px]"
                        >
                          <span className="truncate text-cyan-300">{host}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyDomain(host)}
                            className="p-1 text-gray-300 hover:text-white cursor-pointer flex-shrink-0"
                            title="Copy hostname"
                          >
                            {copiedDomain === host ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {infoMsg && (
              <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-xs">
                {infoMsg}
              </div>
            )}

            {/* === TAB 1: DEDICATED OWNER LOGIN === */}
            {tab === 'owner' && (
              <form onSubmit={handleOwnerSignIn} className="space-y-4">
                <div>
                  <label className="block text-gray-400 text-[11px] font-semibold uppercase mb-1.5">
                    Owner Email Address
                  </label>
                  <input
                    id="owner-login-email"
                    type="email"
                    required
                    autoComplete="off"
                    value={ownerEmailInput}
                    onChange={(e) => setOwnerEmailInput(e.target.value)}
                    placeholder="Enter owner email"
                    className="w-full px-3.5 py-2.5 bg-[#070a11] border border-purple-500/25 rounded-xl text-xs text-white font-mono placeholder-gray-600 focus:outline-none focus:border-purple-400"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-[11px] font-semibold uppercase mb-1.5">
                    Owner Password
                  </label>
                  <div className="relative">
                    <input
                      id="owner-login-password"
                      type={showOwnerPass ? 'text' : 'password'}
                      required
                      value={ownerPassword}
                      onChange={(e) => setOwnerPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 pr-10 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOwnerPass(!showOwnerPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 cursor-pointer"
                      aria-label={showOwnerPass ? 'Hide password' : 'Show password'}
                    >
                      {showOwnerPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberSession}
                      onChange={(e) => setRememberSession(e.target.checked)}
                      className="rounded border-white/10 bg-[#070a11] text-purple-500"
                    />
                    Remember session
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(ownerEmailInput.trim());
                      setTab('forgot');
                      setErrorMsg('');
                      setInfoMsg('');
                      setOwnerCredentialHelp(false);
                    }}
                    className="text-purple-300 hover:text-purple-200 underline cursor-pointer"
                  >
                    Forgot / Set Password?
                  </button>
                </div>

                <button
                  id="owner-signin-submit"
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Verifying Owner...' : 'Sign In as Owner'}
                </button>

                <div className="relative flex items-center py-1">
                  <div className="flex-grow border-t border-white/10" />
                  <span className="px-3 text-[10px] font-mono text-gray-500 uppercase">or</span>
                  <div className="flex-grow border-t border-white/10" />
                </div>

                <button
                  type="button"
                  disabled={loading}
                  onClick={handleGoogleSignIn}
                  className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <ShieldCheck size={14} className="text-purple-400" />
                  Sign In with Google
                </button>
              </form>
            )}

            {/* === TAB 2: APPROVED ADMIN SIGN IN === */}
            {tab === 'signin' && (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="block text-gray-400 text-[11px] font-semibold uppercase mb-1.5">
                    Email Address
                  </label>
                  <input
                    id="admin-login-email"
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2.5 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-[11px] font-semibold uppercase mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="admin-login-password"
                      type={showLoginPass ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 pr-10 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPass(!showLoginPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 cursor-pointer"
                      aria-label={showLoginPass ? 'Hide password' : 'Show password'}
                    >
                      {showLoginPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberSession}
                      onChange={(e) => setRememberSession(e.target.checked)}
                      className="rounded border-white/10 bg-[#070a11] text-cyan-500"
                    />
                    Remember session
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(loginEmail);
                      setTab('forgot');
                      setErrorMsg('');
                      setInfoMsg('');
                      setOwnerCredentialHelp(false);
                    }}
                    className="text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  id="admin-signin-submit"
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Signing In...' : 'Sign In'}
                </button>

                <div className="relative flex items-center py-1">
                  <div className="flex-grow border-t border-white/10" />
                  <span className="px-3 text-[10px] font-mono text-gray-500 uppercase">or</span>
                  <div className="flex-grow border-t border-white/10" />
                </div>

                <button
                  type="button"
                  disabled={loading}
                  onClick={handleGoogleSignIn}
                  className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <ShieldCheck size={14} className="text-cyan-400" />
                  Sign In with Google
                </button>
              </form>
            )}

            {/* === TAB 3: REQUEST ADMIN ACCESS (APPROVAL WORKFLOW) === */}
            {tab === 'register' && (
              <form onSubmit={handleRegister} className="space-y-3.5">
                <div>
                  <label className="block text-gray-400 text-[11px] font-semibold uppercase mb-1">
                    Full Name
                  </label>
                  <input
                    id="admin-reg-name"
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full px-3.5 py-2 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-[11px] font-semibold uppercase mb-1">
                    Email Address
                  </label>
                  <input
                    id="admin-reg-email"
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-[11px] font-semibold uppercase mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="admin-reg-password"
                      type={showRegPass ? 'text' : 'password'}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Create a strong password"
                      className="w-full px-3.5 py-2 pr-10 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPass(!showRegPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 cursor-pointer"
                    >
                      {showRegPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {regPassword && !passwordStrength.valid && (
                    <p className="text-[10px] text-amber-400 mt-1">
                      Needs: {passwordStrength.errors.join(', ')}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-400 text-[11px] font-semibold uppercase mb-1">
                    Confirm Password
                  </label>
                  <input
                    id="admin-reg-confirm"
                    type={showRegPass ? 'text' : 'password'}
                    required
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full px-3.5 py-2 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <button
                  id="admin-register-submit"
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Submitting...' : 'Request Admin Access'}
                </button>
              </form>
            )}

            {/* === TAB 4: FORGOT / RESET PASSWORD === */}
            {tab === 'forgot' && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <p className="text-gray-400 text-xs text-center">
                  Enter your account email and we will send a password reset link.
                </p>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-2.5 bg-[#070a11] border border-white/10 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Send Password Reset Email'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab('owner');
                    setErrorMsg('');
                    setInfoMsg('');
                    setOwnerCredentialHelp(false);
                  }}
                  className="w-full text-center text-gray-400 hover:text-white text-xs cursor-pointer"
                >
                  Back to Sign In
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
