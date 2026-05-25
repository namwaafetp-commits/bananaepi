import React, { useState } from 'react';
import { ChartCard, InfoTip } from '../DashboardShared';
import { t } from '../../../i18n';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';

const CURSOR_STYLE = { fill: '#334155' };
const SIG_COLOR    = '#14b8a6';
const NONSIG_COLOR = '#475569';

function makeForestShape(maxDomain) {
  return function ForestShape({ x, y, width, height, background, payload }) {
    if (payload.estimate == null || !background?.width) return null;

    const scale  = background.width / maxDomain;
    const xBase  = background.x;
    const xEst   = xBase + payload.estimate  * scale;
    const xLower = xBase + (payload.ci_lower ?? payload.estimate) * scale;
    const xUpper = xBase + (payload.ci_upper ?? payload.estimate) * scale;
    const cy     = y + height / 2;
    const sig    = payload.p_value != null && payload.p_value < 0.05;
    const color  = sig ? SIG_COLOR : NONSIG_COLOR;

    return (
      <g>
        {/* CI horizontal line */}
        <line x1={Math.max(xBase, xLower)} x2={xUpper}
          y1={cy} y2={cy} stroke="#64748b" strokeWidth={2} />
        {/* CI caps */}
        <line x1={Math.max(xBase, xLower)} x2={Math.max(xBase, xLower)}
          y1={cy - 4} y2={cy + 4} stroke="#64748b" strokeWidth={1.5} />
        <line x1={xUpper} x2={xUpper}
          y1={cy - 4} y2={cy + 4} stroke="#64748b" strokeWidth={1.5} />
        {/* Point estimate dot */}
        <circle cx={xEst} cy={cy} r={5}
          fill={color} stroke="#0f172a" strokeWidth={1.5} />
      </g>
    );
  };
}

function fmtP(p) {
  if (p == null) return '—';
  if (p < 0.001) return '<0.001';
  return p.toFixed(3);
}

function ForestTooltip({ active, payload, lang = 'th' }) {
  if (!active || !payload?.length) return null;
  const r = payload[0]?.payload;
  return (
    <div className="bg-slate-900 border border-white/20 rounded-lg p-3 text-xs shadow-xl min-w-[210px]">
      <p className="font-semibold text-white mb-2">{r.exposure}</p>
      <p className="text-teal-400 font-bold">{t('tooltip_rr', lang)}: {r.estimate}</p>
      {r.ci_lower != null && (
        <p className="text-slate-300">{t('tooltip_ci', lang)}: {r.ci_lower} – {r.ci_upper}</p>
      )}
      <p className={`mt-1 ${r.p_value != null && r.p_value < 0.05 ? 'text-rose-400' : 'text-slate-400'}`}>
        {t('tooltip_pval', lang)} = {fmtP(r.p_value)}
      </p>
      <p className="text-slate-500 mt-1 text-[10px]">{r.test_used}</p>
    </div>
  );
}

