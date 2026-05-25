import React, { useState, useMemo } from 'react';
import { KpiCard, ChartCard } from '../DashboardShared';
import { t } from '../../../i18n';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDate(s) {
  if (!s) return '—';
  const p = s.split('-');
  if (p.length !== 3) return s;
  return `${parseInt(p[2])} ${MONTHS[parseInt(p[1]) - 1]} ${p[0]}`;
}

function prettyCol(col) {
  return col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Aggregate 1-hour buckets into N-hour intervals
function aggregateHourly(hourlyData, intervalH) {
  if (!hourlyData?.length) return [];
  if (intervalH === 1) return hourlyData;

  const merged = new Map();
  for (const row of hourlyData) {
    const [datePart, timePart] = row.datetime.split(' ');
    const h = parseInt(timePart.split(':')[0], 10);
    const bucketH = Math.floor(h / intervalH) * intervalH;
    const key = `${datePart} ${String(bucketH).padStart(2, '0')}:00`;
    merged.set(key, (merged.get(key) ?? 0) + row.case_count);
  }

  let cum = 0;
  return [...merged.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([datetime, case_count]) => {
      cum += case_count;
      return { datetime, case_count, cumulative: cum };
    });
}

// Format "2024-09-15 06:00" → "Sep 15 06:00"
function fmtHourLabel(s) {
  if (!s) return s;
  const [datePart, timePart] = s.split(' ');
  const [y, m, d] = datePart.split('-');
  return `${MONTH_SHORT[parseInt(m) - 1]} ${parseInt(d)} ${timePart}`;
}

const TOOLTIP_STYLE = { backgroundColor: '#0f172a', borderColor: '#1e293b', fontSize: 12 };
const CURSOR_STYLE  = { fill: '#334155' };

const STACK_PALETTE = [
  '#14b8a6', '#8b5cf6', '#f59e0b', '#ef4444',
  '#3b82f6', '#ec4899', '#10b981', '#f97316',
];

const HOUR_INTERVALS = [1, 2, 3, 4, 5, 6, 12, 18];

function StackLegend({ keys, palette }) {
  return (
    <div className="flex justify-center flex-wrap gap-x-4 gap-y-1 pt-3">
      {keys.map((key, i) => (
        <div key={key} className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
            style={{ backgroundColor: palette[i % palette.length] }} />
          <span className="text-xs text-slate-600">{key}</span>
        </div>
      ))}
    </div>
  );
}

export default function TimeTab({ data, lang = 'th' }) {
  const [view,      setView]      = useState('daily');
  const [stackCol,  setStackCol]  = useState(null);
  const [hourInt,   setHourInt]   = useState(6);

  if (!data || !data.epi_curve) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
        {t('time_no_data', lang)}
      </div>
    );
  }

  const hasWeekly   = (data.epi_curve_weekly?.length ?? 0) > 1;
  const hasHourly   = !!data.has_time && (data.epi_curve_hourly?.length ?? 0) > 0;
  const stackOptions = data.stack_options ?? [];
  const isHourView  = view === 'hourly';
  const isWeekView  = view === 'weekly';

  // ── Resolve chart data ────────────────────────────────────────────────────
  const hourlyAggregated = useMemo(
    () => aggregateHourly(data.epi_curve_hourly, hourInt),
    [data.epi_curve_hourly, hourInt]
  );

  const isStacked  = stackCol && !isHourView && data.stacked_by?.[stackCol];
  let chartData, dateKey;
  if (isHourView) {
    chartData = hourlyAggregated;
    dateKey   = 'datetime';
  } else if (isWeekView && hasWeekly) {
    chartData = data.epi_curve_weekly;
    dateKey   = 'week';
  } else {
    chartData = isStacked ? data.stacked_by[stackCol] : data.epi_curve;
    dateKey   = 'date';
  }

  // Use backend-supplied category order (guarantees age-group young→old, etc.)
  const stackKeys = isStacked
    ? (data.stack_categories?.[stackCol] ?? Object.keys(chartData[0] ?? {}).filter(k => k !== 'date'))
    : [];

  // Cumulative chart always uses non-stacked base data
  const cumData = isHourView ? hourlyAggregated
    : isWeekView && hasWeekly ? data.epi_curve_weekly
    : data.epi_curve;

  // X-axis tick formatter for hourly
  const xFormatter = isHourView ? fmtHourLabel : undefined;

  return (
    <div className="space-y-6">

      {/* ── KPI row ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title={t('time_first', lang)} value={fmtDate(data.first_onset)} />
        <KpiCard title={t('time_peak', lang)} value={fmtDate(data.peak_onset)} highlight />
        <KpiCard title={t('time_last', lang)} value={fmtDate(data.last_onset)} />
        <KpiCard title={t('time_duration', lang)}
          value={data.duration_days != null
            ? `${data.duration_days} ${data.duration_days !== 1 ? t('time_days', lang) : t('time_day', lang)}`
            : '—'} />
      </div>

      {/* ── Missing-date notice ───────────────────────────────────────────────── */}
      {!!data.cases_missing_date && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
          {data.cases_missing_date} {t('time_missing', lang)}
        </div>
      )}

      {/* ── Epidemic Curve ───────────────────────────────────────────────────── */}
      <ChartCard title={t('time_epi_curve', lang)}>
        <div className="flex flex-wrap items-center gap-3 mb-4">

          <div className="flex gap-1">
            <button onClick={() => { setView('daily'); }}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                view === 'daily' ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-700'
              }`}>{t('time_daily', lang)}</button>
            {hasWeekly && (
              <button onClick={() => { setView('weekly'); setStackCol(null); }}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  view === 'weekly' ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-700'
                }`}>{t('time_weekly', lang)}</button>
            )}
            {hasHourly && (
              <button onClick={() => { setView('hourly'); setStackCol(null); }}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  view === 'hourly' ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-700'
                }`}>{t('time_hourly', lang)}</button>
            )}
          </div>

          {isHourView && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{t('time_interval', lang)}</span>
              <div className="flex gap-1 flex-wrap">
                {HOUR_INTERVALS.map(h => (
                  <button key={h} onClick={() => setHourInt(h)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      hourInt === h ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-700'
                    }`}>
                    {h}h
                  </button>
                ))}
              </div>
            </div>
          )}

          {!isHourView && !isWeekView && stackOptions.length > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-slate-500">{t('time_stack_by', lang)}</span>
              <div className="flex gap-1 flex-wrap">
                <button onClick={() => setStackCol(null)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    !stackCol ? 'bg-slate-600 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-700'
                  }`}>{t('time_none', lang)}</button>
                {stackOptions.map(col => (
                  <button key={col} onClick={() => setStackCol(col)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      stackCol === col ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-700'
                    }`}>{prettyCol(col)}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={chartData} barCategoryGap="0%"
            margin={{ top: 8, right: 16, left: 0, bottom: 52 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey={dateKey} stroke="#94a3b8" fontSize={11}
              angle={-40} textAnchor="end" tickMargin={6}
              tickFormatter={xFormatter} />
            <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
            <Tooltip cursor={CURSOR_STYLE} contentStyle={TOOLTIP_STYLE} />

            {isStacked
              ? stackKeys.map((key, i) => (
                  <Bar key={key} dataKey={key} stackId="stack"
                    fill={STACK_PALETTE[i % STACK_PALETTE.length]}
                    radius={i === stackKeys.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                    name={key} />
                ))
              : <Bar dataKey="case_count" fill="#14b8a6" radius={[3, 3, 0, 0]} name={t('time_cases', lang)} />
            }
          </BarChart>
        </ResponsiveContainer>

        {isStacked && <StackLegend keys={stackKeys} palette={STACK_PALETTE} />}
      </ChartCard>

      {/* ── Cumulative Curve ─────────────────────────────────────────────────── */}
      <ChartCard title={t('time_cumulative', lang)}>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={cumData} margin={{ top: 8, right: 16, left: 0, bottom: 52 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey={dateKey} stroke="#94a3b8" fontSize={11}
              angle={-40} textAnchor="end" tickMargin={6}
              tickFormatter={xFormatter} />
            <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Line type="monotone" dataKey="cumulative" stroke="#8b5cf6"
              strokeWidth={2.5} dot={{ r: 3, fill: '#8b5cf6', strokeWidth: 0 }}
              name={t('time_cum_cases', lang)} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

    </div>
  );
}
