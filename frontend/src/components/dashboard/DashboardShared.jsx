import React from 'react';
import { Info } from 'lucide-react';
import { t } from '../../i18n';

export function InfoTip({ text }) {
  return (
    <span className="relative inline-flex group align-middle ml-1">
      <span className="inline-flex items-center justify-center w-[14px] h-[14px] rounded-full bg-slate-200 text-slate-600 text-[9px] font-bold cursor-help leading-none select-none">
        i
      </span>
      <span className="pointer-events-none absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-normal">
        {text}
      </span>
    </span>
  );
}

export function KpiCard({ title, value, subtitle, highlight = false, info }) {
  return (
    <div className={`p-4 rounded-xl border shadow-sm ${highlight ? 'border-teal-200 bg-teal-50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center mb-1">
        <h3 className="text-sm font-medium text-slate-500">{title}</h3>
        {info && <InfoTip text={info} />}
      </div>
      <div className={`text-2xl font-bold ${highlight ? 'text-teal-600' : 'text-slate-900'}`}>{value}</div>
      {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
    </div>
  );
}

export function ChartCard({ title, children }) {
  return (
    <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col h-full">
      <h3 className="text-base font-semibold text-slate-900 mb-4">{title}</h3>
      <div className="flex-1 min-h-[300px]">
        {children}
      </div>
    </div>
  );
}

export function DataTable({ headers, rows, rowClassNames = [] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm text-left text-slate-700">
        <thead className="text-xs uppercase bg-slate-50 text-slate-500">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-3 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${rowClassNames[i] ?? ''}`}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WarningBox({ warnings, lang = 'th' }) {
  if (!warnings || warnings.length === 0) return null;
  return (
    <div className="p-4 mb-6 rounded-lg border border-amber-200 bg-amber-50 flex gap-3 text-amber-800">
      <Info className="w-5 h-5 shrink-0 text-amber-600" />
      <div>
        <h4 className="font-semibold mb-1">{t('dq_data_limit', lang)}</h4>
        <ul className="list-disc pl-4 space-y-1 text-sm text-amber-700/80">
          {warnings.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      </div>
    </div>
  );
}
