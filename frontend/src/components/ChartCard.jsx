import Spinner from './Spinner'

export default function ChartCard({ title, chart, caption }) {
  if (!chart) return null
  if (chart.error) {
    return (
      <div className="card p-6 text-slate-500 text-sm italic">
        {title && <p className="font-medium text-slate-400 mb-1">{title}</p>}
        Chart unavailable: {chart.error}
      </div>
    )
  }
  if (!chart.image_base64) {
    return (
      <div className="card p-6 flex items-center justify-center min-h-[200px]">
        <Spinner label="Rendering chart…" />
      </div>
    )
  }
  return (
    <div className="card overflow-hidden">
      {title && (
        <div className="px-5 pt-5 pb-3 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900 text-sm">{title}</h3>
        </div>
      )}
      <div className="p-4">
        <img
          src={`data:image/png;base64,${chart.image_base64}`}
          alt={title || 'Chart'}
          className="w-full rounded-xl"
        />
        {caption && (
          <p className="text-xs text-slate-500 mt-2 text-center italic">{caption}</p>
        )}
      </div>
    </div>
  )
}
