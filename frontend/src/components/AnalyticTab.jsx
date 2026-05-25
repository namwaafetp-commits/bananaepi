import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import api from '../api/client'
import Spinner from './Spinner'
import clsx from 'clsx'

const MEASURES = [
  { val: 'rr', label: 'RR', desc: 'Risk Ratio' },
  { val: 'or', label: 'OR', desc: 'Odds Ratio' },
]

const TT_STYLE = {
  background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
}

function ARTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const exp   = payload.find(p => p.dataKey === 'exposed')
  const unexp = payload.find(p => p.dataKey === 'unexposed')
  return (
    <div style={TT_STYLE}>
      <p style={{ color: '#f1f5f9', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{label}</p>
      {exp && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
          <span style={{ color: '#94a3b8', fontSize: 12 }}>สัมผัส:</span>
          <span style={{ color: '#f1f5f9', fontSize: 12, fontWeight: 600 }}>{exp.value?.toFixed(1)}%</span>
          <span style={{ color: '#475569', fontSize: 11 }}>({exp.payload.exposed_cases}/{exp.payload.exposed_total})</span>
        </div>
      )}
      {unexp && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
          <span style={{ color: '#94a3b8', fontSize: 12 }}>ไม่สัมผัส:</span>
          <span style={{ color: '#f1f5f9', fontSize: 12, fontWeight: 600 }}>{unexp.value?.toFixed(1)}%</span>
          <span style={{ color: '#475569', fontSize: 11 }}>({unexp.payload.unexposed_cases}/{unexp.payload.unexposed_total})</span>
        </div>
      )}
    </div>
  )
}

function MeasureBadge({ value, significant, measure }) {
  if (value == null) return <span className="text-slate-600">—</span>
  const cls = clsx(
    'inline-block px-2.5 py-0.5 rounded-lg font-mono text-sm font-semibold',
    significant && value >= 3   ? 'bg-red-50    text-red-700    border border-red-200'       :
    significant && value >= 1.5 ? 'bg-orange-50 text-orange-700 border border-orange-200'    :
    significant && value < 1    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
    significant                 ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'    :
                                  'bg-slate-100  text-slate-600  border border-slate-200'
  )
  return <span className={cls}>{value.toFixed(2)}</span>
}

function ForestPlot({ results, measure }) {
  const valid = results.filter(r => !r.error && r.rr != null && r.ci_lower != null && r.ci_upper != null)
  if (!valid.length) return <p className="text-slate-500 text-sm text-center py-8">ไม่มีข้อมูลเพียงพอสำหรับ Forest Plot</p>

  const allVals = valid.flatMap(r => [r.ci_lower, r.rr, r.ci_upper]).filter(v => v > 0)
  const rawLogMin = Math.min(...allVals.map(Math.log10))
  const rawLogMax = Math.max(...allVals.map(Math.log10))
  const pad = Math.max((rawLogMax - rawLogMin) * 0.18, 0.3)
  const logMin = rawLogMin - pad
  const logMax = rawLogMax + pad

  const PW = 280
  const rowH = 34
  const toX = v => v > 0 ? Math.max(2, Math.min(PW - 2, ((Math.log10(v) - logMin) / (logMax - logMin)) * PW)) : 0
  const nullX = toX(1)

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">การสัมผัส</th>
            <th className="py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide" style={{minWidth: PW}}>Forest Plot</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">
              {measure.toUpperCase()} (95% CI)
            </th>
          </tr>
        </thead>
        <tbody>
          {valid.map((r, i) => {
            const x1  = toX(r.ci_lower)
            const x2  = toX(r.ci_upper)
            const xc  = toX(r.rr)
            const mid = rowH / 2
            const sig = r.significant
            const stroke = sig ? '#ef4444' : '#475569'
            const fill   = sig ? '#ef4444' : '#64748b'

            return (
              <motion.tr key={r.column || i}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                className={clsx('border-b border-slate-100', sig ? 'bg-red-50' : '')}>
                <td className="px-4 py-1 text-xs font-medium whitespace-nowrap"
                    style={{ color: sig ? '#b91c1c' : '#334155' }}>
                  {sig && <span className="mr-1 text-red-400 font-bold">★</span>}
                  {r.exposure}
                </td>
                <td className="py-1" style={{minWidth: PW}}>
                  <svg width={PW} height={rowH} style={{ overflow: 'visible', display: 'block' }}>
                    {/* null-effect dashed line */}
                    <line x1={nullX} y1={2} x2={nullX} y2={rowH - 2}
                          stroke="rgba(255,255,255,0.18)" strokeDasharray="3 2" strokeWidth={1} />
                    {/* CI whisker */}
                    <line x1={x1} y1={mid} x2={x2} y2={mid}
                          stroke={stroke} strokeWidth={sig ? 2.5 : 1.5} />
                    {/* CI end caps */}
                    <line x1={x1} y1={mid - 4} x2={x1} y2={mid + 4} stroke={stroke} strokeWidth={1.5} />
                    <line x1={x2} y1={mid - 4} x2={x2} y2={mid + 4} stroke={stroke} strokeWidth={1.5} />
                    {/* Point estimate */}
                    {sig ? (
                      <polygon
                        points={`${xc},${mid - 8} ${xc + 8},${mid} ${xc},${mid + 8} ${xc - 8},${mid}`}
                        fill="#ef4444" stroke="#fca5a5" strokeWidth={1.5} />
                    ) : (
                      <rect x={xc - 5} y={mid - 5} width={10} height={10}
                            fill={fill} opacity={0.75}
                            transform={`rotate(45 ${xc} ${mid})`} />
                    )}
                  </svg>
                </td>
                <td className="px-4 py-1 text-right font-mono text-xs whitespace-nowrap"
                    style={{ color: sig ? '#b91c1c' : '#64748b' }}>
                  <span className={sig ? 'font-bold' : ''}>{r.rr?.toFixed(2)}</span>
                  <span className="text-slate-400 ml-1 text-[10px]">
                    ({r.ci_lower?.toFixed(2)}–{r.ci_upper?.toFixed(2)})
                  </span>
                </td>
              </motion.tr>
            )
          })}
        </tbody>
      </table>
      <div className="flex items-center gap-6 px-4 py-2 border-t border-slate-200 text-xs text-slate-500 flex-wrap">
        <span className="flex items-center gap-1.5">
          <svg width={14} height={14}><polygon points="7,0 14,7 7,14 0,7" fill="#ef4444" /></svg>
          มีนัยสำคัญ (p&lt;0.05)
        </span>
        <span className="flex items-center gap-1.5">
          <svg width={10} height={10}><rect x={0} y={0} width={10} height={10} fill="#64748b" transform="rotate(45 5 5)" /></svg>
          ไม่มีนัยสำคัญ
        </span>
        <span className="flex items-center gap-1.5">
          <svg width={22} height={10}><line x1={11} y1={0} x2={11} y2={10} stroke="rgba(255,255,255,0.3)" strokeDasharray="3 2" strokeWidth={1} /></svg>
          Null effect (1.0)
        </span>
      </div>
    </div>
  )
}