function StatCell({ label, value, highlight }) {
  return (
    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-lg font-bold ${highlight ? 'text-rose-600' : 'text-slate-900'}`}>{value}</div>
    </div>
  );
}

function TwoByTwo({ result, onClose, lang = 'th' }) {
  const tb = result.table;
  const grand = tb.total_cases + tb.total_controls;
  const sig   = result.p_value != null && result.p_value < 0.05;

  return (
    <div className="bg-white p-5 rounded-xl border border-teal-200 shadow-md">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-base font-bold text-slate-900">{result.exposure}</h3>
        <button onClick={onClose}
          className="text-slate-500 hover:text-slate-800 text-xs px-2 py-1 rounded bg-slate-100 transition-colors">
          {t('ana_close', lang)}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 2×2 table */}
        <div>
          <p className="text-xs text-slate-500 uppercase font-semibold mb-2">{t('ana_2x2_table', lang)}</p>
          <table className="w-full text-sm text-center border-collapse">
            <thead>
              <tr className="text-slate-500 text-xs">
                <th className="p-2 border border-slate-200 bg-slate-100"></th>
                <th className="p-2 border border-slate-200 bg-slate-100">{t('ana_cases', lang)}</th>
                <th className="p-2 border border-slate-200 bg-slate-100">{t('ana_noncases', lang)}</th>
                <th className="p-2 border border-slate-200 bg-slate-100 font-bold">{t('ana_total', lang)}</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              <tr>
                <td className="p-2 border border-slate-200 bg-slate-50 font-semibold text-left text-xs">{t('ana_exposed', lang)}</td>
                <td className="p-2 border border-slate-200 font-bold text-amber-600">{tb.cases_exposed}</td>
                <td className="p-2 border border-slate-200">{tb.controls_exposed}</td>
                <td className="p-2 border border-slate-200 bg-slate-100 font-bold">{tb.total_exposed}</td>
              </tr>
              <tr>
                <td className="p-2 border border-slate-200 bg-slate-50 font-semibold text-left text-xs">{t('ana_unexposed', lang)}</td>
                <td className="p-2 border border-slate-200">{tb.cases_unexposed}</td>
                <td className="p-2 border border-slate-200">{tb.controls_unexposed}</td>
                <td className="p-2 border border-slate-200 bg-slate-100 font-bold">{tb.total_unexposed}</td>
              </tr>
              <tr className="font-bold text-slate-900">
                <td className="p-2 border border-slate-200 bg-slate-100 text-left text-xs">{t('ana_total', lang)}</td>
                <td className="p-2 border border-slate-200 bg-slate-100">{tb.total_cases}</td>
                <td className="p-2 border border-slate-200 bg-slate-100">{tb.total_controls}</td>
                <td className="p-2 border border-slate-200 bg-slate-100 text-teal-600">{grand}</td>
              </tr>
            </tbody>
          </table>
          <div className="mt-2 flex gap-3 text-xs text-slate-500">
            <span>{t('ana_ar_exp_lbl', lang)} <span className="text-amber-600 font-bold">{result.ar_exposed}%</span></span>
            <span>{t('ana_ar_unexp_lbl', lang)} <span className="text-slate-600">{result.ar_unexposed}%</span></span>
          </div>
        </div>

        <div>
          <p className="text-xs text-slate-500 uppercase font-semibold mb-2">{t('ana_stat_results', lang)}</p>
          <div className="grid grid-cols-2 gap-3">
            <StatCell label={t('ana_rr', lang)} value={result.estimate ?? '—'} highlight={false} />
            <StatCell label={t('ana_ci', lang)} value={result.ci_lower != null ? `${result.ci_lower} – ${result.ci_upper}` : '—'} />
            <StatCell label={t('ana_pval', lang)} value={fmtP(result.p_value)} highlight={sig} />
            <StatCell label={t('ana_test', lang)} value={<span className="text-xs leading-tight">{result.test_used ?? '—'}</span>} />
          </div>

          {result.flags.includes('small_cells') && (
            <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1.5">
              {t('ana_small_cells', lang)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AnalyticTab({ data, lang = 'th' }) {
  const [selected, setSelected] = useState(null);

  if (!data?.results?.length) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
        {t('ana_no_data', lang)}
      </div>
    );
  }

  const forestData = data.results
    .filter(r => r.estimate != null)
    .slice(0, 10)
    .reverse();

  const maxDomain = Math.ceil(
    Math.max(...forestData.map(r => r.ci_upper ?? r.estimate ?? 2), 2)
  ) + 0.5;

  return (
    <div className="space-y-6">

      {/* ── Forest plot ──────────────────────────────────────────────────────── */}
      <ChartCard title={t('ana_forest_title', lang)}>
        <div className="flex items-center gap-4 mb-3 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: SIG_COLOR }} />
            <span>{t('ana_sig', lang)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: NONSIG_COLOR }} />
            <span>{t('ana_not_sig', lang)}</span>
          </div>
          <span className="ml-2 text-slate-600">{t('ana_null_line', lang)}</span>
        </div>

        <ResponsiveContainer width="100%" height={Math.max(260, forestData.length * 38)}>
          <BarChart
            data={forestData}
            layout="vertical"
            margin={{ top: 4, right: 40, left: 130, bottom: 8 }}
            barSize={18}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
            <XAxis
              type="number"
              stroke="#94a3b8" fontSize={11}
              domain={[0, maxDomain]}
              tickCount={6}
            />
            <YAxis
              dataKey="exposure"
              type="category"
              stroke="#94a3b8" fontSize={11}
              width={125}
            />
            <Tooltip cursor={CURSOR_STYLE} content={(props) => <ForestTooltip {...props} lang={lang} />} />
            <ReferenceLine x={1} stroke="#ef4444" strokeDasharray="4 3" strokeWidth={1.5} />
            <Bar dataKey="estimate" name="RR" shape={makeForestShape(maxDomain)} fill="transparent" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── 2×2 detail (on row click) ────────────────────────────────────────── */}
      {selected && (
        <TwoByTwo result={selected} onClose={() => setSelected(null)} lang={lang} />
      )}

      {/* ── Results table ────────────────────────────────────────────────────── */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-base font-semibold text-slate-900">{t('ana_results_title', lang)}</h3>
          <InfoTip text={t('ana_results_tip', lang)} />
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm text-left text-slate-700">
            <thead className="text-xs uppercase bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">{t('ana_col_exposure', lang)}</th>
                <th className="px-4 py-3 font-semibold">{t('ana_col_ar_exp', lang)}</th>
                <th className="px-4 py-3 font-semibold">{t('ana_col_ar_unexp', lang)}</th>
                <th className="px-4 py-3 font-semibold">{t('ana_col_rr', lang)}</th>
                <th className="px-4 py-3 font-semibold">{t('ana_col_ci', lang)}</th>
                <th className="px-4 py-3 font-semibold">{t('ana_col_pval', lang)}</th>
                <th className="px-4 py-3 font-semibold">{t('ana_col_flags', lang)}</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((r, i) => {
                const sig = r.p_value != null && r.p_value < 0.05;
                const isSelected = selected?.column_name === r.column_name;
                return (
                  <tr
                    key={i}
                    onClick={() => setSelected(isSelected ? null : r)}
                    className={`border-b border-slate-100 cursor-pointer transition-colors ${
                      isSelected ? 'bg-teal-50 border-l-2 border-teal-500' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">{r.exposure}</td>
                    <td className="px-4 py-3 font-bold text-amber-600">{r.ar_exposed}%</td>
                    <td className="px-4 py-3 text-slate-500">{r.ar_unexposed}%</td>
                    <td className="px-4 py-3 font-bold text-teal-600">
                      {r.estimate ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {r.ci_lower != null ? `${r.ci_lower} – ${r.ci_upper}` : '—'}
                    </td>
                    <td className={`px-4 py-3 font-bold ${sig ? 'text-rose-600' : ''}`}>
                      {fmtP(r.p_value)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {r.flags.includes('significant') && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-teal-50 text-teal-700 border border-teal-200">{t('ana_flag_sig', lang)}</span>
                        )}
                        {r.flags.includes('small_cells') && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 border border-amber-200">{t('ana_flag_small', lang)}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
