import { motion } from 'framer-motion'
import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const SEX_TH     = { Male: 'ชาย', Female: 'หญิง', Unknown: 'ไม่ทราบ' }
const OUTCOME_TH = { Alive: 'มีชีวิต', Dead: 'เสียชีวิต', Unknown: 'ไม่ทราบ' }

function StatCard({ label, value, sub, accent }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
      <p className="text-xs font-medium tracking-wide uppercase text-slate-500 mb-2">{label}</p>
      <p className={`font-display text-3xl ${accent ? 'text-teal-600' : 'text-slate-900'}`}>{value ?? '—'}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </motion.div>
  )
}

function DistRow({ label, count, total, color = 'bg-teal-500' }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-700">{label}</span>
        <span className="text-slate-500">{count} <span className="text-slate-400">({pct}%)</span></span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-200">
        <div className={`h-1.5 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

const TT_STYLE = {
  background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
}

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div style={TT_STYLE}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.payload.color, flexShrink: 0 }} />
        <span style={{ color: '#f1f5f9', fontSize: 12, fontWeight: 600 }}>{p.name}</span>
      </div>
      <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>
        {p.value.toLocaleString()} ราย · {p.payload.pct?.toFixed(1)}%
      </div>
    </div>
  )
}

function DonutChart({ data, colors }) {
  const [active, setActive] = useState(null)
  return (
    <ResponsiveContainer width={140} height={140}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={42} outerRadius={62}
          dataKey="value" paddingAngle={2}
          onMouseEnter={(_, i) => setActive(i)}
          onMouseLeave={() => setActive(null)}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color ?? colors[i % colors.length]}
              stroke="transparent"
              opacity={active === null || active === i ? 1 : 0.4} />
          ))}
        </Pie>
        <Tooltip content={<PieTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  )
}

// ── Geographic distribution component ────────────────────────────────────────
function GeoDistribution({ data }) {
  const levels = Object.entries(data)   // [[ 'province', { label, data } ], ...]
  const [activeTab, setActiveTab] = useState(levels[0]?.[0] ?? '')

  if (!levels.length) return null

  const current = data[activeTab]
  const rows = current
    ? Object.entries(current.data).sort((a, b) => b[1].count - a[1].count)
    : []
  const maxCount = rows[0]?.[1]?.count ?? 1

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-slate-900 mb-4">การกระจายทางภูมิศาสตร์</h3>

      {/* Tab bar */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {levels.map(([key, lvl]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              activeTab === key
                ? 'bg-teal-50 text-teal-700 border border-teal-200'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-transparent'
            }`}>
            {lvl.label}
            <span className="ml-1.5 text-[10px] opacity-60">({Object.keys(lvl.data).length})</span>
          </button>
        ))}
      </div>

      {/* Rows */}
      <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
        {rows.map(([name, d]) => (
          <div key={name}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-700 truncate max-w-[60%]" title={name}>{name}</span>
              <span className="text-slate-500 flex-shrink-0 ml-2">
                {d.count.toLocaleString()} ราย
                <span className="text-slate-400 ml-1">({d.percent?.toFixed(1) ?? 0}%)</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-200">
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${(d.count / maxCount) * 100}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="h-1.5 rounded-full bg-teal-500/70"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function OverviewTab({ descriptive, metadata }) {
  if (!descriptive) return null

  const { summary, case_status, sex_distribution, age_statistics,
          outcome_distribution, case_fatality_rate_pct, lab_confirmation,
          hospitalization, geographic_distribution, district_distribution, symptoms } = descriptive

  const dr     = summary?.date_range
  const cases  = case_status?.cases ?? summary?.total_records ?? 0
  const total  = case_status?.total_investigated ?? summary?.total_records ?? 0
  const ar     = case_status?.overall_attack_rate_pct
  const sexTotal = sex_distribution
    ? Object.values(sex_distribution).reduce((s, v) => s + v.count, 0) : 0

  return (
    <div className="space-y-6">
      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="ผู้ถูกสอบสวนทั้งหมด" value={total.toLocaleString()} sub={metadata?.original_filename} />
        <StatCard label="ผู้ป่วย" value={cases.toLocaleString()} accent />
        <StatCard label="อัตราป่วย" value={ar != null ? `${ar.toFixed(1)}%` : '—'} sub="ภาพรวม" accent={ar != null} />
        <StatCard label="ระยะเวลา" value={summary?.duration_days != null ? `${summary.duration_days} วัน` : '—'}
          sub={dr ? `${dr.start} ถึง ${dr.end}` : undefined} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="อัตราผู้ป่วยตาย (CFR)"
          value={case_fatality_rate_pct != null ? `${case_fatality_rate_pct.toFixed(1)}%` : '—'} />
        <StatCard label="ยืนยันทางห้องปฏิบัติการ" value={lab_confirmation?.confirmed ?? '—'}
          sub={lab_confirmation?.confirmation_rate_pct != null
            ? `${lab_confirmation.confirmation_rate_pct.toFixed(1)}% ของผู้ป่วย` : undefined} />
        <StatCard label="เข้ารับการรักษา" value={hospitalization?.hospitalized ?? '—'}
          sub={hospitalization?.hospitalization_rate_pct != null
            ? `${hospitalization.hospitalization_rate_pct.toFixed(1)}%` : undefined} />
        <StatCard label="อายุมัธยฐาน"
          value={age_statistics?.median != null ? `${age_statistics.median} ปี` : '—'}
          sub={age_statistics ? `ช่วง ${age_statistics.min}–${age_statistics.max} ปี` : undefined} />
      </div>

      {/* Sex + Outcomes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sex_distribution && (() => {
          const SEX_COLORS = { Male: '#3b82f6', Female: '#ec4899', Unknown: '#6b7280' }
          const pieData = Object.entries(sex_distribution).map(([sex, d]) => ({
            name: SEX_TH[sex] || sex, value: d.count,
            color: SEX_COLORS[sex] ?? '#6b7280', pct: d.percent,
          }))
          return (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">การกระจายตามเพศ</h3>
              <div className="flex items-center gap-4">
                <DonutChart data={pieData} colors={['#3b82f6','#ec4899','#6b7280']} />
                <div className="space-y-2.5 flex-1">
                  {Object.entries(sex_distribution).map(([sex, d]) => (
                    <DistRow key={sex} label={SEX_TH[sex] || sex} count={d.count} total={sexTotal}
                      color={sex === 'Male' ? 'bg-blue-500' : sex === 'Female' ? 'bg-pink-500' : 'bg-slate-500'} />
                  ))}
                </div>
              </div>
            </div>
          )
        })()}
        {outcome_distribution && (() => {
          const OUT_COLORS = { Dead: '#ef4444', Alive: '#22c55e', Unknown: '#6b7280' }
          const pieData = Object.entries(outcome_distribution).map(([out, d]) => ({
            name: OUTCOME_TH[out] || out, value: d.count,
            color: OUT_COLORS[out] ?? '#6b7280', pct: d.percent,
          }))
          return (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">ผลลัพธ์</h3>
              <div className="flex items-center gap-4">
                <DonutChart data={pieData} colors={['#22c55e','#ef4444','#6b7280']} />
                <div className="space-y-2.5 flex-1">
                  {Object.entries(outcome_distribution).map(([outcome, d]) => (
                    <DistRow key={outcome} label={OUTCOME_TH[outcome] || outcome}
                      count={d.count} total={total}
                      color={outcome === 'Dead' ? 'bg-red-500' : outcome === 'Alive' ? 'bg-emerald-500' : 'bg-slate-500'} />
                  ))}
                  {case_fatality_rate_pct != null && (
                    <p className="text-xs text-slate-500 pt-1">CFR: {case_fatality_rate_pct.toFixed(1)}%</p>
                  )}
                </div>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Symptoms */}
      {symptoms && Object.keys(symptoms).length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">ความถี่ของอาการ (ในกลุ่มผู้ป่วย)</h3>
          <div className="space-y-3">
            {Object.entries(symptoms)
              .sort((a, b) => (b[1].percent ?? 0) - (a[1].percent ?? 0))
              .map(([name, d]) => (
                <DistRow key={name} label={name} count={d.count} total={cases} />
              ))}
          </div>
        </div>
      )}

      {/* Geographic distribution — tabbed by level */}
      {geographic_distribution && Object.keys(geographic_distribution).length > 0
        ? <GeoDistribution data={geographic_distribution} />
        : district_distribution && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">การกระจายทางภูมิศาสตร์</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(district_distribution).map(([d, n]) => (
                  <span key={d} className="tag-gray">{d} · {n} ราย</span>
                ))}
              </div>
            </div>
          )
      }

      {/* Validation warnings */}
      {metadata?.validation?.warnings?.length > 0 && (
        <div className="card p-4 border border-amber-200 bg-amber-50">
          <p className="text-xs font-semibold text-amber-700 mb-2 uppercase tracking-wide">คำเตือนการตรวจสอบข้อมูล</p>
          <ul className="space-y-1">
            {metadata.validation.warnings.map((w, i) => (
              <li key={i} className="text-xs text-amber-700/80 flex gap-2"><span className="shrink-0">·</span>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