function SigBadge({ significant }) {
  if (significant == null) return <span className="text-slate-600">—</span>
  return significant ? (
    <span className="flex items-center gap-1.5 text-emerald-700 text-xs font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />มีนัยสำคัญ
    </span>
  ) : (
    <span className="flex items-center gap-1.5 text-slate-500 text-xs">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />ไม่มีนัยสำคัญ
    </span>
  )
}

export default function AnalyticTab({ projectId }) {
  const [measure, setMeasure] = useState('rr')
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const fetchData = useCallback(() => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    api.get(`/analysis/${projectId}/analytic`, { params: { measure } })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.detail || 'โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false))
  }, [projectId, measure])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return (
    <div className="flex justify-center py-16"><Spinner label="กำลังวิเคราะห์…" /></div>
  )

  if (error) return (
    <div className="card p-8 text-center">
      <p className="text-slate-400 font-medium mb-1">เกิดข้อผิดพลาด</p>
      <p className="text-sm text-slate-500">{error}</p>
    </div>
  )

  if (!data) return null

  if (data.error) return (
    <div className="card p-8 text-center">
      <p className="text-slate-400 font-medium mb-1">ไม่สามารถวิเคราะห์ได้</p>
      <p className="text-sm text-slate-500">{data.error}</p>
      <p className="text-xs text-slate-600 mt-3">
        เพิ่มคอลัมน์ <code className="bg-slate-100 px-1 rounded">case_status</code> (1 = ผู้ป่วย, 0 = ไม่ป่วย)
      </p>
    </div>
  )

  const results       = data.results ?? []
  const sigCount      = data.significant_exposures ?? 0
  const measureShort  = measure === 'or' ? 'OR' : 'RR'
  const measureLabel  = measure === 'or' ? 'OR (Odds Ratio)' : 'RR (Risk Ratio)'

  // Attack rate chart data — top 12 sorted by measure value
  const arData = results
    .filter(r => !r.error && r.rr != null)
    .sort((a, b) => (b.rr ?? 0) - (a.rr ?? 0))
    .slice(0, 12)
    .map(r => ({
      name:             r.exposure,
      exposed:          r.ar_exposed_pct,
      unexposed:        r.ar_unexposed_pct,
      exposed_cases:    r.exposed_cases,
      exposed_total:    r.exposed_total,
      unexposed_cases:  r.unexposed_cases,
      unexposed_total:  r.unexposed_total,
      significant:      r.significant,
    }))

  return (
    <div className="space-y-5">
      {/* Measure toggle */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-600">มาตรวัดความเสี่ยง:</span>
        <div className="flex rounded-xl overflow-hidden border border-slate-200 bg-white">
          {MEASURES.map(m => (
            <button key={m.val} onClick={() => setMeasure(m.val)}
              className={`px-5 py-1.5 text-sm font-semibold transition-colors
                ${measure === m.val ? 'bg-teal-500 text-white' : 'text-slate-500 hover:text-slate-800'}`}>
              {m.label}
              <span className="ml-1.5 text-xs font-normal opacity-70">{m.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="card p-4 flex flex-wrap gap-6">
        {[
          { label: 'ปัจจัยเสี่ยงที่วิเคราะห์',  value: data.exposures_analyzed },
          { label: 'มีนัยสำคัญ (p<0.05)',          value: sigCount,
            cls: sigCount > 0 ? 'text-emerald-400' : undefined },
          { label: 'จำนวนผู้ถูกสอบสวน',           value: data.total_records?.toLocaleString() },
          { label: 'มาตรวัด',                      value: measureLabel,
            cls: 'text-teal-400 text-sm font-medium' },
        ].map(s => (
          <div key={s.label}>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{s.label}</p>
            <p className={clsx('font-display text-2xl text-slate-900', s.cls)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Attack rate chart — Recharts grouped bar */}
      {arData.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">อัตราป่วยตามการสัมผัส</h3>
          <p className="text-xs text-slate-500 mb-4">แดง = สัมผัส · เขียว = ไม่สัมผัส (hover เพื่อดูรายละเอียด)</p>
          <ResponsiveContainer width="100%" height={Math.max(260, arData.length * 38)}>
            <BarChart data={arData} layout="vertical"
              margin={{ top: 4, right: 48, left: 8, bottom: 4 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickFormatter={v => `${v}%`} domain={[0, 100]} />
              <YAxis type="category" dataKey="name" width={130}
                tick={{ fill: '#cbd5e1', fontSize: 11 }} />
              <Tooltip content={<ARTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8', paddingTop: 8 }} />
              <Bar dataKey="exposed"   name="สัมผัส"     fill="#ef4444" fillOpacity={0.8} radius={[0, 3, 3, 0]} />
              <Bar dataKey="unexposed" name="ไม่สัมผัส"  fill="#22c55e" fillOpacity={0.8} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Forest plot — native SVG, significant rows in red */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900">Forest Plot — {measureLabel} (95% CI)</h3>
        </div>
        <ForestPlot results={results} measure={measure} />
      </div>

      {/* Results table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900">
            ตารางสรุป{measure === 'or' ? 'อัตราต่อ (Odds Ratio)' : 'อัตราเสี่ยง (Risk Ratio)'}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {measureShort} &gt; 1 = ปัจจัยเสี่ยง · {measureShort} &lt; 1 = ปัจจัยป้องกัน · ★ = p &lt; 0.05
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {['การสัมผัส','อัตราป่วย (สัมผัส)','อัตราป่วย (ไม่สัมผัส)',
                  measureShort,'95% CI','ค่า p','นัยสำคัญ'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <motion.tr key={r.column || i}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                  className={clsx('border-b border-slate-100 transition-colors',
                    r.significant
                      ? 'bg-red-50 hover:bg-red-100 border-l-2 border-l-red-400'
                      : 'hover:bg-slate-50')}>
                  {r.error ? (
                    <>
                      <td className="px-4 py-3 text-slate-700 font-medium">{r.exposure ?? r.column}</td>
                      <td colSpan={6} className="px-4 py-3 text-slate-600 text-xs italic">{r.error}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-medium whitespace-nowrap"
                          style={{ color: r.significant ? '#b91c1c' : '#1e293b' }}>
                        {r.significant && <span className="mr-1.5 text-red-400 font-bold">★</span>}
                        {r.exposure}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {r.ar_exposed_pct?.toFixed(1)}%
                        <span className="text-xs text-slate-600 ml-1">({r.exposed_cases}/{r.exposed_total})</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {r.ar_unexposed_pct?.toFixed(1)}%
                        <span className="text-xs text-slate-600 ml-1">({r.unexposed_cases}/{r.unexposed_total})</span>
                      </td>
                      <td className="px-4 py-3"><MeasureBadge value={r.rr} significant={r.significant} measure={measure} /></td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                        {r.ci_lower != null ? `${r.ci_lower.toFixed(2)} – ${r.ci_upper.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        {r.p_value != null ? (r.p_value < 0.0001 ? '<0.0001' : r.p_value.toFixed(4)) : '—'}
                      </td>
                      <td className="px-4 py-3"><SigBadge significant={r.significant} /></td>
                    </>
                  )}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-slate-200 text-xs text-slate-600">
          CI = ช่วงเชื่อมั่น 95% (log–Woolf) · Chi-square หรือ Fisher's exact (ถ้าความถี่คาดหวัง &lt; 5)
        </div>
      </div>
    </div>
  )
}
