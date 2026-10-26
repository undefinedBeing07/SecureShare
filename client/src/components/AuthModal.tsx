'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  User, 
  LogIn, 
  UserPlus, 
  ShieldCheck, 
  Users, 
  Key, 
  Check, 
  Copy, 
  Lock, 
  Mail, 
  ArrowRight,
  Shield,
  Trash2,
  ArrowLeft,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import { AuthUser, SavedAccount } from '../lib/types';
import { loginUser, registerUser, sendRegistrationOtp, verifyRegistrationOtp } from '../lib/api';

export type AuthTab = 'login' | 'register' | 'switch' | 'token';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser;
  currentToken?: string;
  onUserChange: (user: AuthUser, token?: string) => void;
  initialTab?: AuthTab;
  savedAccounts?: SavedAccount[];
  onRemoveSavedAccount?: (userId: string) => void;
}

export function AuthModal({
  isOpen,
  onClose,
  currentUser,
  currentToken = '',
  onUserChange,
  initialTab = 'login',
  savedAccounts = [],
  onRemoveSavedAccount
}: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<AuthTab>(initialTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedToken, setCopiedToken] = useState(false);

  // Registration OTP States
  type RegStep = 'form' | 'otp' | 'success';
  const [regStep, setRegStep] = useState<RegStep>('form');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveTab(initialTab);
    setErrorMessage('');
    setRegStep('form');
    setOtp('');
  }, [initialTab, isOpen]);

  // Resend cooldown countdown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Keyboard navigation: Escape key closes modal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await loginUser(email.trim(), password.trim());
      onUserChange(res.user, res.token);
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 1: Send 6-digit OTP code to email
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email.trim() || !displayName.trim() || !password.trim()) {
      setErrorMessage('Please fill in your name, email address, and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await sendRegistrationOtp(email.trim());
      setMaskedEmail(res.email || email.trim());
      setResendCooldown(res.cooldownSeconds || 60);
      setOtp('');
      setRegStep('otp');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to send verification code');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Resend OTP code
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isLoading) return;
    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await sendRegistrationOtp(email.trim());
      setMaskedEmail(res.email || email.trim());
      setResendCooldown(res.cooldownSeconds || 60);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to resend verification code');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Verify OTP and complete registration
  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.trim().length !== 6) {
      setErrorMessage('Please enter the complete 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      // 1. Verify OTP with server to get cryptographic verification token
      const verifyRes = await verifyRegistrationOtp(email.trim(), otp.trim());
      const token = verifyRes.verificationToken;

      // 2. Complete registration on backend with token proof
      const regRes = await registerUser(email.trim(), password.trim(), displayName.trim(), token);
      setRegStep('success');

      // Update active session
      onUserChange(regRes.user, regRes.token);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const displayAccounts = savedAccounts && savedAccounts.length > 0 
    ? savedAccounts 
    : [currentUser];

  const handleSwitchAccount = (targetUser: AuthUser) => {
    onUserChange(targetUser, targetUser.token || targetUser.userId);
    onClose();
  };

  const handleCopyToken = () => {
    if (!currentToken) return;
    navigator.clipboard.writeText(currentToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onClick={(e) => {
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
          onClose();
        }
      }}
    >
      <div 
        ref={modalRef}
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition-all"
      >
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 id="auth-modal-title" className="text-base font-bold text-slate-900">
                Authentication & Accounts
              </h2>
              <p className="text-xs text-slate-500">
                Session security, credentials, and fast account switching
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="mt-4 grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => { setActiveTab('login'); setErrorMessage(''); }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${
              activeTab === 'login'
                ? 'bg-white text-violet-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LogIn className="h-3.5 w-3.5" />
            <span>Sign In</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('register'); setErrorMessage(''); }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${
              activeTab === 'register'
                ? 'bg-white text-violet-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Register</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('switch'); setErrorMessage(''); }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${
              activeTab === 'switch'
                ? 'bg-white text-violet-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Switch</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('token'); setErrorMessage(''); }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${
              activeTab === 'token'
                ? 'bg-white text-violet-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Key className="h-3.5 w-3.5" />
            <span>Token</span>
          </button>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-start justify-between gap-3">
            <span className="leading-relaxed">{errorMessage}</span>
            {errorMessage.toLowerCase().includes('already registered') && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  setErrorMessage('');
                }}
                className="shrink-0 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 px-2.5 py-1 text-[11px] font-semibold transition-colors"
              >
                Sign In Instead
              </button>
            )}
          </div>
        )}

        {/* TAB 1: SIGN IN */}
        {activeTab === 'login' && (
          <form onSubmit={handleLogin} className="mt-5 space-y-4">
            
            {/* Quick Demo Fills */}
            <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3">
              <span className="text-[11px] font-semibold text-violet-900 block mb-2">
                Quick Demo Accounts (1-Click Fill):
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEmail('admin@secureshare.io');
                    setPassword('admin123');
                  }}
                  className="rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-[11px] font-medium text-violet-700 hover:bg-violet-50 transition-colors"
                >
                  Alex Chen (Admin)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('audit@secureshare.io');
                    setPassword('audit123');
                  }}
                  className="rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-[11px] font-medium text-violet-700 hover:bg-violet-50 transition-colors"
                >
                  Enterprise Auditor
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-slate-500" />
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@secureshare.io"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-slate-500" />
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors disabled:opacity-50"
            >
              <span>{isLoading ? 'Verifying Credentials...' : 'Sign In to Secure Vault'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        )}

        {/* TAB 2: REGISTER */}
        {activeTab === 'register' && (
          <div className="mt-5">
            {/* STATE A: REGISTRATION FORM */}
            {regStep === 'form' && (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-slate-500" />
                    Full Name / Display Name
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Jordan Lee"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-slate-500" />
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jordan@university.edu"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-slate-500" />
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a password"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 text-[11px] text-slate-600 flex items-start gap-2">
                  <Shield className="h-4 w-4 text-violet-600 shrink-0 mt-0.5" />
                  <span>
                    Zero-Trust Security: A secure 6-digit verification code will be sent to your email to verify ownership before account creation.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !email.trim() || !displayName.trim() || !password.trim()}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors disabled:opacity-50"
                >
                  <Mail className="h-4 w-4" />
                  <span>{isLoading ? 'Sending Verification Code...' : 'Send OTP to Verify Email'}</span>
                </button>
              </form>
            )}

            {/* STATE B: OTP VERIFICATION */}
            {regStep === 'otp' && (
              <form onSubmit={handleVerifyAndRegister} className="space-y-4">
                <div className="rounded-xl border border-violet-100 bg-violet-50/70 p-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-violet-700" />
                      <span className="text-xs font-bold text-violet-900">Verification Code Sent</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setRegStep('form');
                        setErrorMessage('');
                      }}
                      className="text-[11px] font-medium text-violet-700 hover:text-violet-900 flex items-center gap-1"
                    >
                      <ArrowLeft className="h-3 w-3" />
                      <span>Change email</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-violet-800/90 mt-1 leading-normal">
                    We sent a 6-digit code to <strong className="font-semibold text-violet-950">{maskedEmail || email}</strong>. The code expires in 5 minutes.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Key className="h-3.5 w-3.5 text-slate-500" />
                      Enter 6-Digit Code
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal">Check inbox & spam</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoFocus
                    required
                    value={otp}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setOtp(val);
                    }}
                    placeholder="123456"
                    className="w-full text-center tracking-[0.5em] font-mono text-xl font-bold rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-slate-900 placeholder:text-slate-300 placeholder:tracking-normal focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || otp.trim().length !== 6}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  <span>{isLoading ? 'Verifying & Creating Account...' : 'Verify Email & Create Account'}</span>
                </button>

                <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setRegStep('form');
                      setErrorMessage('');
                    }}
                    className="text-slate-500 hover:text-slate-700 flex items-center gap-1 font-medium"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back to Details</span>
                  </button>

                  <button
                    type="button"
                    disabled={resendCooldown > 0 || isLoading}
                    onClick={handleResendOtp}
                    className={`flex items-center gap-1 font-medium transition-colors ${
                      resendCooldown > 0
                        ? 'text-slate-400 cursor-not-allowed'
                        : 'text-violet-600 hover:text-violet-800'
                    }`}
                  >
                    <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
                    <span>
                      {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend OTP Code'}
                    </span>
                  </button>
                </div>
              </form>
            )}

            {/* STATE C: VERIFICATION SUCCESSFUL */}
            {regStep === 'success' && (
              <div className="space-y-4 text-center py-4">
                <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-sm">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Email Verified & Account Created!</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                    Welcome to Secure Share, <strong className="text-slate-700">{displayName}</strong>. Your account has been verified and registered in MongoDB Atlas.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors"
                >
                  <span>Enter Secure Vault</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SWITCH ACCOUNT */}
        {activeTab === 'switch' && (
          <div className="mt-5 space-y-4">
            <div className="flex items-start gap-2.5 rounded-xl bg-violet-50/70 border border-violet-200/80 p-3 text-xs text-violet-900">
              <ShieldCheck className="h-4 w-4 text-violet-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Privacy-Isolated Device Sessions</p>
                <p className="text-[11px] text-violet-700/90 mt-0.5 leading-normal">
                  Only accounts explicitly signed into on this device are accessible. Other Vaultspace users in the database are strictly private and isolated.
                </p>
              </div>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {displayAccounts.map((user) => {
                const isActive = currentUser.userId === user.userId;
                return (
                  <div
                    key={user.userId}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      isActive
                        ? 'border-violet-300 bg-violet-50/70 shadow-sm'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {user.displayName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {user.displayName}
                          </p>
                          <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-md ${
                            user.role === 'admin'
                              ? 'bg-violet-100 text-violet-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {user.role || 'user'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold px-2.5 py-1">
                          <Check className="h-3 w-3" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSwitchAccount(user)}
                            className="rounded-lg bg-violet-600 hover:bg-violet-700 text-white px-3 py-1 text-xs font-medium transition-colors shadow-xs"
                          >
                            Switch
                          </button>
                          {onRemoveSavedAccount && (
                            <button
                              type="button"
                              onClick={() => onRemoveSavedAccount(user.userId)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Forget account on this device"
                              aria-label="Forget account"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {displayAccounts.length <= 1 && (
              <div className="rounded-xl border border-dashed border-slate-200 p-3.5 text-center">
                <p className="text-xs text-slate-600 font-medium">No other accounts saved on this device.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Sign in to add another account to this device session.</p>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setEmail('');
                setPassword('');
                setErrorMessage('');
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white hover:bg-violet-50/60 py-2.5 text-xs font-semibold text-violet-700 transition-colors shadow-xs"
            >
              <UserPlus className="h-4 w-4" />
              <span>+ Sign In to Another Account</span>
            </button>
          </div>
        )}

        {/* TAB 4: TOKEN & SECURITY DETAILS */}
        {activeTab === 'token' && (
          <div className="mt-5 space-y-4 text-xs">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-violet-600" />
                  Active Token Payload
                </span>
                <span className="text-[10px] font-mono font-bold bg-violet-100 text-violet-800 px-2 py-0.5 rounded">
                  HMAC-SHA256 (JWT)
                </span>
              </div>

              <div className="space-y-1 font-mono text-[11px] text-slate-600 bg-white rounded-lg p-2.5 border border-slate-200">
                <div>User ID: <span className="text-slate-900 font-semibold">{currentUser.userId}</span></div>
                <div>Email: <span className="text-slate-900">{currentUser.email}</span></div>
                <div>Role: <span className="text-violet-700 font-semibold uppercase">{currentUser.role || 'admin'}</span></div>
                <div>Expiration: <span className="text-emerald-700 font-semibold">7 Days (Rolling)</span></div>
              </div>
            </div>

            {/* Token String */}
            <div>
              <label className="font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>Bearer Token Header:</span>
                <button
                  type="button"
                  onClick={handleCopyToken}
                  className="inline-flex items-center gap-1 text-[11px] text-violet-700 hover:text-violet-900 font-medium"
                >
                  {copiedToken ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedToken ? 'Copied' : 'Copy Token'}</span>
                </button>
              </label>
              <textarea
                readOnly
                rows={3}
                value={currentToken || `Bearer ${currentUser.userId}`}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-mono text-[10px] text-slate-700 break-all select-all focus:outline-none"
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
