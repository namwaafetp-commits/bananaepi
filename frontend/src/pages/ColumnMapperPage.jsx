import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../api/client'
import Spinner from '../components/Spinner'
import { useLang } from '../context/LangContext'
import { t } from '../i18n'

// ── helpers ───────────────────────────────────────────────────────────────────
const norm = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

const TYPE_BADGE = {
  date:    'bg-orange-50 text-orange-700 border border-orange-200',
  boolean: 'bg-purple-50 text-purple-700 border border-purple-200',
  numeric: 'bg-blue-50   text-blue-700   border border-blue-200',
  string:  'bg-slate-100 text-slate-600  border border-slate-200',
}

const TIME_FIELD_MAP = {
  date_onset:    ['onset',     'date'],
  date_exposure: ['exposure',  'date'],
  date_report:   ['report',    'date'],
  date_admitted: ['treatment', 'date'],
  date_discharge:['treatment', 'date'],
  time_onset:    ['onset',     'time'],
  time_exposure: ['exposure',  'time'],
  time_report:   ['report',    'time'],
}

const UNDERLYING_FIELDS = [
  { id: 'underlying_ht',          label: 'ความดันเลือดสูง (HT)' },
  { id: 'underlying_dm',          label: 'เบาหวาน (DM)' },
  { id: 'underlying_copd',        label: 'ถุงลมโป่งพอง (COPD)' },
  { id: 'underlying_cad',         label: 'โรคหัวใจ (CAD)' },
  { id: 'underlying_ckd',         label: 'โรคไต (CKD)' },
  { id: 'underlying_liver',       label: 'โรคตับ' },
  { id: 'underlying_immunocomp',  label: 'ภูมิคุ้มกันบกพร่อง' },
  { id: 'underlying_pregnant',    label: 'ตั้งครรภ์' },
]

// ── sub-components ────────────────────────────────────────────────────────────

function SectionCard({ id, color, label, labelEn, children }) {
  const ring = {
    slate:  'ring-slate-200  bg-white',
    blue:   'ring-blue-200   bg-blue-50/40',
    orange: 'ring-orange-200 bg-orange-50/40',
    green:  'ring-green-200  bg-green-50/40',
    purple: 'ring-purple-200 bg-purple-50/40',
    yellow: 'ring-amber-200  bg-amber-50/40',
    red:    'ring-red-200    bg-red-50/40',
    gray:   'ring-slate-200  bg-slate-50',
    teal:   'ring-teal-200   bg-teal-50/40',
  }
  const title = {
    slate:  'text-slate-700',
    blue:   'text-blue-700',
    orange: 'text-orange-700',
    green:  'text-green-700',
    purple: 'text-purple-700',
    yellow: 'text-amber-700',
    red:    'text-red-700',
    gray:   'text-slate-500',
    teal:   'text-teal-700',
  }
  return (
    <div id={`sec-${id}`} className={`rounded-2xl ring-1 p-5 shadow-sm ${ring[color]}`}>
      <h2 className={`text-base font-semibold mb-4 ${title[color]}`}>
        {label}
        <span className="text-slate-400 font-normal text-sm ml-2">/ {labelEn}</span>
      </h2>
      {children}
    </div>
  )
}

