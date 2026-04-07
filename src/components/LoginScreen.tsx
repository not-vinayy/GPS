import React, { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  type AuthError,
} from 'firebase/auth';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Capacitor } from '@capacitor/core';
import { auth, googleProvider } from '../lib/firebase';
import { logger } from '../utils/logger';

// Simple Google 'G' logo as inline SVG
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function authMessage(err: AuthError): string {
  switch (err.code) {
    case 'auth/invalid-email':          return 'Invalid email address.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':     return 'Incorrect email or password.';
    case 'auth/email-already-in-use':   return 'An account with this email already exists.';
    case 'auth/weak-password':          return 'Password must be at least 6 characters.';
    case 'auth/too-many-requests':      return 'Too many attempts. Try again later.';
    case 'auth/popup-blocked':          return 'Popup blocked. Allow popups for this site.';
    case 'auth/popup-closed-by-user':   return '';  // user dismissed — silent
    default:                            return 'Something went wrong. Please try again.';
  }
}

export default function LoginScreen() {
  const [mode,     setMode]     = useState<'signin' | 'signup'>('signin');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState<'email' | 'google' | null>(null);
  const [error,    setError]    = useState('');

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading('email');
    try {
      if (mode === 'signin') {
        await signInWithEmailAndPassword(auth, email, password);
        logger.info('app', 'Signed in via email');
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        logger.info('app', 'Account created via email');
      }
    } catch (err) {
      const msg = authMessage(err as AuthError);
      if (msg) setError(msg);
      logger.warn('app', 'Email auth failed', { code: (err as AuthError).code });
    } finally {
      setLoading(null);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setLoading('google');
    try {
      if (Capacitor.isNativePlatform()) {
        // Native flow: uses system Google account picker, no browser redirect
        const result = await FirebaseAuthentication.signInWithGoogle({
          clientId: '311057311864-v5f0ii4j4sdvlcdq37polf4grrt2cuv6.apps.googleusercontent.com',
        });
        const idToken = result.credential?.idToken;
        if (!idToken) throw new Error('No ID token returned from Google Sign-In');
        const credential = GoogleAuthProvider.credential(idToken);
        await signInWithCredential(auth, credential);
      } else {
        await signInWithPopup(auth, googleProvider);
      }
      logger.info('app', 'Signed in via Google');
    } catch (err) {
      const code = (err as AuthError).code;
      const raw = (err as Error).message;
      setError(`[${code ?? 'no-code'}] ${raw}`);
      logger.warn('app', 'Google auth failed', { code, err });
    } finally {
      setLoading(null);
    }
  };


  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-950 px-6">
      {/* Logo */}
      <div className="mb-10 flex flex-col items-center gap-3">
        <img src="/icon.svg" alt="Trace" className="w-16 h-16 rounded-2xl shadow-lg" />
        <h1 className="text-3xl font-black text-white tracking-tight">Trace</h1>
        <p className="text-slate-400 text-sm">Your GPS fitness companion</p>
      </div>

      <div className="w-full max-w-sm bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-800">
        {/* Tab switcher */}
        <div className="flex bg-slate-800 rounded-2xl p-1 mb-6">
          {(['signin', 'signup'] as const).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all ${
                mode === m
                  ? 'bg-white text-slate-900 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {m === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        {/* Email/password form */}
        <form onSubmit={handleEmail} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full bg-slate-800 text-white placeholder-slate-500 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-500 border border-slate-700"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            className="w-full bg-slate-800 text-white placeholder-slate-500 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-500 border border-slate-700"
          />

          {error && (
            <p className="text-rose-400 text-xs text-center px-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading !== null}
            className="w-full py-3.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-2xl transition-colors disabled:opacity-50 text-sm mt-1"
          >
            {loading === 'email'
              ? (mode === 'signin' ? 'Signing in…' : 'Creating account…')
              : (mode === 'signin' ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-slate-700" />
          <span className="text-slate-500 text-xs">or</span>
          <div className="flex-1 h-px bg-slate-700" />
        </div>

        {/* Google Sign-In */}
        <button
          onClick={handleGoogle}
          disabled={loading !== null}
          className="w-full flex items-center justify-center gap-3 py-3 bg-white hover:bg-slate-100 text-slate-800 font-semibold rounded-2xl transition-colors disabled:opacity-50 text-sm"
        >
          <GoogleIcon />
          Continue with Google
        </button>
      </div>

      <p className="text-slate-600 text-xs mt-8 text-center max-w-xs">
        Your activities are stored securely and sync across all your devices.
      </p>
    </div>
  );
}
