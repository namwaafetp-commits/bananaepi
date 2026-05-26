import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import Spinner from '../components/Spinner';
import { useLang } from '../context/LangContext';
import { t } from '../i18n/caseDefinition';

import { TimeCriteriaCard, PlaceCriteriaCard, ClinicalGroupCard } from '../components/case-definition/CriteriaCards';
import { HumanReadableDefinitionBox, WarningBox, CaseDefinitionPreviewTable } from '../components/case-definition/PreviewComponents';

export default function CaseDefinitionPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { lang, toggle } = useLang();
  const T = t[lang];

  const [loading, setLoading] = useState(true);
  const [colData, setColData] = useState(null);
  const [projectMeta, setProjectMeta] = useState(null);
  const [error, setError] = useState(null);

  const [name, setName] = useState("Suspected");
  const [outputCol, setOutputCol] = useState("met_case_def");
  const [rules, setRules] = useState([]);

  const [previewing, setPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [draftText, setDraftText] = useState("");

  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState(null);
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get(`/case-definition/${projectId}/columns`),
      api.get(`/projects/${projectId}`),
    ]).then(([cols, metaResponse]) => {
      setColData(cols.data);
      setProjectMeta(metaResponse.data);
      const active = metaResponse.data?.active_case_definition;
      if (active && active.rule_json) {
        setRules(active.rule_json.rules || []);
        setName(active.rule_json.case_definition_name || "Suspected");
        setOutputCol(active.rule_json.output_column || "met_case_def");
      }
    }).catch(e => setError(e.response?.data?.detail || 'Failed to load column data.'))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    if (rules.length === 0) return;
    setPreviewing(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.post(`/case-definition/${projectId}/preview`, {
          rule_json: { case_definition_name: name, output_column: outputCol, version: "v1", logic: "AND", rules }
        });
        setPreviewData(res.data);
        setDraftText(res.data.human_readable_text);
      } catch (e) {
        console.error(e);
      } finally {
        setPreviewing(false);
      }
    }, 700);
    return () => { clearTimeout(timer); setPreviewing(false); };
  }, [rules, name, outputCol, projectId]);

  // After a successful apply, wait briefly for Supabase Storage to propagate
  // the new file before navigating — avoids the dashboard reading stale content.
  useEffect(() => {
    if (!applyResult) return;
    setNavigating(true);
    const timer = setTimeout(() => navigate(`/dashboard/${projectId}`), 1500);
    return () => clearTimeout(timer);
  }, [applyResult, projectId, navigate]);

  const handlePreview = async () => {
    setPreviewing(true);
    setPreviewData(null);
    try {
      const res = await api.post(`/case-definition/${projectId}/preview`, {
        rule_json: { case_definition_name: name, output_column: outputCol, version: "v1", logic: "AND", rules }
      });
      setPreviewData(res.data);
      setDraftText(res.data.human_readable_text);
    } catch (e) {
      console.error(e);
      alert(lang === 'th' ? 'แสดงตัวอย่างไม่สำเร็จ กรุณาตรวจสอบกฎอีกครั้ง' : 'Preview failed. Please check your rules.');
    } finally {
      setPreviewing(false);
    }
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      const res = await api.post(`/case-definition/${projectId}/apply`, {
        case_definition_name: name,
        output_column: outputCol,
        rule_json: { case_definition_name: name, output_column: outputCol, version: "v1", logic: "AND", rules }
      });
      setApplyResult(res.data);
    } catch (e) {
      console.error(e);
      alert(lang === 'th' ? 'บันทึกไม่สำเร็จ กรุณาตรวจสอบกฎอีกครั้ง' : 'Apply failed. Please check your rules.');
    } finally {
      setApplying(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Spinner label={T.loadingCols} />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="bg-white border border-red-200 rounded-2xl p-8 text-red-600 text-center max-w-md shadow-sm">
        <p className="font-semibold mb-2">{T.error}</p>
        <p className="text-sm">{error}</p>
        <button onClick={() => navigate(`/dashboard/${projectId}`)}
          className="mt-4 text-sm text-slate-500 hover:text-slate-700 transition-colors">
          {T.skipToProject}
        </button>
      </div>
    </div>
  );

  if (applyResult) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 p-8 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl p-6 ring-1 ring-teal-200 shadow-md text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-teal-700">{T.defApplied}</h2>
          <p className="text-sm text-slate-600">{T.defAppliedDesc(applyResult.output_column)}</p>

          <div className="grid grid-cols-3 gap-3 my-6">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="text-xl font-bold text-teal-600">{applyResult.summary?.case_count}</div>
              <div className="text-xs text-slate-500">{T.cases}</div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="text-xl font-bold text-slate-700">{applyResult.summary?.non_case_count}</div>
              <div className="text-xs text-slate-500">{T.nonCases}</div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="text-xl font-bold text-amber-500">{applyResult.summary?.unknown_count}</div>
              <div className="text-xs text-slate-500">{T.unknown}</div>
            </div>
          </div>

          <button
            onClick={() => navigate(`/dashboard/${projectId}`)}
            disabled={navigating}
            className="btn-primary w-full disabled:opacity-80 disabled:cursor-default"
          >
            {navigating ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                {lang === 'th' ? 'กำลังเตรียม Dashboard…' : 'Preparing Dashboard…'}
              </span>
            ) : T.proceedToAnalysis}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col h-screen">
      {/* Header */}
      <div className="flex-none border-b border-slate-200 bg-white shadow-sm px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-slate-900">{T.pageTitle}</h1>
          <p className="text-xs text-slate-500">{T.pageSubtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Language toggle */}
          <button
            onClick={toggle}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold transition-colors hover:border-slate-300 hover:bg-slate-50"
            title={lang === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'}
          >
            <span className={lang === 'th' ? 'text-teal-600' : 'text-slate-400'}>TH</span>
            <span className="text-slate-400 text-[10px]">/</span>
            <span className={lang === 'en' ? 'text-teal-600' : 'text-slate-400'}>EN</span>
          </button>
          <button onClick={() => navigate(`/project/${projectId}`)}
            className="text-xs text-slate-500 hover:text-slate-700 transition-colors">
            {T.skipForNow}
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left Pane: Rule Builder */}
        <div className="w-1/2 overflow-y-auto p-6 space-y-6 border-r border-slate-200 custom-scrollbar">

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">{T.caseDefType}</label>
              <select value={name} onChange={e => setName(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400/20 transition-colors">
                <option value="Suspected">{T.suspected}</option>
                <option value="Probable">{T.probable}</option>
                <option value="Confirmed">{T.confirmed}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">{T.outputCol}</label>
              <input type="text" value={outputCol} onChange={e => setOutputCol(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400/20 transition-colors" />
            </div>
          </div>

          <div className="h-px bg-slate-200 my-6" />

          <ClinicalGroupCard
            rules={rules} setRules={setRules}
            symptomCols={colData?.symptom_columns || []}
            numericSymptomCols={colData?.numeric_symptom_columns || []}
            labCols={colData?.lab_columns || []}
            lang={lang}
          />

          <TimeCriteriaCard rules={rules} setRules={setRules} timeCols={colData?.time_columns || []} lang={lang} />

          <div className="flex items-center gap-3 -my-1">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="px-3 py-0.5 text-xs font-semibold rounded-full ring-1 ring-slate-200 text-slate-500 bg-white select-none">AND</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <PlaceCriteriaCard rules={rules} setRules={setRules} placeCols={colData?.place_columns || []} lang={lang} />
        </div>

        {/* Right Pane: Preview and Apply */}
        <div className="w-1/2 overflow-y-auto p-6 bg-slate-100/50 flex flex-col custom-scrollbar">
          <div className="flex-1 space-y-6">
            <HumanReadableDefinitionBox
              text={draftText || (lang === 'th' ? 'เริ่มสร้างกฎเพื่อสร้างนิยาม' : 'Start building rules to generate the text definition.')}
              lang={lang}
            />

            <div className="flex justify-center">
              <button onClick={handlePreview} disabled={previewing || rules.length === 0} className="btn-secondary w-full max-w-sm">
                {previewing ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    {T.calculating}
                  </span>
                ) : T.refreshPreview}
              </button>
            </div>

            {previewData && (
              <div className="space-y-4 animate-fade-in-up">
                <WarningBox warnings={previewData.warnings} lang={lang} />
                <CaseDefinitionPreviewTable summary={previewData.summary} previewRows={previewData.preview_rows} lang={lang} />
              </div>
            )}
          </div>

          <div className="flex-none pt-6 mt-6 border-t border-slate-200 sticky bottom-0 bg-white/90 backdrop-blur pb-6">
            <button
              onClick={handleApply}
              disabled={applying || previewing}
              className="btn-primary w-full shadow-lg shadow-teal-200/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {applying ? T.applying : T.applyDef}
            </button>
            {previewing && <p className="text-center text-xs text-slate-500 mt-2">{T.calcPreview}</p>}
          </div>
        </div>

      </div>
    </div>
  );
}
