import { useState, useEffect } from 'react'
import { useLang } from '../context/LangContext'
import { usePlan } from '../hooks/usePlan'
import api from '../api/client'

const T = {
  th: {
    title:         'เลือกแผนการใช้งาน',
    subtitle:      'เริ่มต้นฟรี — อัปเกรดเมื่อพร้อม',
    plan_free:     'Free',
    plan_pro:      'Pro',
    per_mo:        '/ เดือน',
    free_price:    '0 ฿',
    free_f1:       '1 การสอบสวนต่อวัน',
    free_f2:       'Dashboard ครบทุก tab',
    free_f3:       'แชร์ลิงก์',
    pro_f1:        'ไม่จำกัดจำนวนการสอบสวน',
    pro_f2:        'Rate limit: 1 ครั้ง / 5 นาที',
    pro_f3:        'Dashboard + ฟีเจอร์ครบ',
    pro_f4:        'Priority support',
    current_plan:  'แผนปัจจุบัน',
    qr_title:      'สแกน QR เพื่อชำระเงิน',
    qr_hint:       'PromptPay / โอนเงิน',
    paid_btn:      'แจ้งชำระเงินแล้ว',
    pending_title: '⏳ รอการยืนยัน',
    pending_body:  'เราได้รับการแจ้งชำระเงินของคุณแล้ว ทีมงานจะยืนยันภายใน 24 ชั่วโมง',
    pending_since: 'แจ้งชำระเงินเมื่อ',
    approved:      '✅ Pro — ใช้งานได้แล้ว!',
    sending:       'กำลังส่ง…',
    close:         'ปิด',
    already_pro:   'คุณใช้แผน Pro อยู่แล้ว 🎉',
  },
  en: {
    title:         'Choose your plan',
    subtitle:      'Start free — upgrade when ready',
    plan_free:     'Free',
    plan_pro:      'Pro',
    per_mo:        '/ mo',
    free_price:    '0 ฿',
    free_f1:       '1 analysis per day',
    free_f2:       'Full dashboard',
    free_f3:       'Share links',
    pro_f1:        'Unlimited analyses',
    pro_f2:        'Rate limit: 1 per 5 min',
    pro_f3:        'Full dashboard & features',
    pro_f4:        'Priority support',
    current_plan:  'Current plan',
    qr_title:      'Scan QR to pay',
    qr_hint:       'PromptPay / bank transfer',
    paid_btn:      'I\'ve Paid',
    pending_title: '⏳ Awaiting verification',
    pending_body:  'We received your payment notification. Team will verify within 24 hours.',
    pending_since: 'Submitted on',
    approved:      '✅ Pro — you\'re all set!',
    sending:       'Sending…',
    close:         'Close',
    already_pro:   'You\'re already on Pro 🎉',
  },
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  )
}

