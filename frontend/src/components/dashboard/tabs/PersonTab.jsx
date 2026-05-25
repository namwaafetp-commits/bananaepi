import React, { useState } from 'react';
import { ChartCard, DataTable, InfoTip } from '../DashboardShared';
import { t } from '../../../i18n';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
  PieChart, Pie, Label,
} from 'recharts';

function prettyCol(col) {
  return col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const CURSOR_STYLE = { fill: '#334155' };

// ── Custom tooltips ───────────────────────────────────────────────────────────
function DemoTooltip({ active, payload, label, chartView, lang = 'th' }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="bg-slate-900 border border-white/20 rounded-lg p-3 text-xs shadow-xl min-w-[150px]">
      <p className="font-semibold text-white mb-2">{label}</p>
      {chartView === 'ar' ? (
        <>
          <p className="text-amber-400 font-bold">{t('tooltip_ar', lang)}: {r.attack_rate}%</p>
          <p className="text-slate-400 mt-1">{t('tooltip_cases', lang)}: {r.cases} / {r.total} {t('tooltip_of_invest', lang)}</p>
        </>
      ) : (
        <>
          <p className="text-blue-400 font-bold">{t('tooltip_cases', lang)}: {r.cases}</p>
          <p className="text-slate-400 mt-1">{lang === 'th' ? 'จาก' : 'of'} {r.total} {t('tooltip_of_invest', lang)}</p>
          <p className="text-amber-400 mt-1">{t('tooltip_ar', lang)}: {r.attack_rate}%</p>
        </>
      )}
    </div>
  );
}

function SymptomTooltip({ active, payload, lang = 'th' }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="bg-slate-900 border border-white/20 rounded-lg p-3 text-xs shadow-xl">
      <p className="font-semibold text-white mb-1">{r.symptom}</p>
      <p className="text-rose-400 font-bold">{r.percentage}% {t('tooltip_of_cases', lang)}</p>
      <p className="text-slate-400">{r.cases_with_symptom} {t('tooltip_cases', lang).toLowerCase()}</p>
    </div>
  );
}

const DONUT_PALETTE = ['#14b8a6', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899'];

function DonutTooltip({ active, payload, lang = 'th' }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="bg-slate-900 border border-white/20 rounded-lg p-3 text-xs shadow-xl min-w-[150px]">
      <p className="font-semibold text-white mb-2">{r.name}</p>
      <p className="text-teal-400 font-bold">{t('tooltip_cases', lang)}: {r.cases} ({r.pct}%)</p>
      <p className="text-slate-400 mt-1">{lang === 'th' ? 'จาก' : 'of'} {r.total} {t('tooltip_of_invest', lang)}</p>
      <p className="text-amber-400 mt-1">{t('tooltip_ar', lang)}: {r.attack_rate}%</p>
    </div>
  );
}

