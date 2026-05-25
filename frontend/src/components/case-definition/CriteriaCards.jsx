import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { t } from '../../i18n/caseDefinition';

const OPERATORS_NUM = ['>=', '>', '==', '<', '<=', 'between'];
const OPERATORS_STR = ['equals', 'not_equals', 'in', 'not_in', 'contains', 'not_missing'];
const OPERATORS_DATE = ['between', 'before', 'after', 'on', 'not_missing'];

const ABBREV = {
  abd: 'Abdominal', abdom: 'Abdominal', abdominal: 'Abdominal',
  gi: 'GI', uri: 'Upper Respiratory', lri: 'Lower Respiratory',
  resp: 'Respiratory', chest: 'Chest',
  pain: 'Pain', ache: 'Ache',
  fever: 'Fever', fev: 'Fever',
  cough: 'Cough',
  diarrhea: 'Diarrhea', diarr: 'Diarrhea', diar: 'Diarrhea',
  vomiting: 'Vomiting', vom: 'Vomiting', vomit: 'Vomiting',
  nausea: 'Nausea', naus: 'Nausea',
  rash: 'Rash',
  headache: 'Headache', ha: 'Headache', head: 'Headache',
  myalgia: 'Myalgia', myalg: 'Myalgia',
  arthralgia: 'Arthralgia', arthralg: 'Arthralgia',
  fatigue: 'Fatigue', malaise: 'Malaise', weakness: 'Weakness',
  chills: 'Chills', rigor: 'Rigors', rigors: 'Rigors',
  jaundice: 'Jaundice', jaund: 'Jaundice',
  dyspnea: 'Dyspnea', sob: 'Shortness of Breath',
  anorexia: 'Anorexia', anorex: 'Anorexia',
  cramp: 'Cramps', cramps: 'Cramps',
  bloating: 'Bloating', constipation: 'Constipation', consti: 'Constipation',
  bleeding: 'Bleeding', bleed: 'Bleeding',
  hemorrhage: 'Hemorrhage', hemorrh: 'Hemorrhage',
  edema: 'Edema', swelling: 'Swelling', swell: 'Swelling',
  dizziness: 'Dizziness', dizzy: 'Dizziness', dizz: 'Dizziness',
  convulsion: 'Convulsion', convuls: 'Convulsion',
  paralysis: 'Paralysis', paralys: 'Paralysis',
  conj: 'Conjunctival', conjunctival: 'Conjunctival',
  lymph: 'Lymphadenopathy', dehydration: 'Dehydration', dehydr: 'Dehydration',
  temp: 'Temperature', tmp: 'Temperature', temperature: 'Temperature',
  times: 'Times/Day', frequency: 'Frequency', freq: 'Frequency', count: 'Count',
  onset: 'Onset', date: 'Date', datetime: 'Date & Time', time: 'Time',
  investigation: 'Investigation', notification: 'Notification', admission: 'Admission', discharge: 'Discharge',
  province: 'Province', district: 'District', subdistrict: 'Sub-district',
  village: 'Village', location: 'Location', address: 'Address', place: 'Place',
  result: 'Result', lab: 'Lab', pathogen: 'Pathogen',
};