function ConfBadge({ conf }) {
  if (conf == null) return null
  const cls = conf >= 0.9
    ? 'bg-teal-50 text-teal-700 border-teal-200'
    : conf >= 0.7
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-red-50 text-red-600 border-red-200'
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-mono ${cls}`} title={`Confidence: ${(conf*100).toFixed(0)}%`}>
      {(conf*100).toFixed(0)}%
    </span>
  )
}

function ColPicker({ label, labelTh, fieldId, required, value, onChange, available, allCols }) {
  const { lang } = useLang()
  const info = allCols.find(c => c.name === value)
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <div className="w-44 flex-shrink-0 pt-1">
        <p className="text-sm text-slate-700">{label}{required && <span className="text-red-500 ml-1">*</span>}</p>
        {labelTh && <p className="text-xs text-slate-500">{labelTh}</p>}
        <p className="text-xs font-mono text-slate-400">{fieldId}</p>
      </div>
      <div className="flex-1 min-w-0">
        <select value={value || ''} onChange={e => onChange(fieldId, e.target.value || null)}
          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-800
            focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400/20 transition-colors">
          <option value="">{t('mapper_no_select', lang)}</option>
          {value && !available.find(c => c.name === value) && <option value={value}>{value}</option>}
          {available.map(c => (
            <option key={c.name} value={c.name}>{c.name}  [{c.dtype}]</option>
          ))}
        </select>
        {info && (
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${TYPE_BADGE[info.dtype] || TYPE_BADGE.string}`}>{info.dtype}</span>
            <ConfBadge conf={info.confidence} />
            <span className="text-xs text-slate-400">{info.non_null_pct}%</span>
            {info.sample_values?.slice(0,3).map((v,i) => (
              <span key={i} className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded truncate max-w-[80px]" title={v}>{v}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Bucket({ label, sub, cols, onAdd, onRemove, available }) {
  const { lang } = useLang()
  return (
    <div className="rounded-xl ring-1 ring-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-700 mb-0.5">{label}</p>
      <p className="text-xs text-slate-500 mb-3">{sub}</p>
      <div className="flex flex-wrap gap-1.5 mb-3 min-h-[28px]">
        <AnimatePresence>
          {cols.map(col => (
            <motion.span key={col} initial={{opacity:0,scale:.85}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:.85}}
              className="flex items-center gap-1.5 text-xs bg-white border border-slate-200 text-slate-700 px-2.5 py-1 rounded-full shadow-sm">
              {col}
              <button onClick={() => onRemove(col)} className="text-slate-400 hover:text-red-500 transition-colors">×</button>
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
      <select value="" onChange={e => { if (e.target.value) { onAdd(e.target.value); e.target.value='' } }}
        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-500
          focus:outline-none focus:border-teal-400 transition-colors">
        <option value="">{t('mapper_add_col', lang)}</option>
        {available.map(c => <option key={c.name} value={c.name}>{c.name}  [{c.dtype}]  {c.sample_values?.slice(0,2).join(', ')}</option>)}
      </select>
    </div>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────

export default function ColumnMapperPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { lang } = useLang()

  const [loading, setLoading]   = useState(true)
  const [applying, setApplying] = useState(false)
  const [error, setError]       = useState(null)
  const [applyError, setApplyError] = useState(null)
  const [data, setData]         = useState(null)

  const [fieldMap, setFieldMap]     = useState({})

  const [underlyingAny, setUnderlyingAny]     = useState(null)
  const [underlyingMap, setUnderlyingMap]     = useState({})
  const [customUnderlying, setCustomUnderlying] = useState([])

  const [timeGroups, setTimeGroups] = useState({
    onset:     { date: null, time: null },
    report:    { date: null, time: null },
    treatment: { date: null, time: null },
    exposure:  { date: null, time: null },
  })

  const [placeMap, setPlaceMap]       = useState({})
  const [customPlace, setCustomPlace] = useState([])

  const [deathCol,      setDeathCol]      = useState(null)
  const [hospitalCol,   setHospitalCol]   = useState(null)
  const [customOutcome, setCustomOutcome] = useState([])

  const [symptomBinary,   setSymptomBinary]   = useState([])
  const [symptomCount,    setSymptomCount]    = useState([])
  const [exposureBinary,  setExposureBinary]  = useState([])
  const [exposureNumber,  setExposureNumber]  = useState([])
  const [timeCustom,      setTimeCustom]      = useState([])

  useEffect(() => {
    api.get(`/mapping/${projectId}/columns`).then(res => {
      setData(res.data)
      const fm = {}, um = {}, pm = {}
      const sb = [], sc = [], eb = [], en = [], tc = []
      let ua = null

      res.data.columns.forEach(col => {
        const t = col.suggested_target
        if (!t || t === 'keep') return

        if (TIME_FIELD_MAP[t]) {
          const [grp, sub] = TIME_FIELD_MAP[t]
          setTimeGroups(prev => ({
            ...prev,
            [grp]: { ...prev[grp], [sub]: prev[grp][sub] ?? col.name }
          }))
          return
        }

        if (t.startsWith('symptom_')) { col.dtype === 'numeric' ? sc.push(col.name) : sb.push(col.name); return }
        if (t.startsWith('exposure_')) { col.dtype === 'numeric' ? en.push(col.name) : eb.push(col.name); return }
        if (t.startsWith('time_'))     { tc.push(col.name); return }
        if (t === 'has_underlying')    { ua = col.name; return }
        if (t.startsWith('underlying_')) { if (!um[t]) um[t] = col.name; return }
        if (t === 'hospitalized')      { setHospitalCol(col.name); return }
        if (t === 'outcome')           { setDeathCol(col.name); return }

        if (['province','district','subdistrict','village','address'].includes(t)) { if (!pm[t]) pm[t] = col.name; return }

        if (!fm[t]) fm[t] = col.name
      })

      setFieldMap(fm)
      setUnderlyingMap(um)
      setUnderlyingAny(ua)
      setPlaceMap(pm)
      setSymptomBinary(sb); setSymptomCount(sc)
      setExposureBinary(eb); setExposureNumber(en)
      setTimeCustom(tc)
    })
    .catch(e => setError(e.response?.data?.detail || t('mapper_load_fail', lang)))
    .finally(() => setLoading(false))
  }, [projectId])

  const assignedCols = useMemo(() => {
    const s = new Set(Object.values(fieldMap).filter(Boolean))
    Object.values(underlyingMap).filter(Boolean).forEach(v => s.add(v))
    Object.values(placeMap).filter(Boolean).forEach(v => s.add(v))
    Object.values(timeGroups).forEach(g => { if (g.date) s.add(g.date); if (g.time) s.add(g.time) })
    customUnderlying.forEach(r => r.col && s.add(r.col))
    customPlace.forEach(r => r.col && s.add(r.col))
    customOutcome.forEach(r => r.col && s.add(r.col))
    if (underlyingAny) s.add(underlyingAny)
    if (deathCol)    s.add(deathCol)
    if (hospitalCol) s.add(hospitalCol)
    symptomBinary.forEach(c => s.add(c)); symptomCount.forEach(c => s.add(c))
    exposureBinary.forEach(c => s.add(c)); exposureNumber.forEach(c => s.add(c))
    timeCustom.forEach(c => s.add(c))
    return s
  }, [fieldMap, underlyingMap, placeMap, timeGroups, customUnderlying, customPlace,
      customOutcome, underlyingAny, deathCol, hospitalCol,
      symptomBinary, symptomCount, exposureBinary, exposureNumber, timeCustom])

  const allCols     = data?.columns ?? []
  const avail       = col => allCols.filter(c => !assignedCols.has(c.name) || c.name === col)
  const availFree   = allCols.filter(c => !assignedCols.has(c.name))

  const REQUIRED = ['case_id', 'age', 'sex']
  const onset_ok = !!(timeGroups.onset.date)
  const req_ok   = REQUIRED.map(f => ({ field: f, ok: !!fieldMap[f] }))

  const setField = (fid, col) => setFieldMap(p => {
    const n = { ...p }
    Object.keys(n).forEach(k => { if (n[k] === col && k !== fid) n[k] = null })
    n[fid] = col; return n
  })
  const setUnderlying = (fid, col) => setUnderlyingMap(p => ({ ...p, [fid]: col || null }))
  const setPlace      = (fid, col) => setPlaceMap(p => ({ ...p, [fid]: col || null }))
  const setTimeGroup  = (grp, sub, col) => setTimeGroups(p => ({ ...p, [grp]: { ...p[grp], [sub]: col || null } }))

  const addBucket    = (set, col) => set(p => p.includes(col) ? p : [...p, col])
  const removeBucket = (set, col) => set(p => p.filter(c => c !== col))

  const buildMapping = () => {
    const m = {}
    const sugg = {}
    allCols.forEach(c => { if (c.suggested_target) sugg[c.name] = c.suggested_target })

    Object.entries(fieldMap).forEach(([fid, col]) => { if (col) m[col] = fid })

    if (underlyingAny) m[underlyingAny] = 'has_underlying'
    Object.entries(underlyingMap).forEach(([fid, col]) => { if (col) m[col] = fid })
    customUnderlying.forEach(({ label, col }) => { if (col && label) m[col] = `underlying_${norm(label)}` })

    const TIME_STD = {
      onset:{ date:'date_onset', time:'time_onset' }, report:{ date:'date_report', time:'time_report' },
      treatment:{ date:'date_admitted', time:'time_treatment' }, exposure:{ date:'date_exposure', time:'time_exposure' },
    }
    Object.entries(timeGroups).forEach(([grp, slots]) => {
      if (slots.date) m[slots.date] = TIME_STD[grp].date
      if (slots.time) m[slots.time] = TIME_STD[grp].time
    })
    timeCustom.forEach(col => { m[col] = sugg[col]?.startsWith('time_') ? sugg[col] : `time_${norm(col)}` })

    Object.entries(placeMap).forEach(([fid, col]) => { if (col) m[col] = fid })
    customPlace.forEach(({ label, col }) => { if (col && label) m[col] = `place_${norm(label)}` })

    if (deathCol)    m[deathCol]    = 'date_death'
    if (hospitalCol) m[hospitalCol] = 'hospitalized'
    customOutcome.forEach(({ label, col }) => { if (col && label) m[col] = `outcome_${norm(label)}` })

    symptomBinary.forEach(col  => { m[col] = sugg[col]?.startsWith('symptom_') ? sugg[col] : `symptom_${norm(col)}` })
    symptomCount.forEach(col   => { m[col] = `symptom_count_${norm(col)}` })
    exposureBinary.forEach(col => { m[col] = sugg[col]?.startsWith('exposure_') ? sugg[col] : `exposure_${norm(col)}` })
    exposureNumber.forEach(col => { m[col] = `exposure_num_${norm(col)}` })

    allCols.forEach(c => { if (!m[c.name]) m[c.name] = 'skip' })
    return m
  }

  const handleApply = async () => {
    setApplyError(null)
    setApplying(true)
    try {
      await api.post(`/mapping/${projectId}/apply`, { mapping: buildMapping() })
      navigate(`/data-ready/${projectId}`)
    } catch (e) {
      const d = e.response?.data?.detail
      setApplyError(typeof d === 'string' ? d : JSON.stringify(d))
    } finally { setApplying(false) }
  }

  const scrollTo = id => document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior:'smooth', block:'start' })

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col gap-3">
      <Spinner label={t('mapper_loading', lang)}/>
      <p className="text-xs text-slate-500">{t('mapper_loading_sub', lang)}</p>
    </div>
  )
  if (error) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="bg-white border border-red-200 rounded-2xl p-8 text-red-600 max-w-md text-center shadow-sm">
        <p className="font-semibold mb-2">{t('mapper_error', lang)}</p>
        <p className="text-sm">{error}</p>
      </div>
    </div>
  )

  const NAV = [
    { id:'identifier', labelKey:'sec_identifier', c:'slate' },
    { id:'person',     labelKey:'sec_person',     c:'blue'   },
    { id:'time',       labelKey:'sec_time',       c:'orange' },
    { id:'place',      labelKey:'sec_place',      c:'green'  },
    { id:'outcome',    labelKey:'sec_outcome',    c:'red'    },
    { id:'symptom',    labelKey:'sec_symptom',    c:'purple' },
    { id:'exposure',   labelKey:'sec_exposure',   c:'yellow' },
    { id:'other',      labelKey:'sec_other',      c:'gray'   },
  ]

  const cats = data?.schema_categories ?? {}

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">

      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-slate-900 truncate">{t('mapper_title', lang)} — {data?.filename}</h1>
            </div>
            <p className="text-xs text-slate-500">{data?.row_count?.toLocaleString()} {t('mapper_rows', lang)} · {allCols.length} {t('mapper_cols', lang)} · {assignedCols.size} {t('mapper_mapped', lang)}</p>
          </div>
          <div className="hidden lg:flex items-center gap-1.5">
            {req_ok.map(({ field, ok }) => (
              <span key={field} className={`text-xs px-2 py-0.5 rounded-full border font-mono ${ok ? 'bg-teal-50 border-teal-200 text-teal-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
                {ok ? '✓' : '○'} {field}
              </span>
            ))}
            <span className={`text-xs px-2 py-0.5 rounded-full border font-mono ${onset_ok ? 'bg-teal-50 border-teal-200 text-teal-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
              {onset_ok ? '✓' : '○'} date_onset
            </span>
          </div>
          <button onClick={handleApply} disabled={applying}
            className="btn-primary flex items-center gap-2 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed">
            {applying
              ? <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>{t('mapper_saving', lang)}</>
              : t('mapper_save_btn', lang)
            }
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 flex gap-6">

        {/* Left nav */}
        <nav className="w-36 flex-shrink-0 sticky top-20 self-start space-y-0.5">
          {NAV.map(s => (
            <button key={s.id} onClick={() => scrollTo(s.id)}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors">
              {t(s.labelKey, lang)}
            </button>
          ))}
        </nav>

        {/* Sections */}
        <div className="flex-1 min-w-0 space-y-4">
          <AnimatePresence>
            {applyError && (
              <motion.div initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}} exit={{opacity:0}}
                className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
                {applyError}
              </motion.div>
            )}
          </AnimatePresence>

          {/* 1. Identifier */}
          <SectionCard id="identifier" color="slate" label={t('sec_identifier', lang)} labelEn="Identifier">
            {cats.identifier && Object.entries(cats.identifier.fields).map(([fid, f]) => (
              <ColPicker key={fid} fieldId={fid} label={f.label_en} labelTh={f.label_th}
                required={f.required} value={fieldMap[fid]} onChange={setField}
                available={avail(fieldMap[fid])} allCols={allCols} />
            ))}
          </SectionCard>

          {/* 2. Person */}
          <SectionCard id="person" color="blue" label={t('sec_person', lang)} labelEn="Person">
            {cats.person && ['age','sex','occupation','nationality'].map(fid => {
              const f = cats.person.fields[fid]; if (!f) return null
              return <ColPicker key={fid} fieldId={fid} label={f.label_en} labelTh={f.label_th}
                required={f.required} value={fieldMap[fid]} onChange={setField}
                available={avail(fieldMap[fid])} allCols={allCols} />
            })}

            <div className="mt-5 space-y-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('underlying_label', lang)}</p>

              <ColPicker fieldId="has_underlying" label={t('underlying_any', lang)} labelTh=""
                value={underlyingAny}
                onChange={(_, col) => setUnderlyingAny(col || null)}
                available={avail(underlyingAny)} allCols={allCols} />

              <details className="group">
                <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700 py-1.5 select-none list-none flex items-center gap-1.5">
                  <span className="group-open:rotate-90 transition-transform inline-block text-[10px]">▶</span>
                  {t('underlying_per', lang)}
                </summary>
                <div className="mt-3 grid grid-cols-2 gap-x-4">
                  {UNDERLYING_FIELDS.map(({ id, label }) => (
                    <ColPicker key={id} fieldId={id} label={label} labelTh=""
                      value={underlyingMap[id]}
                      onChange={(fid, col) => setUnderlying(fid, col)}
                      available={avail(underlyingMap[id])} allCols={allCols} />
                  ))}
                </div>
                <div className="mt-3 space-y-2">
                  {customUnderlying.map((r, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input value={r.label} onChange={e => setCustomUnderlying(p => p.map((x,j) => j===i ? {...x,label:e.target.value} : x))}
                        placeholder={t('custom_underlying_placeholder', lang)}
                        className="w-36 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400"/>
                      <select value={r.col} onChange={e => setCustomUnderlying(p => p.map((x,j) => j===i ? {...x,col:e.target.value} : x))}
                        className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-blue-400">
                        <option value="">— เลือกคอลัมน์ —</option>
                        {avail(r.col).map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                      </select>
                      <button onClick={() => setCustomUnderlying(p => p.filter((_,j) => j!==i))} className="text-slate-400 hover:text-red-500 text-lg leading-none px-1">×</button>
                    </div>
                  ))}
                  <button onClick={() => setCustomUnderlying(p => [...p, {label:'',col:''}])}
                    className="text-xs text-blue-600 hover:text-blue-700 transition-colors">{t('add_underlying', lang)}</button>
                </div>
              </details>
            </div>
          </SectionCard>

          {/* 3. Time */}
          <SectionCard id="time" color="orange" label={t('sec_time', lang)} labelEn="Time">
            <p className="text-xs text-slate-500 mb-4"><span className="text-red-500">*</span> {t('mapper_onset_hint', lang)}</p>
            {[
              { key:'onset',     labelKey:'time_onset_label', labelEn:'Onset',           required:true  },
              { key:'report',    labelKey:'time_report_label', labelEn:'Report',          required:false },
              { key:'treatment', labelKey:'time_treat_label',  labelEn:'Treatment/Admit', required:false },
              { key:'exposure',  labelKey:'time_exp_label',    labelEn:'Exposure',        required:false },
            ].map(({ key, labelKey, labelEn, required }) => (
              <details key={key} className="group mb-2 rounded-xl ring-1 ring-slate-200 bg-white overflow-hidden" open={key==='onset'}>
                <summary className="cursor-pointer select-none list-none flex items-center gap-3 px-4 py-3">
                  <span className="group-open:rotate-90 transition-transform text-[10px] text-slate-400">▶</span>
                  <span className="text-sm font-medium text-slate-700">
                    {t(labelKey, lang)} <span className="text-slate-400 font-normal">/ {labelEn}</span>
                    {required && <span className="ml-2 text-xs text-red-500">*</span>}
                  </span>
                  {timeGroups[key].date && (
                    <span className="ml-auto text-xs text-teal-600 font-mono">{timeGroups[key].date}</span>
                  )}
                </summary>
                <div className="border-t border-slate-100 px-4 pb-3 pt-1">
                  <ColPicker fieldId={`${key}_date`} label={t('date_lbl', lang)} labelTh=""
                    required={required}
                    value={timeGroups[key].date}
                    onChange={(_, col) => setTimeGroup(key, 'date', col)}
                    available={avail(timeGroups[key].date)} allCols={allCols} />
                  <ColPicker fieldId={`${key}_time`} label={t('time_lbl', lang)} labelTh=""
                    value={timeGroups[key].time}
                    onChange={(_, col) => setTimeGroup(key, 'time', col)}
                    available={avail(timeGroups[key].time)} allCols={allCols} />
                </div>
              </details>
            ))}
            <div className="mt-4">
              <Bucket label={t('time_custom_label', lang)} sub={t('time_custom_sub', lang)}
                cols={timeCustom} onAdd={c => addBucket(setTimeCustom, c)} onRemove={c => removeBucket(setTimeCustom, c)}
                available={[...availFree, ...timeCustom.map(n=>allCols.find(c=>c.name===n)).filter(Boolean)]}/>
            </div>
          </SectionCard>

          {/* 4. Place */}
          <SectionCard id="place" color="green" label={t('sec_place', lang)} labelEn="Place">
            {cats.place && Object.entries(cats.place.fields).map(([fid, f]) => (
              <ColPicker key={fid} fieldId={fid} label={f.label_en} labelTh={f.label_th}
                value={placeMap[fid]} onChange={(fid, col) => setPlace(fid, col)}
                available={avail(placeMap[fid])} allCols={allCols} />
            ))}
            <div className="mt-4 space-y-2">
              <p className="text-xs text-slate-500">{t('custom_place_note', lang)}</p>
              {customPlace.map((r, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input value={r.label} onChange={e => setCustomPlace(p => p.map((x,j) => j===i ? {...x,label:e.target.value} : x))}
                    placeholder={t('place_placeholder', lang)}
                    className="w-32 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-green-400"/>
                  <select value={r.col} onChange={e => setCustomPlace(p => p.map((x,j) => j===i ? {...x,col:e.target.value} : x))}
                    className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-green-400">
                    <option value="">— เลือกคอลัมน์ —</option>
                    {avail(r.col).map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                  <button onClick={() => setCustomPlace(p => p.filter((_,j)=>j!==i))} className="text-slate-400 hover:text-red-500 text-lg leading-none px-1">×</button>
                </div>
              ))}
              <button onClick={() => setCustomPlace(p => [...p, {label:'',col:''}])}
                className="text-xs text-green-600 hover:text-green-700 transition-colors">{t('add_place', lang)}</button>
            </div>
          </SectionCard>

          {/* 5. Outcome */}
          <SectionCard id="outcome" color="red" label={t('sec_outcome', lang)} labelEn="Outcome">
            <ColPicker fieldId="date_death"  label="เสียชีวิต / Death date" labelTh="วันที่เสียชีวิต"
              value={deathCol} onChange={(_, col) => setDeathCol(col || null)}
              available={avail(deathCol)} allCols={allCols} />
            <ColPicker fieldId="hospitalized" label="เข้ารับรักษา / Hospitalized" labelTh="admit"
              value={hospitalCol} onChange={(_, col) => setHospitalCol(col || null)}
              available={avail(hospitalCol)} allCols={allCols} />
            <div className="mt-4 space-y-2">
              <p className="text-xs text-slate-500">{t('outcome_note', lang)}</p>
              {customOutcome.map((r, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input value={r.label} onChange={e => setCustomOutcome(p => p.map((x,j) => j===i ? {...x,label:e.target.value} : x))}
                    placeholder={t('outcome_placeholder', lang)}
                    className="w-28 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-red-400"/>
                  <select value={r.col} onChange={e => setCustomOutcome(p => p.map((x,j) => j===i ? {...x,col:e.target.value} : x))}
                    className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-red-400">
                    <option value="">— เลือกคอลัมน์ —</option>
                    {avail(r.col).map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                  <button onClick={() => setCustomOutcome(p => p.filter((_,j)=>j!==i))} className="text-slate-400 hover:text-red-500 text-lg leading-none px-1">×</button>
                </div>
              ))}
              <button onClick={() => setCustomOutcome(p => [...p, {label:'',col:''}])}
                className="text-xs text-red-500 hover:text-red-600 transition-colors">{t('add_outcome', lang)}</button>
            </div>
          </SectionCard>

          {/* 6. Symptom */}
          <SectionCard id="symptom" color="purple" label={t('sec_symptom', lang)} labelEn="Symptoms">
            <div className="grid grid-cols-2 gap-4">
              <Bucket label={t('symptom_binary_label', lang)} sub={t('symptom_binary_sub', lang)}
                cols={symptomBinary} onAdd={c => addBucket(setSymptomBinary, c)} onRemove={c => removeBucket(setSymptomBinary, c)}
                available={[...availFree, ...symptomBinary.map(n=>allCols.find(c=>c.name===n)).filter(Boolean)]}/>
              <Bucket label={t('symptom_count_label', lang)} sub={t('symptom_count_sub', lang)}
                cols={symptomCount} onAdd={c => addBucket(setSymptomCount, c)} onRemove={c => removeBucket(setSymptomCount, c)}
                available={[...availFree, ...symptomCount.map(n=>allCols.find(c=>c.name===n)).filter(Boolean)]}/>
            </div>
          </SectionCard>

          {/* 7. Exposure */}
          <SectionCard id="exposure" color="yellow" label={t('sec_exposure', lang)} labelEn="Exposure">
            <div className="grid grid-cols-2 gap-4">
              <Bucket label={t('exposure_binary_label', lang)} sub={t('exposure_binary_sub', lang)}
                cols={exposureBinary} onAdd={c => addBucket(setExposureBinary, c)} onRemove={c => removeBucket(setExposureBinary, c)}
                available={[...availFree, ...exposureBinary.map(n=>allCols.find(c=>c.name===n)).filter(Boolean)]}/>
              <Bucket label={t('exposure_num_label', lang)} sub={t('exposure_num_sub', lang)}
                cols={exposureNumber} onAdd={c => addBucket(setExposureNumber, c)} onRemove={c => removeBucket(setExposureNumber, c)}
                available={[...availFree, ...exposureNumber.map(n=>allCols.find(c=>c.name===n)).filter(Boolean)]}/>
            </div>
          </SectionCard>

          {/* 8. Other */}
          <SectionCard id="other" color="gray" label={t('sec_other_long', lang)} labelEn="Other (skipped)">
            {availFree.length === 0
              ? <p className="text-sm text-teal-600">{t('mapper_all_mapped', lang)}</p>
              : <div className="flex flex-wrap gap-2">
                  {availFree.map(col => (
                    <span key={col.name} className="text-xs bg-white border border-slate-200 text-slate-500 px-3 py-1.5 rounded-full">
                      {col.name}
                    </span>
                  ))}
                </div>
            }
            {availFree.length > 0 && <p className="text-xs text-slate-400 mt-3">{t('mapper_skipped_note', lang)}</p>}
          </SectionCard>

        </div>
      </div>
    </div>
  )
}