function SexDonutChart({ varName, rows, lang = 'th' }) {
  const totalCases = rows.reduce((s, r) => s + r.cases, 0);
  const pieData = rows.map(r => ({
    name:        r[varName],
    cases:       r.cases,
    total:       r.total,
    attack_rate: r.attack_rate,
    pct:         totalCases > 0 ? Math.round(r.cases / totalCases * 1000) / 10 : 0,
    value:       r.cases,
  }));

  return (
    <ChartCard title={`${t('person_cases_by', lang)} ${prettyCol(varName)}`}>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%" cy="50%"
            innerRadius={72} outerRadius={108}
            dataKey="value"
            paddingAngle={3}
            strokeWidth={0}
          >
            {pieData.map((_, i) => (
              <Cell key={i} fill={DONUT_PALETTE[i % DONUT_PALETTE.length]} />
            ))}
            <Label
              value={`${totalCases} ${t('person_cases_lbl', lang)}`}
              position="center"
              fill="#94a3b8"
              fontSize={13}
              fontWeight={600}
            />
          </Pie>
          <Tooltip content={(props) => <DonutTooltip {...props} lang={lang} />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex justify-center gap-6 mt-1 pb-1">
        {pieData.map((entry, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: DONUT_PALETTE[i % DONUT_PALETTE.length] }} />
            <span className="text-xs text-slate-700">
              {entry.name}
              <span className="text-slate-500 ml-1">
                {entry.cases} ({entry.pct}%)
              </span>
            </span>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

// ── Demographics chart ────────────────────────────────────────────────────────
function DemoChart({ varName, rows, chartView, lang = 'th' }) {
  if (varName === 'sex') return <SexDonutChart varName={varName} rows={rows} lang={lang} />;

  const maxVal = Math.max(...rows.map(r => chartView === 'ar' ? r.attack_rate : r.cases));
  const color  = chartView === 'ar' ? '#f59e0b' : '#3b82f6';

  return (
    <ChartCard title={`${prettyCol(varName)} — ${chartView === 'ar' ? t('person_ar', lang) : t('person_case_count', lang)}`}>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 36 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey={varName}
            stroke="#94a3b8" fontSize={11}
            angle={rows.length > 4 ? -35 : 0}
            textAnchor={rows.length > 4 ? 'end' : 'middle'}
            tickMargin={6}
          />
          <YAxis
            stroke="#94a3b8" fontSize={11}
            allowDecimals={false}
            unit={chartView === 'ar' ? '%' : ''}
            domain={chartView === 'ar' ? [0, 100] : [0, 'auto']}
          />
          <Tooltip
            cursor={CURSOR_STYLE}
            content={(props) => <DemoTooltip {...props} chartView={chartView} lang={lang} />}
          />
          <Bar dataKey={chartView === 'ar' ? 'attack_rate' : 'cases'} radius={[3, 3, 0, 0]}>
            {rows.map((_, i) => (
              <Cell
                key={i}
                fill={(chartView === 'ar' ? rows[i].attack_rate : rows[i].cases) === maxVal
                  ? color : `${color}88`}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PersonTab({ data, lang = 'th' }) {
  const [chartView, setChartView] = useState('cases'); // 'cases' | 'ar'

  if (!data) {
    return <div className="flex items-center justify-center h-48 text-slate-500 text-sm">{t('person_no_data', lang)}</div>;
  }

  const demoEntries = Object.entries(data.demographics ?? {});
  const hasSymptoms = (data.symptoms?.length ?? 0) > 0;
  const hasOutcomes = (data.outcomes?.length ?? 0) > 0;

  return (
    <div className="space-y-8">

      {/* ── Demographics ──────────────────────────────────────────────────────── */}
      {demoEntries.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900">{t('person_demo', lang)}</h2>
            <div className="flex gap-1">
              <button onClick={() => setChartView('cases')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  chartView === 'cases' ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-700'
                }`}>{t('person_case_count', lang)}</button>
              <button onClick={() => setChartView('ar')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  chartView === 'ar' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-700'
                }`}>{t('person_ar', lang)}</button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {demoEntries.map(([varName, rows]) => (
              <DemoChart key={varName} varName={varName} rows={rows} chartView={chartView} lang={lang} />
            ))}
          </div>
        </section>
      )}

      {/* ── Symptoms ──────────────────────────────────────────────────────────── */}
      {hasSymptoms && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-base font-semibold text-slate-900">{t('person_clinical', lang)}</h2>
            <InfoTip text={t('person_clinical_tip', lang)} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title={t('person_symp_chart', lang)}>
              <ResponsiveContainer width="100%" height={Math.max(240, data.symptoms.length * 36)}>
                <BarChart
                  data={data.symptoms}
                  layout="vertical"
                  margin={{ top: 8, right: 48, left: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis
                    type="number"
                    stroke="#94a3b8" fontSize={11}
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    unit="%"
                  />
                  <YAxis
                    dataKey="symptom"
                    type="category"
                    stroke="#94a3b8" fontSize={11}
                    width={90}
                  />
                  <Tooltip cursor={CURSOR_STYLE} content={(props) => <SymptomTooltip {...props} lang={lang} />} />
                  <Bar dataKey="percentage" fill="#ef4444" radius={[0, 3, 3, 0]}>
                    {data.symptoms.map((s, i) => (
                      <Cell key={i} fill={i === 0 ? '#ef4444' : '#ef444488'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">{t('person_symp_detail', lang)}</h3>
              <DataTable
                headers={[t('person_symp', lang), t('person_cases', lang), t('person_pct', lang)]}
                rows={data.symptoms.map((s, i) => [
                  s.symptom,
                  s.cases_with_symptom,
                  <span key={i} className={`font-bold ${i === 0 ? 'text-rose-600' : ''}`}>
                    {s.percentage}%
                  </span>,
                ])}
              />
            </div>
          </div>
        </section>
      )}

      {/* ── Outcomes ──────────────────────────────────────────────────────────── */}
      {hasOutcomes && (
        <section>
          <h2 className="text-base font-semibold text-slate-900 mb-4">{t('person_outcomes', lang)}</h2>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm max-w-md">
            <DataTable
              headers={[t('person_outcome', lang), t('person_cases', lang), t('person_pct', lang)]}
              rows={data.outcomes.map(o => [o.outcome, o.cases, `${o.percentage}%`])}
            />
          </div>
        </section>
      )}

    </div>
  );
}
