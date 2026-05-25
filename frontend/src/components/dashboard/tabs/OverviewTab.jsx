import React from 'react';
import { KpiCard, ChartCard } from '../DashboardShared';
import { t } from '../../../i18n';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

const MONTHS_EN = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const MONTHS_TH = [
  'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม',
];

function fmtDate(dateStr, lang = 'en') {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const months = lang === 'th' ? MONTHS_TH : MONTHS_EN;
  return `${parseInt(parts[2])} ${months[parseInt(parts[1]) - 1]} ${parts[0]}`;
}

function buildSummary(d, lang) {
  if (!d) return '';
  const sentences = [];
  const isTh = lang === 'th';

  // 1. Scale + attack rate
  if (isTh) {
    sentences.push(
      `มีผู้ถูกสอบสวนทั้งหมด ${d.total_records} ราย โดย ${d.case_count} ราย เข้าเกณฑ์นิยามผู้ป่วย (อัตราป่วยเบื้องต้น: ${d.attack_rate}%)`
    );
  } else {
    sentences.push(
      `A total of ${d.total_records} persons were investigated, of whom ${d.case_count} met the case definition (crude attack rate: ${d.attack_rate}%).`
    );
  }

  // 2. Outbreak period
  if (d.first_onset && d.last_onset && d.outbreak_duration_days != null) {
    const dur = d.outbreak_duration_days;
    const first = fmtDate(d.first_onset, lang);
    const last  = fmtDate(d.last_onset, lang);
    const peak  = d.peak_onset_date ? fmtDate(d.peak_onset_date, lang) : null;
    if (isTh) {
      const peakClause = peak ? ` โดยมีจุดสูงสุดในวันที่ ${peak}` : '';
      sentences.push(`การระบาดกินระยะเวลา ${dur} วัน (${first} ถึง ${last})${peakClause}`);
    } else {
      const dayWord = dur === 1 ? 'day' : 'days';
      const peakClause = peak ? `, with the peak on ${peak}` : '';
      sentences.push(`The outbreak spanned ${dur} ${dayWord} (${first} to ${last})${peakClause}.`);
    }
  }

  // 3. Median age
  if (d.median_age != null) {
    const iqr = (d.age_q1 != null && d.age_q3 != null)
      ? (isTh ? ` (IQR: ${d.age_q1.toFixed(1)}–${d.age_q3.toFixed(1)} ปี)` : ` (IQR: ${d.age_q1.toFixed(1)}–${d.age_q3.toFixed(1)} years)`)
      : '';
    sentences.push(
      isTh
        ? `อายุมัธยฐานของผู้ป่วยคือ ${Math.round(d.median_age)} ปี${iqr}`
        : `The median age of cases was ${Math.round(d.median_age)} years${iqr}.`
    );
  }

  // 4. Clinical outcomes
  const clinical = [];
  if (d.hospitalized_count != null) {
    const rateClause = d.hospitalization_rate != null
      ? (isTh ? ` (อัตราการรับไว้: ${d.hospitalization_rate}%)` : ` (admission rate: ${d.hospitalization_rate}%)`)
      : '';
    clinical.push(
      isTh
        ? `มีผู้ป่วยรับไว้รักษาใน รพ. ${d.hospitalized_count} ราย${rateClause}`
        : `${d.hospitalized_count} case(s) were hospitalised${rateClause}`
    );
  }
  if (d.death_count != null && d.death_count > 0) {
    clinical.push(
      isTh ? `มีผู้เสียชีวิต ${d.death_count} ราย` : `${d.death_count} death(s) were recorded`
    );
  }
  if (d.lab_positive_count != null) {
    const pctClause = d.lab_positive_pct != null
      ? (isTh ? ` (${d.lab_positive_pct}% ของผู้ป่วย)` : ` (${d.lab_positive_pct}% of cases)`)
      : '';
    clinical.push(
      isTh
        ? `มีผู้ป่วยได้รับการยืนยันทางห้องปฏิบัติการ ${d.lab_positive_count} ราย${pctClause}`
        : `${d.lab_positive_count} case(s) were laboratory-confirmed${pctClause}`
    );
  }
  if (clinical.length > 0) {
    sentences.push(
      isTh ? clinical.join('; ') : clinical.join('; ') + '.'
    );
  }

  // 5. Top symptom
  if (d.most_common_symptom) {
    sentences.push(
      isTh
        ? `อาการที่พบบ่อยที่สุดในผู้ป่วยคือ${d.most_common_symptom.toLowerCase()}`
        : `The most frequently reported symptom among cases was ${d.most_common_symptom.toLowerCase()}.`
    );
  }

  // 6. Top exposure
  if (d.top_exposure_signal) {
    sentences.push(
      isTh
        ? `การวิเคราะห์ทางระบาดวิทยาพบว่า ${d.top_exposure_signal.toLowerCase()} เป็นปัจจัยเสี่ยงหลัก (มีนัยสำคัญทางสถิติ p < 0.05)`
        : `Epidemiological analysis identified ${d.top_exposure_signal.toLowerCase()} as the leading exposure risk factor (statistically significant, p < 0.05).`
    );
  }

  return sentences.join('  ');
}

