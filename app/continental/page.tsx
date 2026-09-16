'use client'

import { useState, useRef, useCallback } from 'react'
import RockHeader from '../components/RockHeader'
import { ROCK_BASE_CSS } from '../components/rock-styles'
import type { ContinentalOrder } from '@/lib/continental'

type AppState = 'idle' | 'dragging' | 'ready' | 'processing' | 'success' | 'error'

interface Result {
  filename: string
  blob: Blob
  orders: ContinentalOrder[]
  warnings: string[]
  sourceRowCount: number
  driveSaved: boolean
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function base64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}

export default function ContinentalPage() {
  const [file, setFile] = useState<File | null>(null)
  const [state, setState] = useState<AppState>('idle')
  const [toast, setToast] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function acceptFile(f: File) {
    if (!/\.csv$/i.test(f.name)) { showToast('Only CSV files are accepted.'); return }
    setFile(f)
    setState('ready')
    setResult(null)
    setErrorMsg('')
  }

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setState(s => (s === 'ready' || s === 'processing' || s === 'success' || s === 'error' ? s : 'dragging'))
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setState(s => (s === 'dragging' ? 'idle' : s))
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const dropped = e.dataTransfer.files[0]
    if (dropped) acceptFile(dropped)
  }, []) // eslint-disable-line

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    if (picked) acceptFile(picked)
    e.target.value = ''
  }

  async function handleConvert() {
    if (!file || state === 'processing') return
    setState('processing')
    setResult(null)
    setErrorMsg('')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/continental', { method: 'POST', body: form })
      const body = await res.json().catch(() => ({ error: 'Conversion failed' }))
      if (!res.ok) throw new Error(body.error || 'Conversion failed')

      setResult({
        filename: body.filename,
        blob: base64ToBlob(body.xlsxBase64, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
        orders: body.orders,
        warnings: body.warnings,
        sourceRowCount: body.sourceRowCount,
        driveSaved: body.driveSaved,
      })
      setState('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
      setState('error')
    }
  }

  function triggerDownload() {
    if (!result) return
    const url = URL.createObjectURL(result.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = result.filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function reset() {
    setFile(null)
    setState('idle')
    setResult(null)
    setErrorMsg('')
  }

  const isDragging = state === 'dragging'
  const isProcessing = state === 'processing'
  const isSuccess = state === 'success'
  const isError = state === 'error'
  const flaggedCount = result ? result.orders.filter(o => o.warnings.length).length + result.warnings.length : 0

  return (
    <>
      <style>{ROCK_BASE_CSS}</style>
      <style>{`
        /* Wider panel once the preview table is showing */
        .content-panel.wide { max-width: 1240px; }

        .warn-card {
          border-left: 3px solid #f59e0b;
          background: rgba(245,158,11,0.06);
          padding: 16px 22px;
          font-family: 'Share Tech Mono', monospace;
          font-size: 14px;
          color: #fbbf24;
          line-height: 1.6;
        }
        .warn-card ul { list-style: none; margin-top: 6px; }
        .warn-card li { color: #fcd34d; }
        .warn-card li::before { content: '▸ '; color: #f59e0b; }

        .preview-panel {
          background: rgba(12,18,32,0.95);
          border: 1px solid rgba(100,116,139,0.14);
          border-top: 2px solid rgba(34,197,94,0.5);
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }
        .preview-head {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 22px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .preview-head-label {
          font-family: 'Share Tech Mono', monospace;
          font-size: 13px;
          letter-spacing: 0.22em;
          color: #cbd5e1;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .preview-count {
          font-family: 'Share Tech Mono', monospace;
          font-size: 12px;
          font-weight: 700;
          color: #4ade80;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.3);
          padding: 2px 9px;
        }
        .preview-rule { flex: 1; height: 1px; background: rgba(100,116,139,0.15); }

        /* Only the table scrolls sideways; the page never does. */
        .preview-scroll { overflow-x: auto; }
        .preview-table {
          width: 100%;
          border-collapse: collapse;
          font-family: 'Share Tech Mono', monospace;
          font-size: 13px;
          color: #cbd5e1;
        }
        .preview-table th {
          text-align: left;
          font-weight: 400;
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #64748b;
          padding: 10px 12px;
          border-bottom: 1px solid rgba(100,116,139,0.15);
          white-space: nowrap;
        }
        .preview-table td {
          padding: 9px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.03);
          vertical-align: top;
          white-space: nowrap;
        }
        .preview-table td.wrap { white-space: normal; min-width: 140px; }
        .preview-table td.num { text-align: right; }
        .preview-table tr.flagged td { background: rgba(245,158,11,0.06); }
        .preview-table tr.flagged td:first-child { box-shadow: inset 2px 0 0 #f59e0b; }
        .muted { color: #64748b; }
        .row-warn {
          display: block;
          margin-top: 4px;
          font-size: 11px;
          color: #fbbf24;
          white-space: normal;
        }
      `}</style>

      {toast && <div className="toast">{toast}</div>}

      <div className="app-root">
        <RockHeader title="Continental Converter" backLink />

        <main className="app-main">
          <div className={`content-panel${isSuccess ? ' wide' : ''}`}>
            <div className="panel-heading">
              <span className="panel-heading-line" />
              <span className="panel-heading-text">Upload ECang CSV</span>
              <span className="panel-heading-line" />
            </div>

            <div
              className={`drop-zone${isDragging ? ' dragging' : ''}`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => !file && fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && !file && fileInputRef.current?.click()}
            >
              {!file ? (
                <>
                  <svg className="zone-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
                  </svg>
                  <div className="zone-main-text">
                    {isDragging ? 'Release to Upload' : 'Drag & Drop CSV Here'}
                  </div>
                  <div className="zone-sub-text">
                    — or —
                    <button
                      className="zone-browse"
                      type="button"
                      onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}
                    >
                      Browse file
                    </button>
                  </div>
                  <div className="zone-hint">ECang &quot;Continental Label&quot; export · CSV only</div>
                </>
              ) : (
                <div className="file-chip" onClick={e => e.stopPropagation()}>
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#dc2626" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                  <span className="file-chip-name">{file.name}</span>
                  <span className="file-chip-size">{formatBytes(file.size)}</span>
                  <button
                    className="file-chip-remove"
                    onClick={e => { e.stopPropagation(); reset() }}
                    title="Remove file"
                  >×</button>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={onFileInput}
            />

            <button
              className="convert-btn"
              onClick={handleConvert}
              disabled={!file || isProcessing || isSuccess}
            >
              {isProcessing
                ? <><span className="spin-ring-sm" />Converting…</>
                : 'Convert'
              }
            </button>

            {isProcessing && (
              <div className="status-card processing">
                <span className="status-icon spin-ring" />
                <div className="status-body">
                  <div className="status-title">Processing</div>
                  <div className="status-sub">Merging orders and building the Continental sheet…</div>
                </div>
              </div>
            )}

            {isSuccess && result && (
              <div className="status-card success">
                <span className="status-icon">
                  <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="#4ade80" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                </span>
                <div className="status-body">
                  <div className="status-title">
                    Done — {result.orders.length} order{result.orders.length !== 1 ? 's' : ''}
                  </div>
                  <div className="status-sub">
                    {result.filename} · from {result.sourceRowCount} ECang row{result.sourceRowCount !== 1 ? 's' : ''}
                  </div>
                  <div className="action-row">
                    <button className="download-btn" onClick={triggerDownload}>
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      Download XLSX
                    </button>
                    <button className="reset-btn" onClick={reset}>Convert another</button>
                  </div>
                  {result.driveSaved
                    ? <div className="drive-note">Also saved to Google Drive (Continental folder)</div>
                    : <div className="drive-note" style={{ color: '#334155' }}>Drive backup unavailable</div>
                  }
                </div>
              </div>
            )}

            {isSuccess && result && flaggedCount > 0 && (
              <div className="warn-card">
                {flaggedCount} item{flaggedCount !== 1 ? 's' : ''} need checking before upload
                {result.warnings.length > 0 && (
                  <ul>{result.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                )}
              </div>
            )}

            {isSuccess && result && (
              <div className="preview-panel">
                <div className="preview-head">
                  <span className="preview-head-label">Output Preview</span>
                  <span className="preview-count">{result.orders.length}</span>
                  <span className="preview-rule" />
                </div>
                <div className="preview-scroll">
                  <table className="preview-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Order no.</th>
                        <th>Buyer</th>
                        <th>Country</th>
                        <th>Zip</th>
                        <th>Phone</th>
                        <th>SKU</th>
                        <th>Product type</th>
                        <th>HS code</th>
                        <th>Origin</th>
                        <th>Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.orders.map((o, i) => (
                        <tr key={o.orderNo} className={o.warnings.length ? 'flagged' : ''}>
                          <td className="muted">{String(i + 1).padStart(2, '0')}</td>
                          <td>{o.orderNo}</td>
                          <td className="wrap">
                            {o.buyerFullname}
                            {o.warnings.length > 0 && <span className="row-warn">⚠ {o.warnings.join(' · ')}</span>}
                          </td>
                          <td>{o.country}</td>
                          <td>{o.zip}</td>
                          <td>{o.phone}</td>
                          <td className="wrap">{o.sku}</td>
                          <td>{o.productType}</td>
                          <td>{o.hsCode}</td>
                          <td>{o.countryOfOrigin || <span className="muted">—</span>}</td>
                          <td className="num">{o.cost ?? <span className="muted">—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {isError && (
              <div className="status-card error">
                <span className="status-icon">
                  <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="#fca5a5" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                  </svg>
                </span>
                <div className="status-body">
                  <div className="status-title">Conversion Failed</div>
                  <div className="status-sub">{errorMsg || 'An unexpected error occurred.'}</div>
                  <button className="reset-btn" onClick={reset}>Try again</button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  )
}
