import React from 'react';
import { DataTable, WarningBox } from '../DashboardShared';
import { t } from '../../../i18n';

export default function DataQualityTab({ data, lang = 'th' }) {
  if (!data) return <div className="flex items-center justify-center h-48 text-slate-500 text-sm">{t('dq_no_data', lang)}</div>;

  return (
    <div className="space-y-6">
      <WarningBox warnings={[
        t('dq_warn1', lang),
        t('dq_warn2', lang),
        t('dq_warn3', lang),
      ]} lang={lang} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900 mb-4">{t('dq_issues_title', lang)}</h3>
          {data.issues && data.issues.length > 0 ? (
            <DataTable
              headers={[t('dq_col_issue', lang), t('dq_col_count', lang), t('dq_col_pct', lang)]}
              rows={data.issues.map(i => [
                <span className="text-amber-600 font-medium">{i.issue}</span>,
                i.count,
                `${i.percentage}%`
              ])}
            />
          ) : (
            <div className="p-4 text-center text-teal-700 bg-teal-50 rounded-lg">
              {t('dq_no_issues', lang)}
            </div>
          )}
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900 mb-4">{t('dq_inclusion_title', lang)}</h3>
          <DataTable
            headers={[t('dq_col_module', lang), t('dq_col_included', lang), t('dq_col_excluded', lang), t('dq_col_reason', lang)]}
            rows={data.inclusions.map(i => [
              i.analysis,
              <span className="text-teal-600 font-bold">{i.included}</span>,
              <span className="text-rose-600 font-bold">{i.excluded}</span>,
              i.reason
            ])}
          />
        </div>
      </div>
    </div>
  );
}
