import React, { useState } from 'react';
import { useLang } from '../../context/LangContext';
import api from '../../api/client';
import { t } from '../../i18n';
import OverviewTab from './tabs/OverviewTab';
import TimeTab from './tabs/TimeTab';
import PlaceTab from './tabs/PlaceTab';
import PersonTab from './tabs/PersonTab';
import ExposureTab from './tabs/ExposureTab';
import AnalyticTab from './tabs/AnalyticTab';
import DataQualityTab from './tabs/DataQualityTab';

const TAB_KEYS = ['Overview', 'Time', 'Place', 'Person', 'Exposure', 'Analytic', 'Data Quality'];
const TAB_I18N = {
  Overview:     'tab_overview',
  Time:         'tab_time',
  Place:        'tab_place',
  Person:       'tab_person',
  Exposure:     'tab_exposure',
  Analytic:     'tab_analytic',
  'Data Quality': 'tab_dataquality',
};

function ShareModal({ projectId, onClose, lang }) {
  const expiryOptions = [
    { label: t('share_12h', lang), value: 12  },
    { label: t('share_1d', lang),  value: 24  },
    { label: t('share_7d', lang),  value: 168 },
  ];
  const [password,    setPassword]    = useState('');
  const [showPw,      setShowPw]      = useState(false);
  const [expiry,      setExpiry]      = useState(24);
  const [customVal,   setCustomVal]   = useState('');
  const [customUnit,  setCustomUnit]  = useState('hours');
  const [loading,     setLoading]     = useState(false);
  const [result,      setResult]      = useState(null);
  const [error,       setError]       = useState(null);
  const [copied,      setCopied]      = useState(false);

  const shareLink = result
    ? `${window.location.origin}/share/${result.token}`
    : null;

  const handleCreate = async () => {
    if (!password.trim()) { setError(t('share_pw_required', lang)); return; }
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post('/api/share', {
        project_id: projectId, password, expires_in_hours: expiry,
      });
      setResult(data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{t('share_modal_title', lang)}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{t('share_modal_desc', lang)}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none transition-colors">×</button>
        </div>

        {!result ? (
          <>
            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">{t('share_password', lang)}</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  placeholder={t('share_password_ph', lang)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 pr-10 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400/20 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs transition-colors"
                >{showPw ? t('share_hide', lang) : t('share_show', lang)}</button>
              </div>
            </div>

            {/* Expiry */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">{t('share_expiry', lang)}</label>
              {/* Quick buttons */}
              <div className="flex gap-2 mb-2">
                {expiryOptions.map(o => (
                  <button
                    key={o.value}
                    onClick={() => { setExpiry(o.value); setCustomVal(''); }}
                    className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      expiry === o.value && customVal === ''
                        ? 'bg-teal-50 border-teal-300 text-teal-700'
                        : 'border-slate-200 text-slate-600 hover:text-slate-800 hover:border-slate-300'
                    }`}
                  >{o.label}</button>
                ))}
              </div>
              {/* Custom input */}
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  min="1"
                  placeholder={t('share_custom_ph', lang)}
                  value={customVal}
                  onChange={e => {
                    const v = e.target.value;
                    setCustomVal(v);
                    const n = parseInt(v);
                    if (n > 0) setExpiry(customUnit === 'days' ? n * 24 : n);
                  }}
                  className={`w-28 bg-white border rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:outline-none transition-colors ${
                    customVal !== '' ? 'border-teal-400 text-teal-700' : 'border-slate-200'
                  }`}
                />
                <select
                  value={customUnit}
                  onChange={e => {
                    const u = e.target.value;
                    setCustomUnit(u);
                    const n = parseInt(customVal);
                    if (n > 0) setExpiry(u === 'days' ? n * 24 : n);
                  }}
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-teal-400 transition-colors"
                >
                  <option value="hours">{t('share_hours_unit', lang)}</option>
                  <option value="days">{t('share_days_unit', lang)}</option>
                </select>
              </div>
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
            >{loading ? t('share_generating', lang) : t('share_generate', lang)}</button>
          </>
        ) : (
          <>
            {/* Success */}
            <div className="flex items-center gap-3 p-3 bg-teal-50 border border-teal-200 rounded-xl">
              <span className="text-teal-600 text-xl">✓</span>
              <div>
                <p className="text-sm font-medium text-teal-700">{t('share_success', lang)}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t('share_expires_lbl', lang)}: {new Date(result.expires_at).toLocaleString(lang === 'th' ? 'th-TH' : 'en-GB')}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">{t('share_link_lbl', lang)}</label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={shareLink}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 font-mono truncate"
                />
                <button
                  onClick={handleCopy}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap ${
                    copied
                      ? 'bg-teal-50 border-teal-200 text-teal-700'
                      : 'border-slate-200 text-slate-600 hover:text-slate-800 hover:border-slate-300'
                  }`}
                >{copied ? t('share_copied', lang) : t('share_copy', lang)}</button>
              </div>
            </div>

            <p className="text-xs text-slate-400 text-center">
              {t('share_pw_note', lang)}
            </p>

            <button onClick={onClose} className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">
              {t('share_done', lang)}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ReportModal({ projectId, onClose, lang }) {
  const [reportLang, setReportLang] = useState(lang === 'th' ? 'th' : 'en');
  const [loading,    setLoading]    = useState(false);
  const [ready,      setReady]      = useState(false);
  const [error,      setError]      = useState(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setReady(false);
    try {
      await api.post(`/report/${projectId}/generate?lang=${reportLang}`);
      setReady(true);
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const { data: blob } = await api.get(
        `/report/${projectId}/download?lang=${reportLang}`,
        { responseType: 'blob' },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `outbreak_report_${reportLang}_${projectId.slice(0, 8)}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download failed', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 space-y-5">

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{t('report_modal_title', lang)}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{t('report_modal_desc', lang)}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none transition-colors">×</button>
        </div>

        {/* Language selector */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">{t('report_lang_label', lang)}</label>
          <div className="flex gap-2">
            {['en', 'th'].map(l => (
              <button
                key={l}
                onClick={() => { setReportLang(l); setReady(false); }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                  reportLang === l
                    ? 'bg-teal-50 border-teal-300 text-teal-700'
                    : 'border-slate-200 text-slate-600 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                {l === 'en' ? '🇬🇧 English' : '🇹🇭 ภาษาไทย'}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-xs text-red-600">{t('report_error', lang)}: {error}</p>}

        {!ready ? (
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t('report_generating', lang)}
              </>
            ) : t('report_generate', lang)}
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-teal-50 border border-teal-200 rounded-xl">
              <svg className="w-4 h-4 text-teal-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-teal-700 font-medium">{t('report_ready', lang)}</span>
            </div>
            <button
              onClick={handleDownload}
              className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {t('report_download', lang)}
            </button>
            <button
              onClick={() => { setReady(false); setReportLang(lang === 'th' ? 'th' : 'en'); }}
              className="w-full py-2 text-xs text-slate-500 hover:text-slate-700 transition-colors"
            >
              {lang === 'th' ? 'สร้างภาษาอื่น' : 'Generate in another language'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardLayout({ data, isShared = false, sharedMeta = null }) {
  const [activeTab,   setActiveTab]   = useState('Overview');
  const [showShare,   setShowShare]   = useState(false);
  const [showReport,  setShowReport]  = useState(false);
  const { lang } = useLang();

  if (!data) return <div className="text-slate-500 p-6">{t('loading_dashboard', lang)}</div>;

  const projectId = data.project_id;

  const renderTab = () => {
    switch (activeTab) {
      case 'Overview':    return <OverviewTab data={data.overview} timeData={data.time} personData={data.person} caseDefinition={data.case_definition} hasCaseDefinition={data.has_case_definition !== false} lang={lang} />;
      case 'Time':        return <TimeTab data={data.time} lang={lang} />;
      case 'Place':       return <PlaceTab data={data.place} lang={lang} />;
      case 'Person':      return <PersonTab data={data.person} lang={lang} />;
      case 'Exposure':    return <ExposureTab data={data.exposure} lang={lang} />;
      case 'Analytic':    return <AnalyticTab data={data.analytic} lang={lang} />;
      case 'Data Quality':return <DataQualityTab data={data.data_quality} lang={lang} />;
      default:            return <OverviewTab data={data.overview} caseDefinition={data.case_definition} hasCaseDefinition={data.has_case_definition !== false} lang={lang} />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-700">
      {showShare  && <ShareModal  projectId={projectId} onClose={() => setShowShare(false)}  lang={lang} />}
      {showReport && <ReportModal projectId={projectId} onClose={() => setShowReport(false)} lang={lang} />}

      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t('dash_title', lang)}</h1>
            {isShared && sharedMeta && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-600 font-medium">
                  {t('dash_readonly', lang)}
                </span>
                <span className="text-xs text-slate-500">
                  {t('dash_expires', lang)} {new Date(sharedMeta.expires_at).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
          {!isShared && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowShare(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 transition-colors text-sm font-medium shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                {t('dash_share_btn', lang)}
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200">
          {TAB_KEYS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-t-lg font-medium whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab
                  ? 'bg-teal-50 text-teal-700 border-teal-600'
                  : 'text-slate-500 border-transparent hover:text-slate-800 hover:bg-slate-100'
              }`}
            >{t(TAB_I18N[tab], lang)}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        {renderTab()}
      </div>
    </div>
  );
}
