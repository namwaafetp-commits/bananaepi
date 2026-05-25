import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { t } from '../../i18n/caseDefinition';

export function HumanReadableDefinitionBox({ text, lang = 'th' }) {
  const T = t[lang];
  if (!text) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-3 border-b border-slate-200 pb-2">{T.generatedDef}</h3>
      <pre className="text-sm text-teal-700 whitespace-pre-wrap font-sans leading-relaxed">
        {text}
      </pre>
    </div>
  );
}

export function WarningBox({ warnings, lang = 'th' }) {
  const T = t[lang];
  if (!warnings || warnings.length === 0) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <h4 className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        {T.warnings}
      </h4>
      <ul className="list-disc pl-5 text-xs text-amber-700/80 space-y-1">
        {warnings.map((w, i) => <li key={i}>{w}</li>)}
      </ul>
    </div>
  );
}

export function CaseDefinitionPreviewTable({ summary, previewRows, lang = 'th' }) {
  const T = t[lang];
  if (!summary) return null;

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-blue-700 border-b border-blue-200 pb-2">{T.previewResult}</h3>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-3 text-center shadow-sm">
          <div className="text-xs text-slate-500 mb-1">{T.meetsCriteria}</div>
          <div className="text-xl font-bold text-teal-600">{summary.case_count}</div>
          <div className="text-xs text-slate-400">{summary.case_percent}%</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3 text-center shadow-sm">
          <div className="text-xs text-slate-500 mb-1">{T.doesNotMeet}</div>
          <div className="text-xl font-bold text-slate-700">{summary.non_case_count}</div>
          <div className="text-xs text-slate-400">{summary.non_case_percent}%</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3 text-center shadow-sm">
          <div className="text-xs text-slate-500 mb-1">{T.unknown}</div>
          <div className="text-xl font-bold text-amber-600">{summary.unknown_count}</div>
          <div className="text-xs text-slate-400">{summary.unknown_percent}%</div>
        </div>
      </div>

      {previewRows && previewRows.length > 0 && (
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="text-slate-500 bg-slate-100">
              <tr>
                <th className="px-3 py-2 font-medium rounded-tl-lg">{T.recordId}</th>
                <th className="px-3 py-2 font-medium">{T.status}</th>
                <th className="px-3 py-2 font-medium rounded-tr-lg">{T.reason}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {previewRows.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-3 py-2">{row.record_id}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] border ${
                      row.case_status === 'case'     ? 'bg-teal-50 text-teal-700 border-teal-200' :
                      row.case_status === 'non_case' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                      'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {row.case_status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-500 truncate max-w-[200px]" title={row.reason}>{row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
