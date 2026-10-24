import React, { useState } from 'react';
import { AuthenticatedUser, UserRole } from '../types/callshield';
import { Lock, UserPlus, LogIn, X, KeyRound, AlertTriangle } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register';
  onClose: () => void;
  onAuthenticated: (token: string, user: AuthenticatedUser) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  onClose,
  onAuthenticated,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState<string>('deshmukh@cybercell.gov.in');
  const [password, setPassword] = useState<string>('CyberShield#2026');
  const [name, setName] = useState<string>('');
  const [role, setRole] = useState<UserRole>('Forensic Analyst');
  const [badgeNumber, setBadgeNumber] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  React.useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErrorMsg('');
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMsg('Please enter both email address and password.');
      return;
    }

    if (mode === 'register') {
      if (!name.trim() || name.trim().length < 2) {
        setErrorMsg('Please enter your full name or investigator title.');
        return;
      }
      if (password.length < 8) {
        setErrorMsg('Password must be at least 8 characters long.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const endpoint =
        mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const bodyPayload =
        mode === 'login'
          ? { email: cleanEmail, password }
          : {
              email: cleanEmail,
              password,
              name: name.trim(),
              role,
              badgeNumber: badgeNumber.trim() || undefined,
            };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Authentication failed.');
      } else if (data.token && data.user) {
        onAuthenticated(data.token, data.user);
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error during authentication.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillDemoInvestigator = () => {
    setMode('login');
    setEmail('deshmukh@cybercell.gov.in');
    setPassword('CyberShield#2026');
    setErrorMsg('');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    >
      <div className="w-full max-w-md rounded-xl bg-[#10131D] border border-neutral-800 p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 border-b border-neutral-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-red-400">
              <Lock className="w-3.5 h-3.5" />
              <span>HS256 JWT · Scrypt Password KDF</span>
            </div>
            <h2
              id="auth-modal-title"
              className="text-lg font-bold font-display text-white"
            >
              {mode === 'login'
                ? 'Sign In to Investigator Console'
                : 'Register Forensic Investigator Account'}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close authentication modal"
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#090A0F] border border-neutral-800">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMsg('');
            }}
            className={`py-2 text-xs font-semibold rounded-md transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'login'
                ? 'bg-red-600 text-white'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setEmail('');
              setPassword('');
              setErrorMsg('');
            }}
            className={`py-2 text-xs font-semibold rounded-md transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'register'
                ? 'bg-red-600 text-white'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Register Account</span>
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-red-950/40 border border-red-600/70 text-xs text-red-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <>
              <div className="space-y-1">
                <label
                  htmlFor="auth-name-input"
                  className="block text-xs font-medium text-neutral-300"
                >
                  Full Name &amp; Title
                </label>
                <input
                  id="auth-name-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Insp. K. Sharma"
                  className="w-full rounded-lg bg-[#090A0F] border border-neutral-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="auth-role-select"
                    className="block text-xs font-medium text-neutral-300"
                  >
                    Investigator Role
                  </label>
                  <select
                    id="auth-role-select"
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full rounded-lg bg-[#090A0F] border border-neutral-800 px-3 py-2 text-xs text-white"
                  >
                    <option value="Lead Investigator">Lead Investigator</option>
                    <option value="Forensic Analyst">Forensic Analyst</option>
                    <option value="Citizen User">Citizen User</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="auth-badge-input"
                    className="block text-xs font-medium text-neutral-300"
                  >
                    Badge / Unit ID (Optional)
                  </label>
                  <input
                    id="auth-badge-input"
                    type="text"
                    value={badgeNumber}
                    onChange={(e) => setBadgeNumber(e.target.value)}
                    placeholder="IND-CYB-9012"
                    className="w-full rounded-lg bg-[#090A0F] border border-neutral-800 px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-1">
            <label
              htmlFor="auth-email-input"
              className="block text-xs font-medium text-neutral-300"
            >
              Official Email Address
            </label>
            <input
              id="auth-email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="investigator@cybercell.gov.in"
              className="w-full rounded-lg bg-[#090A0F] border border-neutral-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="auth-password-input"
              className="block text-xs font-medium text-neutral-300"
            >
              Password {mode === 'register' ? '(Min. 8 characters)' : ''}
            </label>
            <input
              id="auth-password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full rounded-lg bg-[#090A0F] border border-neutral-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-40 rounded-lg transition-colors cursor-pointer"
          >
            {isSubmitting
              ? 'Verifying Credentials...'
              : mode === 'login'
              ? 'Authenticate & Issue JWT'
              : 'Register & Issue JWT'}
          </button>
        </form>

        <div className="pt-3 border-t border-neutral-800 flex items-center justify-between gap-2 text-xs text-neutral-400">
          <span className="whitespace-nowrap">Demo Investigator:</span>
          <button
            type="button"
            onClick={fillDemoInvestigator}
            className="text-red-400 hover:text-red-300 font-mono inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5 shrink-0" />
            <span>Autofill Insp. Deshmukh</span>
          </button>
        </div>
      </div>
    </div>
  );
};
