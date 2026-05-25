import React, { useState } from 'react';
import { ChartCard, DataTable } from '../DashboardShared';
import { t } from '../../../i18n';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';

const AR_EXP_COLOR    = '#f59e0b';
const AR_EXP_TOP      = '#ef4444';
const AR_UNEXP_COLOR  = '#64748b';
const CURSOR_STYLE    = { fill: '#334155' };

function ExposureTooltip({ active, payload, lang = 'th' }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  return (
    <div className="bg-slate-900 border border-white/20 rounded-lg p-3 text-xs shadow-xl min-w-[200px]">
      <p className="font-semibold text-white mb-2">{row?.exposure}</p>
      <p className="text-amber-400 font-bold">{t('tooltip_ar_exposed', lang)}: {row?.ar_exposed}%</p>
      <p className="text-slate-400 font-bold">{t('tooltip_ar_unexposed', lang)}: {row?.ar_unexposed}%</p>
      <p className="text-slate-300 mt-1">
        {t('tooltip_ar_diff', lang)}: <span className={row?.ar_diff > 0 ? 'text-rose-400' : 'text-teal-400'}>
          {row?.ar_diff > 0 ? '+' : ''}{row?.ar_diff}%
        </span>
      </p>
      {row?.rr != null && (
        <p className="text-indigo-300 mt-1">
          {t('tooltip_rr', lang)}: {row.rr}
          {row.rr_ci_lower != null && row.rr_ci_upper != null
            ? ` (${t('tooltip_ci', lang)}: ${row.rr_ci_lower}–${row.rr_ci_upper})` : ''}
        </p>
      )}
      {row?.p_value != null && (
        <p className="text-slate-400 mt-1">{t('tooltip_pval', lang)} = {row.p_value}</p>
      )}
    </div>
  );
}

function ChartLegend({ showUnexposed, lang = 'th' }) {
  const items = [
    { color: AR_EXP_TOP,    label: t('exp_highest_ar', lang) },
    { color: AR_EXP_COLOR,  label: t('exp_ar_exposed', lang) },
    ...(showUnexposed ? [{ color: AR_UNEXP_COLOR, label: t('exp_ar_unexposed', lang) }] : []),
  ];
  return (
    <div className="flex justify-center gap-6 pt-2 flex-wrap">
      {items.map(({ color, label }) => (
        <div key={label} className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
            style={{ backgroundColor: color }} />
          <span className="text-xs text-slate-600">{label}</span>
        </div>
      ))}
    </div>
  );
}

export default function ExposureTab({ data, lang = 'th' }) {
  const [showTop,       setShowTop]       = useState(10);
  const [showUnexposed, setShowUnexposed] = useState(true);

  if (!data?.exposures?.length) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
        {t('exp_no_data', lang)}
      </div>
    );
  }

  const chartData = data.exposures.slice(0, showTop);
  const maxAR     = Math.max(...chartData.map(r => r.ar_exposed));

  return (
    <div className="space-y-6">

      {/* ── Grouped bar chart ────────────────────────────────────────────────── */}
      <ChartCard title={`${t('exp_top', lang)} ${showTop} ${t('exp_chart_title', lang)}`}>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="flex gap-1">
            {[5, 10, 15].map(n => (
              <button key={n} onClick={() => setShowTop(n)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  showTop === n ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-700'
                }`}>{t('exp_top', lang)} {n}</button>
            ))}
          </div>
          <button
            onClick={() => setShowUnexposed(v => !v)}
            className={`ml-auto px-3 py-1 rounded text-xs font-medium transition-colors ${
              showUnexposed ? 'bg-slate-600 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-700'
            }`}>
            {showUnexposed ? t('exp_hide_unexp', lang) : t('exp_show_unexp', lang)}
          </button>
        </div>

        <ResponsiveContainer width="100%" height={340}>
          <BarChart
            data={chartData}
            margin={{ top: 8, right: 16, left: 0, bottom: 72 }}
            barCategoryGap="20%"
            barGap={2}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="exposure"
              stroke="#94a3b8" fontSize={11}
              angle={-35} textAnchor="end" tickMargin={6}
            />
            <YAxis
              stroke="#94a3b8" fontSize={11}
              unit="%" allowDecimals={false}
              domain={[0, 100]}
            />
            <Tooltip cursor={CURSOR_STYLE} content={(props) => <ExposureTooltip {...props} lang={lang} />} />
            <Bar dataKey="ar_exposed" name={t('exp_ar_exposed', lang)} radius={[3, 3, 0, 0]}>
              {chartData.map((row, i) => (
                <Cell
                  key={i}
                  fill={row.ar_exposed === maxAR ? AR_EXP_TOP : AR_EXP_COLOR}
                />
              ))}
            </Bar>
            {showUnexposed && (
              <Bar dataKey="ar_unexposed" name={t('exp_ar_unexposed', lang)} fill={AR_UNEXP_COLOR} radius={[3, 3, 0, 0]} />
            )}
          </BarChart>
        </ResponsiveContainer>

        <ChartLegend showUnexposed={showUnexposed} lang={lang} />
      </ChartCard>

      {/* ── Summary table ────────────────────────────────────────────────────── */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900 mb-4">{t('exp_table_title', lang)}</h3>
        {(() => {
          const maxAR = Math.max(...data.exposures.map(e => e.ar_exposed));
          return (
            <DataTable
              headers={[t('exp_col_exposure', lang), t('exp_col_total', lang), t('exp_col_cases', lang), t('exp_col_ar', lang)]}
              rowClassNames={data.exposures.map(e =>
                e.ar_exposed === maxAR ? 'bg-red-50 border-l-2 border-red-400' : ''
              )}
              rows={data.exposures.map((exp, i) => {
                const isTop = exp.ar_exposed === maxAR;
                return [
                  <span key={i} className={`font-medium ${isTop ? 'text-red-700' : 'text-slate-800'}`}>{exp.exposure}</span>,
                  exp.table.total_exposed,
                  exp.table.cases_exposed,
                  <span key="are" className={`font-bold ${isTop ? 'text-red-600' : 'text-amber-600'}`}>
                    {exp.ar_exposed}%
                  </span>,
                ];
              })}
            />
          );
        })()}
      </div>

    </div>
  );
}