function humanizeCol(col) {
  const stripped = col.replace(/^symptom_/, '').replace(/^numeric_/, '');
  return stripped
    .split('_')
    .map(w => ABBREV[w.toLowerCase()] ?? (w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
}

const inputCls = 'w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400/20 transition-colors';
const labelCls = 'block text-xs text-slate-500 mb-1';

export function TimeCriteriaCard({ rules, setRules, timeCols, lang = 'th' }) {
  const T = t[lang];
  const [enabled, setEnabled] = useState(false);

  const toggle = () => {
    if (!enabled) {
      setRules(p => [...p, { type: 'time', enabled: true, column: '', operator: 'between', start: '', end: '', value: '' }]);
    } else {
      setRules(p => p.filter(r => r.type !== 'time'));
    }
    setEnabled(!enabled);
  };

  const update = (k, v) => setRules(p => p.map(r => r.type === 'time' ? { ...r, [k]: v } : r));
  const timeRule = rules.find(r => r.type === 'time');

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <input type="checkbox" checked={enabled} onChange={toggle}
          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
        <h3 className="text-sm font-medium text-slate-700">{T.enableTime}</h3>
      </div>

      <AnimatePresence>
        {enabled && timeRule && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{T.dateCol}</label>
                <select value={timeRule.column} onChange={e => update('column', e.target.value)} className={inputCls}>
                  <option value="">{T.selectPlaceholder}</option>
                  {timeCols.map(c => <option key={c} value={c}>{humanizeCol(c)}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>{T.operator}</label>
                <select value={timeRule.operator} onChange={e => update('operator', e.target.value)} className={inputCls}>
                  {OPERATORS_DATE.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>

            {timeRule.operator === 'between' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{T.startDate}</label>
                  <input type="date" value={timeRule.start} onChange={e => update('start', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{T.endDate}</label>
                  <input type="date" value={timeRule.end} onChange={e => update('end', e.target.value)} className={inputCls} />
                </div>
              </div>
            ) : timeRule.operator !== 'not_missing' ? (
              <div>
                <label className={labelCls}>{T.date}</label>
                <input type="date" value={timeRule.value} onChange={e => update('value', e.target.value)} className={inputCls} />
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PlaceCriteriaCard({ rules, setRules, placeCols, lang = 'th' }) {
  const T = t[lang];
  const [enabled, setEnabled] = useState(false);

  const toggle = () => {
    if (!enabled) {
      setRules(p => [...p, { type: 'place_group', enabled: true, logic: 'AND', rules: [{ id: Date.now(), type: 'place', column: '', operator: 'equals', value: '' }] }]);
    } else {
      setRules(p => p.filter(r => r.type !== 'place_group'));
    }
    setEnabled(!enabled);
  };

  const group = rules.find(r => r.type === 'place_group');

  const addPlace = () => {
    setRules(p => p.map(r => r.type === 'place_group' ? { ...r, rules: [...r.rules, { id: Date.now(), type: 'place', column: '', operator: 'equals', value: '' }] } : r));
  };

  const updatePlace = (id, k, v) => {
    setRules(p => p.map(r => {
      if (r.type === 'place_group') return { ...r, rules: r.rules.map(pr => pr.id === id ? { ...pr, [k]: v } : pr) };
      return r;
    }));
  };

  const removePlace = (id) => {
    setRules(p => p.map(r => {
      if (r.type === 'place_group') return { ...r, rules: r.rules.filter(pr => pr.id !== id) };
      return r;
    }));
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <input type="checkbox" checked={enabled} onChange={toggle}
          className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500" />
        <h3 className="text-sm font-medium text-slate-700">{T.enablePlace}</h3>
      </div>

      <AnimatePresence>
        {enabled && group && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden">
            {group.rules.map((pr) => (
              <div key={pr.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 relative">
                <button onClick={() => removePlace(pr.id)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500">×</button>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>{T.column}</label>
                    <select value={pr.column} onChange={e => updatePlace(pr.id, 'column', e.target.value)} className={inputCls}>
                      <option value="">{T.selectPlaceholder}</option>
                      {placeCols.map(c => <option key={c} value={c}>{humanizeCol(c)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>{T.operator}</label>
                    <select value={pr.operator} onChange={e => updatePlace(pr.id, 'operator', e.target.value)} className={inputCls}>
                      {OPERATORS_STR.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
                {['in', 'not_in'].includes(pr.operator) ? (
                  <div>
                    <label className={labelCls}>{T.valuesCommaSep}</label>
                    <input type="text" value={(pr.values || []).join(', ')} onChange={e => updatePlace(pr.id, 'values', e.target.value.split(',').map(s => s.trim()))} className={inputCls} />
                  </div>
                ) : pr.operator !== 'not_missing' ? (
                  <div>
                    <label className={labelCls}>{T.value}</label>
                    <input type="text" value={pr.value || ''} onChange={e => updatePlace(pr.id, 'value', e.target.value)} className={inputCls} />
                  </div>
                ) : null}
              </div>
            ))}
            <button onClick={addPlace} className="text-xs text-green-600 hover:text-green-700 transition-colors">{T.addPlaceRule}</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LogicPill({ logic, onToggle, prominent = false }) {
  const size = prominent ? 'px-5 py-1.5 text-xs font-bold' : 'px-3 py-1 text-xs font-semibold';
  const color = logic === 'AND'
    ? 'bg-purple-100 ring-purple-300 text-purple-700 hover:bg-purple-200'
    : 'bg-blue-100 ring-blue-300 text-blue-700 hover:bg-blue-200';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px bg-slate-200" />
      <button onClick={onToggle} className={`${size} rounded-full ring-1 transition-all ${color}`}>{logic}</button>
      <div className="flex-1 h-px bg-slate-200" />
    </div>
  );
}

export function ClinicalGroupCard({ rules, setRules, symptomCols, numericSymptomCols, labCols, lang = 'th' }) {
  const T = t[lang];
  const group = rules.find(r => r.type === 'clinical_or_lab_group');

  React.useEffect(() => {
    if (!group) {
      setRules(p => {
        if (p.some(r => r.type === 'clinical_or_lab_group')) return p;
        return [...p, {
          type: 'clinical_or_lab_group', enabled: true, logic: 'OR', rules: [
            { id: 'symp-group',    type: 'group', enabled: true, logic: 'OR', rules: [
              { id: Date.now(), type: 'symptom_any', columns: [], minimum_required: 1 }
            ]},
            { id: 'measure-group', type: 'group', enabled: true, logic: 'OR', rules: [] }
          ]
        }];
      });
    }
  }, [group, setRules]);

  if (!group) return null;

  const innerRules   = group.rules || [];
  const sympGroup    = innerRules.find(r => r.id === 'symp-group');
  const measureGroup = innerRules.find(r => r.id === 'measure-group');
  const sympRules    = sympGroup?.rules    || [];
  const measureRules = measureGroup?.rules || [];
  const sympLogic    = sympGroup?.logic    || 'OR';
  const measureLogic = measureGroup?.logic || 'OR';
  const clinicalLogic = group.logic        || 'OR';

  const toggleSympLogic = () =>
    setRules(p => p.map(r => r.type !== 'clinical_or_lab_group' ? r : {
      ...r, rules: r.rules.map(ir => ir.id === 'symp-group' ? { ...ir, logic: ir.logic === 'OR' ? 'AND' : 'OR' } : ir)
    }));

  const toggleMeasureLogic = () =>
    setRules(p => p.map(r => r.type !== 'clinical_or_lab_group' ? r : {
      ...r, rules: r.rules.map(ir => ir.id === 'measure-group' ? { ...ir, logic: ir.logic === 'OR' ? 'AND' : 'OR' } : ir)
    }));

  const toggleClinicalLogic = () =>
    setRules(p => p.map(r => r.type === 'clinical_or_lab_group' ? { ...r, logic: r.logic === 'OR' ? 'AND' : 'OR' } : r));

  const addSympRule = () =>
    setRules(p => p.map(r => r.type !== 'clinical_or_lab_group' ? r : {
      ...r, rules: r.rules.map(ir => ir.id !== 'symp-group' ? ir : {
        ...ir, rules: [...ir.rules, { id: Date.now(), type: 'symptom_any', columns: [], minimum_required: 1 }]
      })
    }));

  const removeSympRule = (id) =>
    setRules(p => p.map(r => r.type !== 'clinical_or_lab_group' ? r : {
      ...r, rules: r.rules.map(ir => ir.id !== 'symp-group' ? ir : {
        ...ir, rules: ir.rules.filter(sr => sr.id !== id)
      })
    }));

  const updateSympRule = (id, k, v) =>
    setRules(p => p.map(r => r.type !== 'clinical_or_lab_group' ? r : {
      ...r, rules: r.rules.map(ir => ir.id !== 'symp-group' ? ir : {
        ...ir, rules: ir.rules.map(sr => sr.id === id ? { ...sr, [k]: v } : sr)
      })
    }));

  const updateSympRuleFields = (id, fields) =>
    setRules(p => p.map(r => r.type !== 'clinical_or_lab_group' ? r : {
      ...r, rules: r.rules.map(ir => ir.id !== 'symp-group' ? ir : {
        ...ir, rules: ir.rules.map(sr => sr.id === id ? { ...sr, ...fields } : sr)
      })
    }));

  const toggleSympCol = (ruleId, col) =>
    setRules(p => p.map(r => r.type !== 'clinical_or_lab_group' ? r : {
      ...r, rules: r.rules.map(ir => ir.id !== 'symp-group' ? ir : {
        ...ir, rules: ir.rules.map(sr => {
          if (sr.id !== ruleId) return sr;
          const cols = sr.columns || [];
          return { ...sr, columns: cols.includes(col) ? cols.filter(c => c !== col) : [...cols, col] };
        })
      })
    }));

  const addMeasureRule = (type) => {
    const newRule = type === 'lab'
      ? { id: Date.now(), type: 'lab', column: '', operator: 'equals', value: '' }
      : { id: Date.now(), type: 'numeric_symptom', column: '', operator: '>=', value: 0 };
    setRules(p => p.map(r => r.type !== 'clinical_or_lab_group' ? r : {
      ...r, rules: r.rules.map(ir => ir.id !== 'measure-group' ? ir : {
        ...ir, rules: [...ir.rules, newRule]
      })
    }));
  };

  const removeMeasureRule = (id) =>
    setRules(p => p.map(r => r.type !== 'clinical_or_lab_group' ? r : {
      ...r, rules: r.rules.map(ir => ir.id !== 'measure-group' ? ir : {
        ...ir, rules: ir.rules.filter(mr => mr.id !== id)
      })
    }));

  const updateMeasureRule = (id, k, v) =>
    setRules(p => p.map(r => r.type !== 'clinical_or_lab_group' ? r : {
      ...r, rules: r.rules.map(ir => ir.id !== 'measure-group' ? ir : {
        ...ir, rules: ir.rules.map(mr => mr.id === id ? { ...mr, [k]: v } : mr)
      })
    }));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
      <h3 className="text-sm font-medium text-purple-700">{T.clinicalTitle}</h3>

      {/* ── Symptom blocks ── */}
      {sympRules.map((sr, index) => (
        <React.Fragment key={sr.id}>
          {index > 0 && <LogicPill logic={sympLogic} onToggle={toggleSympLogic} />}
          <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 relative">
            {sympRules.length > 1 && (
              <button onClick={() => removeSympRule(sr.id)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500 leading-none">×</button>
            )}
            <div className="flex gap-3 mb-3 pr-6">
              <div className="flex-1">
                <label className={labelCls}>{T.ruleType}</label>
                <select value={sr.type} onChange={e => {
                  const newType = e.target.value;
                  updateSympRuleFields(sr.id, {
                    type: newType,
                    minimum_required: newType === 'symptom_n_of_m' ? (sr.minimum_required || 1) : 1,
                  });
                }} className={inputCls}>
                  <option value="symptom_any">{T.anySymptoms}</option>
                  <option value="symptom_all">{T.allSymptoms}</option>
                  <option value="symptom_n_of_m">{T.nOfMSymptoms}</option>
                </select>
              </div>
              {sr.type === 'symptom_n_of_m' && (
                <div className="w-24">
                  <label className={labelCls}>{T.minRequired}</label>
                  <input type="number" min="1" value={sr.minimum_required || 1} onChange={e => updateSympRule(sr.id, 'minimum_required', parseInt(e.target.value))} className={inputCls} />
                </div>
              )}
            </div>
            <label className={labelCls}>{T.symptoms}</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {symptomCols.map(c => (
                <label key={c} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={(sr.columns || []).includes(c)} onChange={() => toggleSympCol(sr.id, c)}
                    className="rounded border-slate-300 text-purple-600 focus:ring-purple-500" />
                  <span className="truncate">{humanizeCol(c)}</span>
                </label>
              ))}
            </div>
          </div>
        </React.Fragment>
      ))}
      <button onClick={addSympRule} className="text-xs text-purple-600 hover:text-purple-700 transition-colors">{T.addSympRule}</button>

      {measureRules.length > 0 && <LogicPill logic={clinicalLogic} onToggle={toggleClinicalLogic} prominent />}

      {/* ── Numeric + Lab rules ── */}
      {measureRules.map((mr, index) => (
        <React.Fragment key={mr.id}>
          {index > 0 && <LogicPill logic={measureLogic} onToggle={toggleMeasureLogic} />}
          {mr.type === 'numeric_symptom' && (
            <div className="p-3 bg-pink-50 rounded-lg border border-pink-200 relative">
              <button onClick={() => removeMeasureRule(mr.id)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500">×</button>
              <h4 className="text-xs font-semibold text-pink-700 mb-2">{T.numericRuleTitle}</h4>
              <div className="grid grid-cols-3 gap-3">
                <select value={mr.column} onChange={e => updateMeasureRule(mr.id, 'column', e.target.value)} className={inputCls}>
                  <option value="">{T.columnPlaceholder}</option>
                  {numericSymptomCols.map(c => <option key={c} value={c}>{humanizeCol(c)}</option>)}
                </select>
                <select value={mr.operator} onChange={e => updateMeasureRule(mr.id, 'operator', e.target.value)} className={inputCls}>
                  {OPERATORS_NUM.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <input type="number" placeholder={T.value} value={mr.value || ''} onChange={e => updateMeasureRule(mr.id, 'value', parseFloat(e.target.value))} className={inputCls} />
              </div>
            </div>
          )}
          {mr.type === 'lab' && (
            <div className="p-3 bg-cyan-50 rounded-lg border border-cyan-200 relative">
              <button onClick={() => removeMeasureRule(mr.id)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500">×</button>
              <h4 className="text-xs font-semibold text-cyan-700 mb-2">{T.labRuleTitle}</h4>
              <div className="grid grid-cols-3 gap-3">
                <select value={mr.column} onChange={e => updateMeasureRule(mr.id, 'column', e.target.value)} className={inputCls}>
                  <option value="">{T.columnPlaceholder}</option>
                  {labCols.map(c => <option key={c} value={c}>{humanizeCol(c)}</option>)}
                </select>
                <select value={mr.operator} onChange={e => updateMeasureRule(mr.id, 'operator', e.target.value)} className={inputCls}>
                  {OPERATORS_STR.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <input type="text" placeholder={T.value} value={mr.value || ''} onChange={e => updateMeasureRule(mr.id, 'value', e.target.value)} className={inputCls} />
              </div>
            </div>
          )}
        </React.Fragment>
      ))}

      <div className="flex items-center gap-4 flex-wrap">
        <button onClick={() => addMeasureRule('numeric_symptom')} className="text-xs text-pink-600 hover:text-pink-700 transition-colors">{T.addNumericRule}</button>
        <button onClick={() => addMeasureRule('lab')} className="text-xs text-cyan-600 hover:text-cyan-700 transition-colors">{T.addLabRule}</button>
        <span className="text-xs text-slate-400 italic">{T.bothOptional}</span>
      </div>
    </div>
  );
}
