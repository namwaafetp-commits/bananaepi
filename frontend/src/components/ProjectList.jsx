import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../api/client'
import Spinner from './Spinner'
import { useLang } from '../context/LangContext'

const PREVIEW_COUNT = 5

function timeAgo(iso, lang) {
  const d = new Date(iso)
  const diff = Math.floor((Date.now() - d) / 1000)
  if (lang === 'en') {
    if (diff < 60)    return 'just now'
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  if (diff < 60)    return 'เมื่อกี้'
  if (diff < 3600)  return `${Math.floor(diff / 60)} นาทีที่แล้ว`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
}

const STATUS_LABEL = {
  case_defined: { th: 'นิยาม Case แล้ว', en: 'Case defined' },
  reported:     { th: 'มีรายงาน',        en: 'Reported' },
  cleaned:      { th: 'ประมวลผลแล้ว',    en: 'Processed' },
  uploaded:     { th: 'อัปโหลดแล้ว',     en: 'Uploaded' },
}
const STATUS_COLOR = {
  case_defined: 'bg-teal-500',
  reported:     'bg-teal-500',
  cleaned:      'bg-blue-400',
  uploaded:     'bg-slate-400',
}

function projectHref(p) {
  if (p.status === 'case_defined') return `/dashboard/${p.project_id}`
  if (p.status === 'cleaned')      return `/data-ready/${p.project_id}`
  if (p.status === 'uploaded')     return `/mapping/${p.project_id}`
  return `/project/${p.project_id}`
}

export default function ProjectList({ refreshTrigger }) {
  const [projects, setProjects] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState(false)
  const { lang } = useLang()

  useEffect(() => {
    api.get('/projects/')
      .then(r => setProjects(r.data.projects || []))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false))
  }, [refreshTrigger])

  if (loading) return <div className="pt-8"><Spinner size="sm" label="" /></div>

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-slate-400">
        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
        </svg>
        <p className="text-sm text-slate-500">{lang === 'th' ? 'ยังไม่มีการสอบสวนโรค' : 'No investigations yet'}</p>
        <p className="text-xs text-slate-400">{lang === 'th' ? 'อัปโหลด Line List เพื่อเริ่มต้น' : 'Upload a line list to get started'}</p>
      </div>
    )
  }

  const visible  = expanded ? projects : projects.slice(0, PREVIEW_COUNT)
  const overflow = projects.length - PREVIEW_COUNT

  return (
    <div>
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {visible.map((p, i) => (
            <motion.li
              key={p.project_id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ delay: i < PREVIEW_COUNT ? i * 0.04 : 0, duration: 0.15 }}
            >
              <Link to={projectHref(p)}
                className="flex items-start gap-3 p-3 rounded-xl bg-white hover:bg-slate-50
                           border border-slate-200 hover:border-teal-300 hover:shadow-sm transition-all group">
                <div className="mt-0.5 w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25M8.25 18.75h7.5M8.25 15.75h7.5"/>
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 truncate group-hover:text-teal-700 transition-colors">
                    {p.filename || (lang === 'th' ? 'ไม่มีชื่อ' : 'Untitled')}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_COLOR[p.status] || 'bg-slate-400'}`} />
                    <span className="text-xs text-slate-400">
                      {p.row_count?.toLocaleString()} {lang === 'th' ? 'แถว' : 'rows'} · {timeAgo(p.upload_time, lang)}
                    </span>
                  </div>
                </div>
                <svg className="w-4 h-4 text-slate-400 group-hover:text-teal-600 transition-colors mt-1 shrink-0"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/>
                </svg>
              </Link>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {overflow > 0 && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          <svg className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          {expanded
            ? (lang === 'th' ? 'ย่อ' : 'Show less')
            : (lang === 'th' ? `ดูอีก ${overflow} รายการ` : `Show ${overflow} more`)}
        </button>
      )}
    </div>
  )
}
