import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import api from '../api/client'
import { useLang } from '../context/LangContext'
import { t } from '../i18n'

const BASE = import.meta.env.VITE_API_URL || ''

function ArtifactCard({ icon, title, description, href, filename, color, lang }) {
  const colors = {
    teal:   { ring: 'ring-teal-200   bg-teal-50',   icon: 'text-teal-600',   btn: 'bg-teal-600 hover:bg-teal-700 text-white' },
    violet: { ring: 'ring-violet-200 bg-violet-50', icon: 'text-violet-600', btn: 'bg-violet-600 hover:bg-violet-700 text-white' },
    blue:   { ring: 'ring-blue-200   bg-blue-50',   icon: 'text-blue-600',   btn: 'bg-blue-600 hover:bg-blue-700 text-white' },
  }
  const c = colors[color] || colors.teal
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl ring-1 p-5 flex flex-col gap-3 shadow-sm ${c.ring}`}>
      <div className={`text-2xl ${c.icon}`}>{icon}</div>
      <div>
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>
      </div>
      <a href={href} download={filename}
        className={`mt-auto text-xs font-medium px-3 py-2 rounded-lg text-center transition-colors ${c.btn}`}>
        {t('ready_download', lang)}
      </a>
    </motion.div>
  )
}

export default function DataReadyPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { lang } = useLang()
  const [meta, setMeta] = useState(null)

  useEffect(() => {
    api.get(`/projects/${projectId}`).then(r => setMeta(r.data)).catch(() => {})
  }, [projectId])

  const qr = meta?.quality_report
  const scoreColor = !qr ? '' :
    qr.dataset_score >= 80 ? 'text-teal-600' :
    qr.dataset_score >= 60 ? 'text-amber-500' : 'text-red-500'

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-8">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl text-teal-600">✓</span>
            <h1 className="text-xl font-semibold text-slate-900">{t('ready_title', lang)}</h1>
          </div>
          <p className="text-sm text-slate-500">
            {meta?.original_filename} · {meta?.row_count?.toLocaleString()} {t('mapper_rows', lang)}
          </p>
        </motion.div>

        {/* Quality score */}
        {qr && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex items-center gap-8">
            <div className="text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{t('ready_quality_score', lang)}</p>
              <p className={`font-display text-5xl font-bold ${scoreColor}`}>{qr.dataset_score}</p>
              <p className="text-xs text-slate-400 mt-0.5">/ 100</p>
            </div>
            <div className="flex-1 grid grid-cols-3 gap-3">
              {[
                { label: t('ready_tier_clean', lang),    value: qr.tiers?.clean ?? 0,         color: 'text-teal-600' },
                { label: t('ready_tier_review', lang),   value: qr.tiers?.needs_review ?? 0,  color: 'text-amber-500' },
                { label: t('ready_tier_excluded', lang), value: qr.tiers?.excluded ?? 0,      color: 'text-red-500' },
              ].map(item => (
                <div key={item.label} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <p className={`font-display text-2xl font-bold ${item.color}`}>{item.value.toLocaleString()}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* 3 Artifact download cards */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{t('ready_files_label', lang)}</p>
          <div className="grid grid-cols-3 gap-4">
            <ArtifactCard
              icon="📊" color="teal" lang={lang}
              title={t('cleaned_title', lang)}
              description={t('cleaned_desc', lang)}
              href={`${BASE}/mapping/${projectId}/download/cleaned`}
              filename={`cleaned_${meta?.original_filename || 'data.csv'}`}
            />
            <ArtifactCard
              icon="📖" color="violet" lang={lang}
              title={t('dict_title', lang)}
              description={t('dict_desc', lang)}
              href={`${BASE}/mapping/${projectId}/download/dictionary`}
              filename={`data_dictionary_${projectId.slice(0,8)}.csv`}
            />
            <ArtifactCard
              icon="🐍" color="blue" lang={lang}
              title={t('script_title', lang)}
              description={t('script_desc', lang)}
              href={`${BASE}/mapping/${projectId}/download/script`}
              filename={`cleaning_script_${projectId.slice(0,8)}.py`}
            />
          </div>
        </div>

        {/* Continue */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="flex gap-3">
          <button onClick={() => navigate(`/case-definition/${projectId}`)}
            className="btn-primary flex-1 text-center py-3">
            {t('ready_continue', lang)}
          </button>
        </motion.div>

      </div>
    </div>
  )
}