function fmtNum(n, decimals = 1) {
  if (n == null) return '—';
  return typeof n === 'number' ? n.toFixed(decimals) : n;
}

export default function OverviewTab({ data, timeData, personData, caseDefinition, hasCaseDefinition = true, lang = 'th' }) {
  if (!data) return <div className="text-slate-500 p-4">{t('loading_overview', lang)}</div>;

  const hasHosp     = data.hospitalized_count != null;
  const hasAdmRate  = data.hospitalization_rate != null;
  const hasDeath    = data.death_count != null;
  const hasLab      = data.lab_positive_count != null;
  const hasLabPct   = data.lab_positive_pct != null;
  const hasClinical = hasHosp || hasDeath || hasLab;

  return (
    <div className="space-y-6">

      {/* ── No case definition warning ───────────────────────────────────────── */}
      {!hasCaseDefinition && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <span className="text-xl shrink-0">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-amber-700 mb-0.5">
              {lang === 'th' ? 'ยังไม่ได้กำหนดนิยามผู้ป่วย' : 'No case definition applied'}
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              {lang === 'th'
                ? 'ข้อมูลนี้แสดงผู้ถูกสอบสวนทั้งหมดเป็นผู้ป่วย กรุณากลับไปขั้นตอน "กำหนดนิยามผู้ป่วย" เพื่อให้ผลการวิเคราะห์ถูกต้อง'
                : 'All records are treated as cases. Go back to the "Case Definition" step to get accurate analysis results.'}
            </p>
          </div>
        </div>
      )}

      {/* ── Case Definition ──────────────────────────────────────────────────── */}
      {hasCaseDefinition && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-4 rounded-full bg-blue-500" />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-blue-600">
              {t('ov_case_def_label', lang)}
            </h2>
            {caseDefinition?.name && (
              <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-medium">
                {caseDefinition.name}
              </span>
            )}
          </div>
          <p className="text-slate-700 text-sm leading-relaxed">
            {caseDefinition?.human_readable || (
              lang === 'th'
                ? 'มีการกำหนดนิยามผู้ป่วยแล้ว'
                : 'A case definition has been applied to this project.'
            )}
          </p>
        </div>
      )}

      {/* ── Executive Summary ────────────────────────────────────────────────── */}
      {data.total_records != null && (
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-5 rounded-full bg-teal-600" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-teal-700">
              {t('ov_exec_summary', lang)}
            </h2>
          </div>
          <p className="text-slate-700 text-sm leading-relaxed">{buildSummary(data, lang)}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <KpiCard title={t('ov_total', lang)} value={data.total_records} />
        <KpiCard title={t('ov_cases', lang)} value={data.case_count} highlight />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title={t('ov_attack_rate', lang)}
          value={`${data.attack_rate}%`}
          highlight
          info={lang === 'th' ? 'ผู้ป่วย ÷ ผู้ถูกสอบสวนทั้งหมด × 100' : 'Cases ÷ Total Investigated × 100'}
        />
        <KpiCard
          title={t('ov_peak_onset', lang)}
          value={fmtDate(data.peak_onset_date, lang)}
          subtitle={
            data.first_onset && data.last_onset
              ? `${t('ov_first', lang)} ${fmtDate(data.first_onset, lang)}  ·  ${t('ov_last', lang)} ${fmtDate(data.last_onset, lang)}`
              : undefined
          }
        />
        <KpiCard
          title={t('ov_period', lang)}
          value={
            data.outbreak_duration_days != null
              ? `${data.outbreak_duration_days} ${data.outbreak_duration_days !== 1 ? t('ov_days', lang) : t('ov_day', lang)}`
              : '—'
          }
          subtitle={
            data.first_onset && data.last_onset
              ? `${fmtDate(data.first_onset)} – ${fmtDate(data.last_onset)}`
              : undefined
          }
        />
        <KpiCard
          title={t('ov_median_age', lang)}
          value={data.median_age != null ? `${data.median_age} ${t('ov_yrs', lang)}` : '—'}
          subtitle={
            data.age_q1 != null && data.age_q3 != null
              ? `${t('ov_iqr', lang)} ${fmtNum(data.age_q1, 1)} – ${fmtNum(data.age_q3, 1)} ${t('ov_yrs', lang)}`
              : undefined
          }
        />
      </div>

      {hasClinical && (
        <div className="flex flex-wrap gap-4">
          {hasHosp && (
            <div className="flex-1 min-w-[140px]">
              <KpiCard title={t('ov_hospitalised', lang)} value={data.hospitalized_count} />
            </div>
          )}
          {hasAdmRate && (
            <div className="flex-1 min-w-[140px]">
              <KpiCard title={t('ov_admission_rate', lang)} value={`${data.hospitalization_rate}%`} highlight />
            </div>
          )}
          {hasDeath && (
            <div className="flex-1 min-w-[140px]">
              <KpiCard title={t('ov_deaths', lang)} value={data.death_count} />
            </div>
          )}
          {hasLab && (
            <div className="flex-1 min-w-[140px]">
              <KpiCard title={t('ov_lab_confirmed', lang)} value={data.lab_positive_count} />
            </div>
          )}
          {hasLabPct && (
            <div className="flex-1 min-w-[140px]">
              <KpiCard title={t('ov_lab_rate', lang)} value={`${data.lab_positive_pct}%`} highlight />
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <KpiCard
          title={t('ov_top_symptom', lang)}
          value={data.most_common_symptom || '—'}
          subtitle={t('ov_top_symptom_sub', lang)}
        />
        <KpiCard
          title={t('ov_top_exposure', lang)}
          value={data.top_exposure_signal || '—'}
          subtitle={t('ov_top_exposure_sub', lang)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <ChartCard title={t('ov_epi_curve', lang)}>
          {timeData?.epi_curve?.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={timeData.epi_curve}
                margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11}
                  angle={-45} textAnchor="end" tickMargin={4} />
                <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: '#334155' }}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}
                />
                <Bar dataKey="case_count" fill="#14b8a6" radius={[3, 3, 0, 0]} name={t('ov_cases', lang)} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
              {t('ov_no_onset', lang)}
            </div>
          )}
        </ChartCard>

        <ChartCard title={t('ov_top_symptoms', lang)}>
          {personData?.symptoms?.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={personData.symptoms.slice(0, 6)}
                layout="vertical"
                margin={{ top: 8, right: 24, left: 48, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" stroke="#94a3b8" fontSize={12} unit="%" />
                <YAxis dataKey="symptom" type="category" stroke="#94a3b8" fontSize={12} width={80} />
                <Tooltip
                  cursor={{ fill: '#334155' }}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}
                  formatter={(v) => [`${v}%`, `% ${t('ov_cases', lang)}`]}
                />
                <Bar dataKey="percentage" fill="#8b5cf6" radius={[0, 3, 3, 0]} name={`% ${t('ov_cases', lang)}`} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
              {t('ov_no_symptoms', lang)}
            </div>
          )}
        </ChartCard>

      </div>
    </div>
  );
}
