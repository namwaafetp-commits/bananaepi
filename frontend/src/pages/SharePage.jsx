import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLang } from '../context/LangContext';
import { t } from '../i18n';

function fmtExpiry(isoString) {
  const exp = new Date(isoString);
  const now = new Date();
  const diffMs = exp - now;
  const diffH  = diffMs / 3600000;
  if (diffH < 24) return `${Math.ceil(diffH)} hour${Math.ceil(diffH) !== 1 ? 's' : ''}`;
  const diffD = Math.ceil(diffH / 24);
  return `${diffD} day${diffD !== 1 ? 's' : ''}`;
}
import DashboardLayout from '../components/dashboard/DashboardLayout';

export default function SharePage() {
  const { token } = useParams();
  const { lang } = useLang();

  const [info,       setInfo]       = useState(null);
  const [infoError,  setInfoError]  = useState(null);

  const [password,   setPassword]   = useState('');
  const [showPw,     setShowPw]     = useState(false);
  const [unlocking,  setUnlocking]  = useState(false);
  const [authError,  setAuthError]  = useState(null);

  const [data,       setData]       = useState(null);

  // Load share info (project name, expiry) — no password needed
  useEffect(() => {
    fetch(`/api/share/${token}/info`)
      .then(async r => {
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d.detail || 'Share link not found');
        }
        return r.json();
      })
      .then(setInfo)
      .catch(e => setInfoError(e.message));
  }, [token]);

  const handleUnlock = async () => {
    if (!password.trim()) { setAuthError('Enter the password'); return; }
    setUnlocking(true);
    setAuthError(null);
    try {
      const res = await fetch(`/api/share/${token}/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || 'Access denied');
      }
      setData(await res.json());
    } catch (e) {
      setAuthError(e.message);
    } finally {
      setUnlocking(false);
    }
  };

  // ── Error state ──────────────────────────────────────────────────────────
  if (infoError) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        <div className="w-14 h-14 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-slate-900 mb-1">{t('sharepage_unavail', lang)}</h2>
        <p className="text-sm text-slate-500">{infoError}</p>
      </div>
    </div>
  );

  // ── Loading info ─────────────────────────────────────────────────────────
  if (!info) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600" />
    </div>
  );

  // ── Expired ──────────────────────────────────────────────────────────────
  if (info.expired) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-slate-900 mb-1">{t('sharepage_expired_title', lang)}</h2>
        <p className="text-sm text-slate-500">
          This share link expired on {new Date(info.expires_at).toLocaleString()}.
        </p>
      </div>
    </div>
  );

  // ── Dashboard (unlocked) ─────────────────────────────────────────────────
  if (data) return (
    <div className="h-screen bg-slate-50">
      <DashboardLayout data={data} isShared sharedMeta={info} />
    </div>
  );

  // ── Password gate ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">

        {/* Branding */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900">{t('sharepage_title', lang)}</h1>
          <p className="text-sm text-slate-600 mt-1 truncate px-4">{info.project_name}</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-md p-6 space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-700 mb-1">{t('sharepage_enter_pw', lang)}</p>
            <p className="text-xs text-slate-500">
              {t('sharepage_protected', lang)} {fmtExpiry(info.expires_at)}
            </p>
          </div>

          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUnlock()}
              placeholder={t('enter_password_ph', lang)}
              autoFocus
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 pr-16 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400/20 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >{showPw ? 'Hide' : 'Show'}</button>
          </div>

          {authError && (
            <p className="text-xs text-red-600 flex items-center gap-1.5">
              <span>✕</span>{authError}
            </p>
          )}

          <button
            onClick={handleUnlock}
            disabled={unlocking}
            className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
          >{unlocking ? t('sharepage_verifying', lang) : t('sharepage_view_btn', lang)}</button>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          {t('sharepage_footer', lang)}
        </p>
      </div>
    </div>
  );
}
