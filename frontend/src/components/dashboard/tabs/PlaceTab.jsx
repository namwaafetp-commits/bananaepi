import React, { useState, useMemo } from 'react';
import { ChartCard, DataTable, InfoTip } from '../DashboardShared';
import { t } from '../../../i18n';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';

function prettyCol(col) {
  return col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const CURSOR_STYLE = { fill: '#334155' };
const AR_COLOR     = '#f59e0b';
const CASE_COLOR   = '#14b8a6';

function PlaceTooltip({ active, payload, label, chartView, lang = 'th' }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="bg-slate-900 border border-white/20 rounded-lg p-3 text-xs shadow-xl min-w-[140px]">
      <p className="font-semibold text-white mb-2">{label}</p>
      {chartView === 'ar' ? (
        <>
          <p className="text-amber-400 font-bold">{t('tooltip_ar', lang)}: {row.attack_rate}%</p>
          <p className="text-slate-400 mt-1">{t('tooltip_cases', lang)}: {row.cases} / {row.total} {t('tooltip_of_invest', lang)}</p>
        </>
      ) : (
        <>
          <p className="text-teal-400 font-bold">{t('tooltip_cases', lang)}: {row.cases}</p>
          <p className="text-slate-400 mt-1">{lang === 'th' ? 'จาก' : 'of'} {row.total} {t('tooltip_of_invest', lang)}</p>
          <p className="text-amber-400 mt-1">{t('tooltip_ar', lang)}: {row.attack_rate}%</p>
        </>
      )}
    </div>
  );
}

export default function PlaceTab({ data, lang = 'th' }) {
  const [selectedVar, setSelectedVar] = useState(
    data?.available_variables?.[0] ?? null
  );
  const [chartView, setChartView] = useState('ar'); // 'ar' | 'cases'

  if (!data?.available_variables?.length) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
        {t('place_no_data', lang)}
      </div>
    );
  }

  const rawRows  = data.tables[selectedVar] ?? [];

  // Chart: sorted by selected metric (already sorted by AR from backend,
  // re-sort by cases when cases view is active)
  const chartRows = useMemo(() => {
    const rows = [...rawRows];
    if (chartView === 'cases') rows.sort((a, b) => b.cases - a.cases);
    return rows;
  }, [rawRows, chartView]);

  const dataKey  = chartView === 'ar' ? 'attack_rate' : 'cases';
  const barColor = chartView === 'ar' ? AR_COLOR : CASE_COLOR;
  const maxVal   = Math.max(...chartRows.map(r => r[dataKey]));

  return (
    <div className="space-y-6">

      {/* ── Variable selector ────────────────────────────────────────────────── */}
      {data.available_variables.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {data.available_variables.map(v => (
            <button key={v} onClick={() => setSelectedVar(v)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedVar === v
                  ? 'bg-teal-500 text-white'
                  : 'bg-slate-100 text-slate-500 hover:text-slate-700'
              }`}>
              {prettyCol(v)}
            </button>
          ))}
        </div>
      )}

      {/* ── Chart ────────────────────────────────────────────────────────────── */}
      <ChartCard title={`${t('place_chart_title', lang)} — ${prettyCol(selectedVar)}`}>
        <div className="flex gap-2 mb-4">
          <button onClick={() => setChartView('ar')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              chartView === 'ar' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-700'
            }`}>
            {t('place_ar_btn', lang)}
          </button>
          <button onClick={() => setChartView('cases')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              chartView === 'cases' ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-700'
            }`}>
            {t('place_cases_btn', lang)}
          </button>
        </div>

        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={chartRows}
            margin={{ top: 8, right: 24, left: 0, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey={selectedVar}
              stroke="#94a3b8" fontSize={11}
              angle={-35} textAnchor="end" tickMargin={6}
            />
            <YAxis
              stroke="#94a3b8" fontSize={11}
              unit={chartView === 'ar' ? '%' : ''}
              allowDecimals={false}
              domain={chartView === 'ar' ? [0, 100] : [0, 'auto']}
            />
            <Tooltip
              cursor={CURSOR_STYLE}
              content={(props) => <PlaceTooltip {...props} chartView={chartView} lang={lang} />}
            />
            <Bar dataKey={dataKey} radius={[3, 3, 0, 0]} name={chartView === 'ar' ? t('place_ar', lang) : t('place_cases', lang)}>
              {chartRows.map((row, i) => (
                <Cell
                  key={i}
                  fill={row[dataKey] === maxVal ? barColor : `${barColor}99`}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── Summary table ────────────────────────────────────────────────────── */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-base font-semibold text-slate-900">{t('place_table_title', lang)}</h3>
          <InfoTip text={t('place_ar_tip', lang)} />
        </div>
        <DataTable
          headers={[prettyCol(selectedVar), t('place_total', lang), t('place_cases', lang), t('place_ar', lang)]}
          rows={rawRows.map((row, i) => [
            <span key={i} className="font-medium text-slate-800">{row[selectedVar]}</span>,
            row.total,
            row.cases,
            <span key={i} className={`font-bold ${row.attack_rate === Math.max(...rawRows.map(r => r.attack_rate)) ? 'text-amber-400' : ''}`}>
              {row.attack_rate}%
            </span>,
          ])}
        />
      </div>

    </div>
  );
}
