import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../context/LangContext'
import { useAuth } from '../context/AuthContext'
import { usePlan } from '../hooks/usePlan'
import PricingModal from './PricingModal'

export default function Navbar({ title, subtitle, actions }) {
  const { lang, toggle } = useLang()
  const { session, signOut } = useAuth()
  const email = session?.user?.email ?? null
  const { plan, paymentStatus, loading: planLoading } = usePlan()
  const [showPricing, setShowPricing] = useState(false)

  return (
    <>
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-5 h-14 flex items-center gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0 group">
          <span className="text-lg">🔬</span>
          <span className="font-display text-base text-teal-600 group-hover:text-teal-700 transition-colors">
            BananaEpi
          </span>
        </Link>

        {/* Separator + page title */}
        {title && (
          <>
            <span className="text-slate-400 text-lg font-thin">/</span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{title}</p>
              {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
            </div>
          </>
        )}

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-2">
          {actions}

          {/* Plan badge — 3 states: pro / pending / free */}
          {!planLoading && email && (
            plan === 'pro' ? (
              <button
                onClick={() => setShowPricing(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-50 border border-teal-200 text-[11px] font-bold text-teal-700 hover:bg-teal-100 hover:border-teal-300 transition-all"
              >
                ✦ Pro
              </button>
            ) : paymentStatus === 'pending' ? (
              <button
                onClick={() => setShowPricing(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-700 hover:bg-amber-100 hover:border-amber-300 transition-all"
              >
                <span className="w-2 h-2 rounded-full border border-amber-500 border-t-transparent animate-spin" />
                {lang === 'th' ? 'ตรวจสอบสถานะ' : 'Check status'}
              </button>
            ) : (
              <button
                onClick={() => setShowPricing(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-100 hover:border-slate-300 transition-all"
              >
                <span className="opacity-60 font-normal">Free</span>
                <span className="text-slate-400">·</span>
                {lang === 'th' ? 'อัปเกรด' : 'Upgrade'}
              </button>
            )
          )}

          {/* Language toggle */}
          <button
            onClick={toggle}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold transition-colors hover:border-slate-300 hover:bg-slate-50"
            title={lang === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'}
          >
            <span className={lang === 'th' ? 'text-teal-600' : 'text-slate-400'}>TH</span>
            <span className="text-slate-400 text-[10px]">/</span>
            <span className={lang === 'en' ? 'text-teal-600' : 'text-slate-400'}>EN</span>
          </button>

          {/* User + logout */}
          {email && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <span className="text-xs text-slate-500 hidden sm:block truncate max-w-[140px]">{email}</span>
              <button
                onClick={signOut}
                className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-500 hover:border-rose-200 transition-colors"
              >
                {lang === 'th' ? 'ออกจากระบบ' : 'Sign out'}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>

    {showPricing && <PricingModal onClose={() => setShowPricing(false)} />}
  </>
  )
}
