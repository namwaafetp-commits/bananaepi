import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'

const T = {
  th: {
    title:      'BananaEpi',
    subtitle:   'ระบบสอบสวนการระบาดของโรค',
    btn_google: 'เข้าสู่ระบบด้วย Google',
    loading:    'กำลังเชื่อมต่อ…',
  },
  en: {
    title:      'BananaEpi',
    subtitle:   'Outbreak Investigation System',
    btn_google: 'Continue with Google',
    loading:    'Connecting…',
  },
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.2 0 5.9 1.1 8.1 2.9l6-6C34.5 3.1 29.6 1 24 1 14.8 1 7 6.6 3.7 14.4l7 5.4C12.4 13.6 17.7 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.4c-.5 2.8-2.1 5.2-4.5 6.8l7 5.4C43.1 37.1 46.1 31.3 46.1 24.5z"/>
      <path fill="#FBBC05" d="M10.7 28.6A14.8 14.8 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6l-7-5.4A23.8 23.8 0 0 0 .2 24c0 3.9.9 7.5 2.5 10.8l8-6.2z"/>
      <path fill="#34A853" d="M24 47c5.6 0 10.4-1.9 13.9-5l-7-5.4C29 37.9 26.7 38.5 24 38.5c-6.3 0-11.6-4.2-13.5-9.9l-7.9 6.1C6.8 41.5 14.8 47 24 47z"/>
    </svg>
  )
}

export default function AuthPage() {
  const { lang, toggle } = useLang()
  const t = T[lang] ?? T.en
  const { signInWithGoogle } = useAuth()

  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const handleGoogle = async () => {
    setLoading(true)
    setError(null)
    try {
      const { error } = await signInWithGoogle()
      if (error) throw error
      // Page will redirect away — no need to update state
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">

        {/* Logo + lang toggle */}
        <div className="text-center mb-8 relative">
          <button
            onClick={toggle}
            className="absolute right-0 top-0 flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold transition-colors hover:border-slate-300 hover:bg-white"
            title={lang === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'}
          >
            <span className={lang === 'th' ? 'text-teal-600' : 'text-slate-400'}>TH</span>
            <span className="text-slate-400 text-[10px]">/</span>
            <span className={lang === 'en' ? 'text-teal-600' : 'text-slate-400'}>EN</span>
          </button>
          <span className="text-4xl">🔬</span>
          <h1 className="mt-2 text-2xl font-display font-bold text-teal-600">{t.title}</h1>
          <p className="text-sm text-slate-500 mt-1">{t.subtitle}</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">

          {error && (
            <p className="mb-4 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed text-slate-800 text-sm font-semibold transition-colors shadow-sm"
          >
            {loading
              ? <span className="w-4 h-4 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
              : <GoogleIcon />
            }
            {loading ? t.loading : t.btn_google}
          </button>

        </div>

      </div>
    </div>
  )
}
