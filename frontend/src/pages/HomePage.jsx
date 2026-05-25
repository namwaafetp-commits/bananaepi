import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from '../components/Navbar'
import UploadZone from '../components/UploadZone'
import ProjectList from '../components/ProjectList'
import PricingModal from '../components/PricingModal'
import { useLang } from '../context/LangContext'
import { t } from '../i18n'

// ── Template column catalogue ──────────────────────────────────────────────────
const SECTION_STYLE = {
  Identifier: { text: 'text-teal-700',   bg: 'bg-teal-50',   border: 'border-teal-200' },
  Person:     { text: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  Time:       { text: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  Place:      { text: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
  Outcome:    { text: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200' },
  Symptoms:   { text: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  Exposure:   { text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
}

const DTYPE_STYLE = {
  string:  'text-slate-600  bg-slate-100',
  integer: 'text-blue-600   bg-blue-50',
  date:    'text-amber-600  bg-amber-50',
  boolean: 'text-green-700  bg-green-50',
}

const TEMPLATE_COLS = [
  { col: 'case_id',         section: 'Identifier', req: true,  dtype: 'string',  th: 'รหัสผู้ป่วย (ไม่ซ้ำกัน)',                en: 'Unique case ID',                  example: 'PT-001, HN-123456' },
  { col: 'age',             section: 'Person',     req: true,  dtype: 'integer', th: 'อายุ (ปี)',                               en: 'Age in whole years',              example: '32, 5, 70' },
  { col: 'sex',             section: 'Person',     req: true,  dtype: 'string',  th: 'เพศ',                                     en: 'Sex',                             example: 'Male / Female / Unknown' },
  { col: 'occupation',      section: 'Person',     req: false, dtype: 'string',  th: 'อาชีพ',                                   en: 'Occupation',                      example: 'Teacher, Student' },
  { col: 'nationality',     section: 'Person',     req: false, dtype: 'string',  th: 'สัญชาติ',                                 en: 'Nationality',                     example: 'Thai, Myanmar' },
  { col: 'date_onset',      section: 'Time',       req: true,  dtype: 'date',    th: 'วันเริ่มป่วย',                            en: 'Date of symptom onset',           example: '2024-03-15' },
  { col: 'date_report',     section: 'Time',       req: false, dtype: 'date',    th: 'วันที่รายงาน',                            en: 'Date reported',                   example: '2024-03-16' },
  { col: 'date_admitted',   section: 'Time',       req: false, dtype: 'date',    th: 'วันรับไว้ในโรงพยาบาล',                   en: 'Date admitted',                   example: '2024-03-16' },
  { col: 'date_discharge',  section: 'Time',       req: false, dtype: 'date',    th: 'วันจำหน่าย',                              en: 'Date discharged',                 example: '2024-03-20' },
  { col: 'date_exposure',   section: 'Time',       req: false, dtype: 'date',    th: 'วันที่สัมผัส',                            en: 'Date of exposure',                example: '2024-03-14' },
  { col: 'province',        section: 'Place',      req: false, dtype: 'string',  th: 'จังหวัด',                                 en: 'Province',                        example: 'Chiang Mai' },
  { col: 'district',        section: 'Place',      req: false, dtype: 'string',  th: 'อำเภอ',                                   en: 'District',                        example: 'Mueang' },
  { col: 'subdistrict',     section: 'Place',      req: false, dtype: 'string',  th: 'ตำบล',                                    en: 'Sub-district',                    example: 'Chang Moi' },
  { col: 'village',         section: 'Place',      req: false, dtype: 'string',  th: 'หมู่บ้าน',                                en: 'Village',                         example: 'Village 3' },
  { col: 'case_status',     section: 'Outcome',    req: false, dtype: 'string',  th: 'สถานะผู้ป่วย',                            en: 'Case classification',             example: 'suspect / probable / confirmed' },
  { col: 'outcome',         section: 'Outcome',    req: false, dtype: 'string',  th: 'ผลลัพธ์',                                 en: 'Patient outcome',                 example: 'Alive / Dead / Unknown' },
  { col: 'hospitalized',    section: 'Outcome',    req: false, dtype: 'boolean', th: 'รับไว้ในโรงพยาบาล',                      en: 'Hospitalized',                    example: '1 = yes, 0 = no' },
  { col: 'icu',             section: 'Outcome',    req: false, dtype: 'boolean', th: 'เข้า ICU',                                en: 'Admitted to ICU',                 example: '1 = yes, 0 = no' },
  { col: 'symptom_fever',   section: 'Symptoms',   req: false, dtype: 'boolean', th: 'มีไข้',                                   en: 'Has fever',                       example: '1 = yes, 0 = no' },
  { col: 'symptom_diarrhea',section: 'Symptoms',   req: false, dtype: 'boolean', th: 'ท้องเสีย',                                en: 'Has diarrhea',                    example: '1 = yes, 0 = no' },
  { col: 'symptom_vomiting',section: 'Symptoms',   req: false, dtype: 'boolean', th: 'อาเจียน',                                 en: 'Has vomiting',                    example: '1 = yes, 0 = no' },
  { col: 'symptom_*',       section: 'Symptoms',   req: false, dtype: 'boolean', th: 'อาการอื่นๆ — prefix: symptom_',           en: 'Any symptom — prefix: symptom_',  example: 'symptom_rash, symptom_headache' },
  { col: 'exposure_water',  section: 'Exposure',   req: false, dtype: 'boolean', th: 'ดื่มน้ำจากแหล่งร่วม',                    en: 'Shared water source',             example: '1 = yes, 0 = no' },
  { col: 'exposure_food_*', section: 'Exposure',   req: false, dtype: 'boolean', th: 'รับประทานอาหาร — prefix: exposure_food_', en: 'Food eaten — prefix: exposure_food_', example: 'exposure_food_chicken' },
  { col: 'exposure_*',      section: 'Exposure',   req: false, dtype: 'boolean', th: 'การสัมผัสอื่นๆ — prefix: exposure_',     en: 'Any exposure — prefix: exposure_', example: 'exposure_animal_contact' },
]

const SECTIONS = [...new Set(TEMPLATE_COLS.map(c => c.section))]


// ── Step 1 template table ─────────────────────────────────────────────────────
function TemplateTable({ lang }) {
  return (
    <div className="mt-4 rounded-xl overflow-hidden border border-slate-200">
      <div className="overflow-x-auto max-h-80 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 bg-white border-b border-slate-200">
            <tr>
              <th className="text-left px-3 py-2 text-slate-500 font-semibold uppercase tracking-wide whitespace-nowrap">{t('step1_col_hdr', lang)}</th>
              <th className="text-left px-3 py-2 text-slate-500 font-semibold uppercase tracking-wide">{t('step1_meaning_hdr', lang)}</th>
              <th className="text-left px-3 py-2 text-slate-500 font-semibold uppercase tracking-wide whitespace-nowrap">{t('step1_dtype_hdr', lang)}</th>
              <th className="text-left px-3 py-2 text-slate-500 font-semibold uppercase tracking-wide">{t('step1_example_hdr', lang)}</th>
            </tr>
          </thead>
          <tbody>
            {SECTIONS.map(section => {
              const cols = TEMPLATE_COLS.filter(c => c.section === section)
              const s = SECTION_STYLE[section]
              return [
                <tr key={`sec-${section}`} className="border-t border-slate-100">
                  <td colSpan={4} className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest ${s.text} bg-slate-50`}>
                    {section}
                  </td>
                </tr>,
                ...cols.map(col => (
                  <tr key={col.col} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 font-mono px-1.5 py-0.5 rounded text-[11px] border ${s.text} ${s.bg} ${s.border}`}>
                        {col.col}
                        {col.req && <span className="text-red-500 text-[9px]">★</span>}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{lang === 'th' ? col.th : col.en}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${DTYPE_STYLE[col.dtype]}`}>
                        {col.dtype}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-400 whitespace-nowrap">{col.example}</td>
                  </tr>
                )),
              ]
            })}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500">
        ★ {lang === 'th' ? 'จำเป็น — ต้องมีในไฟล์' : 'Required — must be present in your file'}
      </div>
    </div>
  )
}

// ── Follow-up steps (2–5) ─────────────────────────────────────────────────────
const FOLLOW_STEPS = [
  { n: '2', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12', titleKey: 'step2_title', descKey: 'step2_desc', color: 'teal' },
  { n: '3', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', titleKey: 'step3_title', descKey: 'step3_desc', color: 'blue' },
  { n: '4', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', titleKey: 'step4_title', descKey: 'step4_desc', color: 'violet' },
  { n: '5', icon: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z', titleKey: 'step5_title', descKey: 'step5_desc', color: 'teal' },
]

const STEP_COLOR = {
  teal:   'bg-teal-50   border-teal-200   text-teal-700',
  blue:   'bg-blue-50   border-blue-200   text-blue-700',
  violet: 'bg-violet-50 border-violet-200 text-violet-700',
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [refreshKey,        setRefreshKey]        = useState(0)
  const [downloading,       setDownloading]       = useState(false)
  const [templateExpanded,  setTemplateExpanded]  = useState(false)
  const [showPricing,       setShowPricing]       = useState(false)
  const { lang } = useLang()

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const res = await fetch('/api/template')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'epiassist_template.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-5 py-10 space-y-12">

        {/* ── Hero + Upload + Recent ────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          <div className="lg:col-span-3 space-y-5">
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="font-display text-4xl sm:text-5xl text-slate-900 leading-tight">
                {t('home_hero_title1', lang)}<br />
                <span className="text-teal-600">{t('home_hero_title2', lang)}</span>
              </h1>
              <p className="text-slate-500 mt-3 max-w-lg text-base leading-relaxed">
                {t('home_hero_desc', lang)}
              </p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
                {t('home_upload_label', lang)}
              </p>
              <UploadZone
                onUploadComplete={() => setRefreshKey(k => k + 1)}
                onRateLimit={() => setShowPricing(true)}
              />
            </motion.div>
          </div>

          <div className="lg:col-span-2">
            <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
                {t('home_recent_label', lang)}
              </p>
              <ProjectList refreshTrigger={refreshKey} />
            </motion.div>
          </div>

        </div>

        {/* ── Step guide ────────────────────────────────────────────────── */}
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-5">
            {t('home_guide_label', lang)}
          </p>

          <div className="space-y-4">

            {/* Step 1 — full-width expandable template card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
              className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5"
            >
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center">
                  <span className="text-sm font-bold text-teal-700">1</span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 mb-1">{t('step1_title', lang)}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{t('step1_desc', lang)}</p>

                  <div className="flex flex-wrap gap-2 mt-3">
                    <button
                      onClick={() => setTemplateExpanded(v => !v)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors"
                    >
                      <svg className={`w-3.5 h-3.5 transition-transform ${templateExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      {templateExpanded ? t('step1_hide', lang) : t('step1_view', lang)}
                    </button>

                    <button
                      onClick={handleDownload}
                      disabled={downloading}
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 disabled:opacity-50 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      {downloading ? t('preparing', lang) : t('download_template', lang)}
                    </button>
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {templateExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <TemplateTable lang={lang} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Steps 2–5 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {FOLLOW_STEPS.map((step, i) => (
                <motion.div
                  key={step.n}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.17 + i * 0.05 }}
                  className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex gap-3 items-start"
                >
                  <div className={`shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center ${STEP_COLOR[step.color]}`}>
                    <span className="text-sm font-bold">{step.n}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 mb-1">{t(step.titleKey, lang)}</p>
                    <p className="text-xs text-slate-500 leading-relaxed">{t(step.descKey, lang)}</p>
                  </div>
                </motion.div>
              ))}
            </div>

          </div>
        </motion.section>

      </main>

      {showPricing && <PricingModal onClose={() => setShowPricing(false)} />}
    </div>
  )
}
