import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'

export default function UploadZone({ onUploadComplete, onRateLimit }) {
  const [isDragging, setIsDragging]   = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError]             = useState(null)
  const [progress, setProgress]       = useState(null)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  const handleFile = async (file) => {
    setError(null)
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      setError('รองรับเฉพาะไฟล์ CSV และ Excel (.xlsx, .xls) เท่านั้น')
      return
    }
    setIsUploading(true)

    // Wake the server in case it's sleeping (Render free-tier cold start)
    setProgress('กำลังเชื่อมต่อเซิร์ฟเวอร์…')
    try {
      await api.get('/health', { timeout: 45000 })
    } catch {
      // ignore — if health fails, we still try the upload below
    }

    const formData = new FormData()
    formData.append('file', file)

    const doUpload = () => api.post('/upload/', formData, { timeout: 90000 })

    try {
      setProgress('กำลังอัปโหลด…')
      let response
      try {
        response = await doUpload()
      } catch (firstErr) {
        // Retry once after 3 s on network errors (no response = cold-start drop)
        if (!firstErr.response) {
          setProgress('กำลังลองใหม่อีกครั้ง…')
          await new Promise(r => setTimeout(r, 3000))
          response = await doUpload()
        } else {
          throw firstErr
        }
      }
      const { data } = response
      setProgress('เตรียมหน้าจับคู่คอลัมน์…')
      await new Promise(r => setTimeout(r, 200))
      onUploadComplete?.(data)
      navigate(`/mapping/${data.project_id}`)
    } catch (err) {
      if (err.response?.status === 429) {
        onRateLimit?.()
        return
      }
      const detail = err.response?.data?.detail
      if (typeof detail === 'object') {
        setError(`${detail.message}: ${detail.errors?.join(', ')}`)
      } else {
        setError(detail || 'อัปโหลดไม่สำเร็จ กรุณาตรวจสอบไฟล์อีกครั้ง')
      }
    } finally {
      setIsUploading(false)
      setProgress(null)
    }
  }

  const onDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div className="w-full">
      <motion.div
        whileHover={{ scale: isUploading ? 1 : 1.005 }}
        onClick={() => !isUploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`
          relative cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-200
          ${isDragging
            ? 'border-teal-500 bg-teal-50 shadow-[0_0_0_4px_rgba(20,184,166,0.08)]'
            : 'border-slate-300 bg-white hover:border-teal-400 hover:bg-teal-50/30 hover:shadow-sm'
          }
          ${isUploading ? 'cursor-default opacity-80' : ''}
        `}
      >
        <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
          onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])} />

        <div className="flex flex-col items-center justify-center gap-4 px-8 py-14">
          <AnimatePresence mode="wait">
            {isUploading ? (
              <motion.div key="uploading"
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                className="flex flex-col items-center gap-3"
              >
                <svg className="w-12 h-12 animate-spin text-teal-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                  <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <p className="text-sm text-teal-600 font-medium">{progress}</p>
              </motion.div>
            ) : (
              <motion.div key="idle"
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center gap-4"
              >
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors
                  ${isDragging ? 'bg-teal-100' : 'bg-slate-100'}`}>
                  <svg className={`w-8 h-8 transition-colors ${isDragging ? 'text-teal-600' : 'text-slate-400'}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/>
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-base font-medium text-slate-700">
                    {isDragging ? 'วางไฟล์เพื่ออัปโหลด' : 'วาง Line List ที่นี่'}
                  </p>
                  <p className="text-sm text-slate-400 mt-1">หรือคลิกเพื่อเลือกไฟล์</p>
                </div>
                <div className="flex gap-2">
                  {['CSV', 'XLSX', 'XLS'].map(f => (
                    <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-mono">
                      {f}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
