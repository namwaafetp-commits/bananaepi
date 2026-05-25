import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../api/client'
import Navbar from '../components/Navbar'
import Spinner from '../components/Spinner'
import OverviewTab from '../components/OverviewTab'
import EpicurveTab from '../components/EpicurveTab'
import PersonTab from '../components/PersonTab'
import AnalyticTab from '../components/AnalyticTab'

const TABS = [
  { id: 'overview', label: 'ภาพรวม',        icon: '◎' },
  { id: 'epicurve', label: 'เส้นโค้งระบาด', icon: '📈' },
  { id: 'person',   label: 'บุคคล',          icon: '👤' },
  { id: 'analytic', label: 'วิเคราะห์',      icon: '⚗️' },
]

export default function ProjectPage() {
  const { id } = useParams()
  const [activeTab, setActiveTab]     = useState('overview')
  const [metadata, setMetadata]       = useState(null)
  const [descriptive, setDescriptive] = useState(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [reportState, setReportState] = useState('idle')

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      api.get(`/projects/${id}`),
      api.get(`/analysis/${id}/descriptive`),
    ])
      .then(([metaRes, descRes]) => {
        setMetadata(metaRes.data)
        setDescriptive(descRes.data)
        if (metaRes.data.status === 'reported') setReportState('ready')
      })
      .catch(err => setError(err.response?.data?.detail || 'ไม่สามารถโหลดข้อมูลโครงการได้'))
      .finally(() => setLoading(false))
  }, [id])

  const handleGenerateReport = async () => {
    setReportState('generating')
    try {
      await api.post(`/report/${id}/generate`)
      setReportState('ready')
    } catch {
      setReportState('error')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Spinner size="lg" label="กำลังโหลดข้อมูลการสอบสวน…" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md text-center shadow-sm">
            <p className="text-4xl mb-3">⚠️</p>
            <p className="font-medium text-slate-800 mb-1">ไม่สามารถโหลดโครงการได้</p>
            <p className="text-sm text-slate-500">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  const filename  = metadata?.original_filename ?? 'การสอบสวน'
  const rowCount  = metadata?.row_count
  const caseCount = descriptive?.case_status?.cases

  const ReportButton = (
    <div className="flex items-center gap-2">
      {reportState === 'ready' ? (
        <>
          <button onClick={() => window.open(`/report/${id}/download`, '_blank')} className="btn-primary flex items-center gap-2 text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            ดาวน์โหลดรายงาน
          </button>
          <button onClick={handleGenerateReport} className="btn-ghost text-sm" title="สร้างใหม่">↻</button>
        </>
      ) : reportState === 'generating' ? (
        <button disabled className="btn-primary flex items-center gap-2 text-sm">
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
            <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          กำลังสร้างรายงาน…
        </button>
      ) : (
        <button onClick={handleGenerateReport} className="btn-primary flex items-center gap-2 text-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          สร้างรายงาน
        </button>
      )}
      {reportState === 'error' && <span className="text-xs text-red-400">ล้มเหลว — ลองอีกครั้ง</span>}
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar
        title={filename}
        subtitle={[
          rowCount  && `${rowCount.toLocaleString()} ระเบียน`,
          caseCount != null && `${caseCount} ราย`,
        ].filter(Boolean).join(' · ')}
        actions={ReportButton}
      />

      {/* Tab bar */}
      <div className="sticky top-14 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-5">
          <div className="flex gap-1 -mb-px">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-4 py-3 text-sm font-medium transition-colors
                  ${activeTab === tab.id ? 'text-teal-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <span className="flex items-center gap-1.5">
                  <span className="text-base leading-none">{tab.icon}</span>
                  {tab.label}
                </span>
                {activeTab === tab.id && (
                  <motion.div layoutId="tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-600 rounded-t-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-5 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            {activeTab === 'overview' && <OverviewTab descriptive={descriptive} metadata={metadata} />}
            {activeTab === 'epicurve' && <EpicurveTab projectId={id} />}
            {activeTab === 'person'   && <PersonTab   descriptive={descriptive} />}
            {activeTab === 'analytic' && <AnalyticTab projectId={id} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
