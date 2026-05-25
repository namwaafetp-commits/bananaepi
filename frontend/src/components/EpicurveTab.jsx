import { useEffect, useState, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell,
} from 'recharts'
import api from '../api/client'
import Spinner from './Spinner'

const TABS = [
  { val: 'hour',  label: 'รายชั่วโมง' },
  { val: 'day',   label: 'รายวัน' },
  { val: 'week',  label: 'รายสัปดาห์' },
  { val: 'month', label: 'รายเดือน' },
]
const HOUR_INTERVALS = [1, 2, 3, 4, 5, 6, 8, 12]
const COL_HEADER = { hour: 'ชั่วโมง', day: 'วันที่', week: 'สัปดาห์', month: 'เดือน' }

export const CHART_COLORS = [
  '#14b8a6','#3b82f6','#f59e0b','#ef4444',
  '#a855f7','#ec4899','#22c55e','#f97316',
  '#06b6d4','#8b5cf6','#84cc16','#fb923c',
]

const AXIS = { fill: '#94a3b8', fontSize: 11 }
const GRID = { stroke: 'rgba(255,255,255,0.06)', strokeDasharray: '3 3' }
const TT_STYLE = {
  background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + (p.value || 0), 0)
  return (
    <div style={TT_STYLE}>
      <p style={{ color: '#94a3b8', fontSize: 11, marginBottom: 6 }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.fill, flexShrink: 0 }} />
          <span style={{ color: '#94a3b8', fontSize: 12 }}>{p.name}:</span>
          <span style={{ color: '#f1f5f9', fontSize: 12, fontWeight: 600 }}>{p.value.toLocaleString()}</span>
        </div>
      ))}
      {payload.length > 1 && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 6, paddingTop: 6, display: 'flex', gap: 8 }}>
          <span style={{ color: '#94a3b8', fontSize: 12 }}>รวม:</span>
          <span style={{ color: '#f1f5f9', fontSize: 12, fontWeight: 700 }}>{total.toLocaleString()}</span>
        </div>
      )}
    </div>
  )
}

export default function EpicurveTab({ projectId }) {
  const [by, setBy]           = useState('day')
  const [interval, setInterval] = useState(1)
  const [stackBy, setStackBy] = useState('')
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const fetchData = useCallback(() => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    const params = { by, interval }
    if (stackBy) params.stack_by = stackBy
    api.get(`/analysis/${projectId}/epicurve`, { params })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.detail || 'โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false))
  }, [projectId, by, interval, stackBy])

  useEffect(() => { fetchData() }, [fetchData])

  const isStacked   = stackBy && data?.stack_keys?.length > 0
  const chartData   = isStacked ? (data?.stack_rows ?? []) : (data?.rows ?? [])
  const stackKeys   = data?.stack_keys ?? []
  const availStack  = data?.available_stack ?? []
  const maxCount    = Math.max(...(data?.rows ?? []).map(r => r.count), 1)

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Mode tabs */}
        <div className="flex rounded-xl overflow-hidden border border-slate-200 bg-white">
          {TABS.map(t => (
            <button key={t.val} onClick={() => setBy(t.val)}
              className={`px-4 py-1.5 text-sm font-medium transition-colors
                ${by === t.val ? 'bg-teal-500 text-white' : 'text-slate-500 hover:text-slate-800'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Hour interval */}
        {by === 'hour' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">ทุก</span>
            {HOUR_INTERVALS.map(h => (
              <button key={h} onClick={() => setInterval(h)}
                className={`w-8 h-7 rounded-lg text-xs font-medium transition-colors border
                  ${interval === h
                    ? 'bg-teal-600 border-teal-500 text-white'
                    : 'border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
                {h}
              </button>
            ))}
            <span className="text-xs text-slate-500">ชม.</span>
          </div>
        )}

        {/* Stack-by selector */}
        {availStack.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-slate-500">แบ่งกลุ่มตาม:</span>
            <select
              value={stackBy}
              onChange={e => setStackBy(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg text-sm text-slate-700 px-3 py-1.5
                         focus:outline-none focus:border-teal-500 cursor-pointer">
              <option value="">ไม่แบ่งกลุ่ม</option>
              {availStack.map(s => (
                <option key={s.col} value={s.col}>{s.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-16"><Spinner label="กำลังโหลดข้อมูล…" /></div>
      )}

      {error && !loading && (
        <div className="card p-5 border-red-200 bg-red-50">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {!loading && data && chartData.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">
            เส้นโค้งระบาด — {TABS.find(t => t.val === by)?.label}
            {isStacked && (
              <span className="ml-2 text-xs font-normal text-teal-400">
                แบ่งตาม {availStack.find(s => s.col === stackBy)?.label}
              </span>
            )}
          </h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
              <CartesianGrid {...GRID} />
              <XAxis
                dataKey="label"
                tick={{ ...AXIS }}
                angle={-40} textAnchor="end"
                interval="preserveStartEnd"
              />
              <YAxis tick={{ ...AXIS }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              {isStacked && <Legend wrapperStyle={{ paddingTop: 8, fontSize: 12, color: '#94a3b8' }} />}

              {isStacked
                ? stackKeys.map((key, i) => (
                    <Bar key={key} dataKey={key} stackId="a"
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                      radius={i === stackKeys.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
                  ))
                : (
                    <Bar dataKey="count" name="ผู้ป่วย" radius={[3, 3, 0, 0]}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[0]} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  )
              }
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Data table */}
      {!loading && (data?.rows ?? []).length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-800">
              จำนวนผู้ป่วย{TABS.find(t => t.val === by)?.label}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left px-5 py-3 text-xs text-slate-500 font-medium uppercase tracking-wide">
                    {COL_HEADER[by]}
                  </th>
                  <th className="text-right px-5 py-3 text-xs text-slate-500 font-medium uppercase tracking-wide">ผู้ป่วย</th>
                  <th className="px-5 py-3 text-xs text-slate-500 font-medium uppercase tracking-wide">สัดส่วน</th>
                </tr>
              </thead>
              <tbody>
                {(data?.rows ?? []).map((row, i) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-5 py-2.5 font-mono text-xs text-slate-700">{row.label}</td>
                    <td className="px-5 py-2.5 text-right text-slate-800 font-medium">{row.count.toLocaleString()}</td>
                    <td className="px-5 py-2.5">
                      <div className="h-1.5 rounded-full bg-slate-200 w-32">
                        <div className="h-1.5 rounded-full bg-teal-500"
                          style={{ width: `${(row.count / maxCount) * 100}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
