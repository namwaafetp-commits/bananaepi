import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, LabelList,
} from 'recharts'

const TT_STYLE = {
  background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
}

function PyramidTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={TT_STYLE}>
      <p style={{ color: '#f1f5f9', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{label} ปี</p>
      {payload.map((p, i) => {
        const abs = Math.abs(p.value)
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.fill, flexShrink: 0 }} />
            <span style={{ color: '#94a3b8', fontSize: 12 }}>{p.name}:</span>
            <span style={{ color: '#f1f5f9', fontSize: 12, fontWeight: 600 }}>{abs.toLocaleString()}</span>
          </div>
        )
      })}
    </div>
  )
}

function SymptomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div style={TT_STYLE}>
      <p style={{ color: '#f1f5f9', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{label}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <span style={{ color: '#94a3b8', fontSize: 12 }}>ร้อยละ:</span>
        <span style={{ color: '#14b8a6', fontSize: 12, fontWeight: 700 }}>{p.value?.toFixed(1)}%</span>
      </div>
      {p.payload.count != null && (
        <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
          <span style={{ color: '#94a3b8', fontSize: 12 }}>จำนวน:</span>
          <span style={{ color: '#f1f5f9', fontSize: 12 }}>{p.payload.count?.toLocaleString()} ราย</span>
        </div>
      )}
    </div>
  )
}

function AgeSexPyramid({ data }) {
  if (!data?.length) return null

  const pyramidData = data.map(d => ({
    age_group: d.age_group,
    male:      -d.male,
    female:    d.female,
    maleAbs:   d.male,
  }))
  const maxVal = Math.max(...data.map(d => Math.max(d.male, d.female)), 1)
  const domain = [-(maxVal + 2), maxVal + 2]

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-slate-900 mb-1">พีระมิดอายุ–เพศ</h3>
      <p className="text-xs text-slate-500 mb-4">ชาย (ซ้าย) · หญิง (ขวา)</p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={pyramidData} layout="vertical"
          margin={{ top: 4, right: 32, left: 8, bottom: 4 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" domain={domain}
            tickFormatter={v => Math.abs(v).toLocaleString()}
            tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <YAxis type="category" dataKey="age_group" width={42}
            tick={{ fill: '#cbd5e1', fontSize: 11 }}
            tickFormatter={v => `${v}`} />
          <Tooltip content={<PyramidTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <ReferenceLine x={0} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
          <Bar dataKey="male"   name="ชาย"  fill="#3b82f6" fillOpacity={0.82} radius={[0, 0, 0, 0]} />
          <Bar dataKey="female" name="หญิง" fill="#ec4899" fillOpacity={0.82} radius={[0, 0, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-6 mt-2">
        <span className="flex items-center gap-1.5 text-xs text-slate-600">
          <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />ชาย
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-600">
          <span className="w-3 h-3 rounded-sm bg-pink-500 inline-block" />หญิง
        </span>
      </div>
    </div>
  )
}

function SymptomChart({ symptoms }) {
  if (!symptoms || Object.keys(symptoms).length === 0) return null

  const data = Object.entries(symptoms)
    .map(([name, d]) => ({ name, percent: d.percent ?? 0, count: d.count }))
    .sort((a, b) => b.percent - a.percent)

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-slate-900 mb-1">ความถี่ของอาการในกลุ่มผู้ป่วย</h3>
      <p className="text-xs text-slate-500 mb-4">hover เพื่อดูจำนวน</p>
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
        <BarChart data={data} layout="vertical"
          margin={{ top: 4, right: 56, left: 8, bottom: 4 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickFormatter={v => `${v}%`} domain={[0, 100]} />
          <YAxis type="category" dataKey="name" width={130}
            tick={{ fill: '#cbd5e1', fontSize: 11 }} />
          <Tooltip content={<SymptomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="percent" radius={[0, 4, 4, 0]} fill="#14b8a6" fillOpacity={0.85}>
            <LabelList dataKey="percent" position="right"
              formatter={v => `${v?.toFixed(1)}%`}
              style={{ fill: '#94a3b8', fontSize: 11 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function PersonTab({ descriptive }) {
  if (!descriptive) return null
  const { age_statistics, age_group_distribution, age_sex_distribution, symptoms } = descriptive

  return (
    <div className="space-y-4">
      {/* Age statistics */}
      {age_statistics && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">สถิติอายุ</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {[
              { label: 'มัธยฐาน',             value: `${age_statistics.median} ปี` },
              { label: 'ค่าเฉลี่ย',            value: `${age_statistics.mean} ปี` },
              { label: 'ส่วนเบี่ยงเบนมาตรฐาน', value: `±${age_statistics.std} ปี` },
              { label: 'ต่ำสุด',                value: `${age_statistics.min} ปี` },
              { label: 'สูงสุด',                value: `${age_statistics.max} ปี` },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{s.label}</p>
                <p className="font-display text-xl text-slate-900">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Age-sex pyramid — Recharts */}
      <AgeSexPyramid data={age_sex_distribution} />

      {/* Age group table */}
      {age_group_distribution && Object.keys(age_group_distribution).length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">การกระจายตามกลุ่มอายุ</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left px-5 py-2 text-xs text-slate-500 uppercase tracking-wide">กลุ่มอายุ</th>
                <th className="text-right px-5 py-2 text-xs text-slate-500 uppercase tracking-wide">จำนวน</th>
                <th className="text-right px-5 py-2 text-xs text-slate-500 uppercase tracking-wide">ร้อยละ</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const total = Object.values(age_group_distribution).reduce((s, v) => s + v, 0)
                return Object.entries(age_group_distribution).map(([grp, cnt]) => (
                  <tr key={grp} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-5 py-2 text-slate-700">{grp} ปี</td>
                    <td className="px-5 py-2 text-right text-slate-800 font-medium">{cnt.toLocaleString()}</td>
                    <td className="px-5 py-2 text-right text-slate-500">
                      {total > 0 ? ((cnt / total) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                ))
              })()}
            </tbody>
          </table>
        </div>
      )}

      {/* Symptom chart — Recharts */}
      <SymptomChart symptoms={symptoms} />
    </div>
  )
}