export default function PricingModal({ onClose }) {
  const { lang }  = useLang()
  const t         = T[lang] ?? T.en
  const { plan, paymentStatus, priceThb, pendingSince, refresh } = usePlan()

  const [sending,  setSending]  = useState(false)
  const [error,    setError]    = useState(null)
  const [localStatus, setLocalStatus] = useState(paymentStatus)

  // Sync local status when hook updates
  useEffect(() => { setLocalStatus(paymentStatus) }, [paymentStatus])

  // Poll every 8s while pending
  useEffect(() => {
    if (localStatus !== 'pending') return
    const id = setInterval(() => {
      refresh().then(() => setLocalStatus(paymentStatus))
    }, 8000)
    return () => clearInterval(id)
  }, [localStatus, paymentStatus, refresh])

  const handlePaid = async () => {
    setSending(true)
    setError(null)
    try {
      await api.post('/payment/request')
      setLocalStatus('pending')
      refresh()
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div>
            <h2 className="text-lg font-display font-bold text-slate-900">{t.title}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{t.subtitle}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors ml-4">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 pb-6 space-y-5">

          {/* Plan cards */}
          <div className="grid grid-cols-2 gap-4">

            {/* Free */}
            <div className={`rounded-xl border p-4 ${plan === 'free' ? 'border-slate-300 bg-slate-50' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-slate-700">{t.plan_free}</span>
                {plan === 'free' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">{t.current_plan}</span>}
              </div>
              <p className="text-2xl font-bold text-slate-900 mb-4">{t.free_price} <span className="text-sm font-normal text-slate-500">{t.per_mo}</span></p>
              <ul className="space-y-2">
                {[t.free_f1, t.free_f2, t.free_f3].map(f => (
                  <li key={f} className="flex items-start gap-2 text-xs text-slate-600"><CheckIcon />{f}</li>
                ))}
              </ul>
            </div>

            {/* Pro */}
            <div className={`rounded-xl border p-4 relative overflow-hidden ${plan === 'pro' ? 'border-teal-400 bg-teal-50' : 'border-teal-200 bg-teal-50/40'}`}>
              <div className="absolute top-0 right-0 bg-teal-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-bl-lg">PRO</div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-teal-700">{t.plan_pro}</span>
                {plan === 'pro' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 border border-teal-200">{t.current_plan}</span>}
              </div>
              <p className="text-2xl font-bold text-slate-900 mb-4">{priceThb} ฿ <span className="text-sm font-normal text-slate-500">{t.per_mo}</span></p>
              <ul className="space-y-2">
                {[t.pro_f1, t.pro_f2, t.pro_f3, t.pro_f4].map(f => (
                  <li key={f} className="flex items-start gap-2 text-xs text-slate-600"><CheckIcon />{f}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Already pro */}
          {plan === 'pro' && (
            <div className="text-center py-4 text-teal-600 font-semibold">{t.already_pro}</div>
          )}

          {/* Payment section — only for free users */}
          {plan === 'free' && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">

              {localStatus === 'pending' && (
                <div className="text-center space-y-3 py-2">
                  <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto">
                    <div className="w-5 h-5 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                  </div>
                  <p className="text-base font-semibold text-amber-700">{t.pending_title}</p>
                  <p className="text-sm text-slate-600">{t.pending_body}</p>
                  {pendingSince && (
                    <p className="text-xs text-slate-500">
                      {t.pending_since}{' '}
                      <span className="text-slate-600">
                        {new Date(pendingSince).toLocaleString(
                          lang === 'th' ? 'th-TH' : 'en-GB',
                          { dateStyle: 'medium', timeStyle: 'short' }
                        )}
                      </span>
                    </p>
                  )}
                </div>
              )}

              {localStatus === 'approved' && (
                <p className="text-center text-teal-600 font-semibold py-2">{t.approved}</p>
              )}

              {!localStatus && (
                <div className="flex flex-col sm:flex-row gap-6 items-center">
                  {/* QR Code placeholder */}
                  <div className="shrink-0 flex flex-col items-center gap-2">
                    <p className="text-xs text-slate-600 font-medium">{t.qr_title}</p>
                    <div className="w-40 h-40 rounded-xl border-2 border-dashed border-slate-300 bg-white flex items-center justify-center">
                      {/* Replace this img src with your real QR code */}
                      <img
                        src="https://placehold.co/150x150/f8fafc/64748b?text=QR+Code"
                        alt="Payment QR"
                        className="w-36 h-36 rounded-lg object-contain"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500">{t.qr_hint}</p>
                  </div>

                  {/* Right side */}
                  <div className="flex-1 space-y-3 w-full">
                    <p className="text-sm text-slate-600">
                      {lang === 'th'
                        ? `โอนเงิน ${priceThb} THB ผ่าน QR แล้วกดปุ่มด้านล่าง เราจะยืนยันและอัปเกรดบัญชีภายใน 24 ชม.`
                        : `Transfer ${priceThb} THB via QR, then click the button below. We'll verify and upgrade your account within 24 h.`}
                    </p>

                    {error && (
                      <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>
                    )}

                    <button
                      onClick={handlePaid}
                      disabled={sending}
                      className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
                    >
                      {sending ? t.sending : t.paid_btn}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
