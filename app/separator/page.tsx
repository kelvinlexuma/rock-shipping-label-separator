'use client'

import { useState, useRef, useCallback } from 'react'
import RockHeader from '../components/RockHeader'
import { ROCK_BASE_CSS } from '../components/rock-styles'

type AppState = 'idle' | 'dragging' | 'ready' | 'processing' | 'success' | 'error'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export default function SeparatorPage() {
  const [file, setFile] = useState<File | null>(null)
  const [state, setState] = useState<AppState>('idle')
  const [toast, setToast] = useState('')
  const [pageCount, setPageCount] = useState(0)
  const [filenames, setFilenames] = useState<string[]>([])
  const [driveUrl, setDriveUrl] = useState('')
  const [zipBlob, setZipBlob] = useState<{ blob: Blob; filename: string } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function acceptFile(f: File) {
    if (f.type !== 'application/pdf') { showToast('Only PDF files are accepted.'); return }
    setFile(f)
    setState('ready')
    setZipBlob(null)
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
    setZipBlob(null)
    setErrorMsg('')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/convert', { method: 'POST', body: form })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Conversion failed' }))
        throw new Error(body.error || 'Conversion failed')
      }
      const count = parseInt(res.headers.get('X-Page-Count') || '0', 10)
      const driveLink = res.headers.get('X-Drive-Url') || ''
      const disposition = res.headers.get('Content-Disposition') || ''
      const nameMatch = disposition.match(/filename="(.+?)"/)
      const filename = nameMatch?.[1] || 'labels.zip'

      // Decode the output filename list (base64 JSON) for the preview
      let names: string[] = []
      try {
        const b64 = res.headers.get('X-Filenames')
        if (b64) names = JSON.parse(decodeURIComponent(escape(atob(b64))))
      } catch { /* preview is best-effort */ }

      const blob = await res.blob()
      setPageCount(count)
      setFilenames(names)
      setDriveUrl(driveLink)
      setZipBlob({ blob, filename })
      setState('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
      setState('error')
    }
  }

  function triggerDownload() {
    if (!zipBlob) return
    const url = URL.createObjectURL(zipBlob.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = zipBlob.filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function reset() {
    setFile(null)
    setState('idle')
    setZipBlob(null)
    setErrorMsg('')
    setFilenames([])
  }

  // Split a filename into its barcode stem and the .pdf extension for styling.
  // Flags fallback page_N names (where no barcode could be read) so they stand out.
  function nameParts(name: string) {
    const stem = name.replace(/\.pdf$/i, '')
    const isFallback = /^page_\d+$/i.test(stem)
    return { stem, isFallback }
  }

  const isDragging = state === 'dragging'
  const isProcessing = state === 'processing'
  const isSuccess = state === 'success'
  const isError = state === 'error'

  return (
    <>
      <style>{ROCK_BASE_CSS}</style>
      <style>{`
        /* ── Output files preview ── */
        .files-panel {
          background: rgba(12,18,32,0.95);
          border: 1px solid rgba(100,116,139,0.14);
          border-top: 2px solid rgba(34,197,94,0.5);
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }

        .files-head {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 22px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .files-head-label {
          font-family: 'Share Tech Mono', monospace;
          font-size: 13px;
          letter-spacing: 0.22em;
          color: #cbd5e1;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .files-count {
          font-family: 'Share Tech Mono', monospace;
          font-size: 12px;
          font-weight: 700;
          color: #4ade80;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.3);
          padding: 2px 9px;
          line-height: 1.4;
          white-space: nowrap;
        }
        .files-head-rule { flex: 1; height: 1px; background: rgba(100,116,139,0.15); }
        .files-head-hint {
          font-family: 'Share Tech Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.14em;
          color: #475569;
          text-transform: uppercase;
          white-space: nowrap;
        }

        /* No inner scroll — the list flows in the normal page scroll so there's
           only ever one scrollbar (a nested scroll area traps wheel/touch on
           both desktop and mobile). */
        .files-list {
          list-style: none;
          margin: 0;
          padding: 8px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2px;
        }

        .file-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          background: rgba(255,255,255,0.012);
          border-left: 2px solid transparent;
          transition: background 0.12s, border-color 0.12s;
          min-width: 0;
        }
        .file-row:hover {
          background: rgba(34,197,94,0.06);
          border-left-color: rgba(34,197,94,0.6);
        }
        .file-row.fallback {
          border-left-color: rgba(245,158,11,0.5);
          background: rgba(245,158,11,0.05);
        }

        .file-idx {
          font-family: 'Share Tech Mono', monospace;
          font-size: 12px;
          color: #475569;
          flex-shrink: 0;
          width: 22px;
        }
        .file-glyph { color: #4ade80; flex-shrink: 0; }
        .file-row.fallback .file-glyph { color: #fbbf24; }

        .file-name {
          font-family: 'Share Tech Mono', monospace;
          font-size: 14px;
          letter-spacing: 0.01em;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          min-width: 0;
          flex: 1;
        }
        .file-stem { color: #e2e8f0; }
        .file-ext { color: #475569; }

        .file-tag {
          font-family: 'Share Tech Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.08em;
          color: #fbbf24;
          background: rgba(245,158,11,0.1);
          border: 1px solid rgba(245,158,11,0.25);
          padding: 1px 6px;
          text-transform: uppercase;
          white-space: nowrap;
          flex-shrink: 0;
        }

        @media (max-width: 640px) {
          .files-list { grid-template-columns: 1fr; }
          .files-head { padding: 14px 16px; gap: 10px; }
          .files-head-hint { display: none; }
        }
      `}</style>

      {toast && <div className="toast">{toast}</div>}

      <div className="app-root">
        <RockHeader title="Shipping Label Separator" backLink />

        <main className="app-main">
          <div className="content-panel">
            <div className="panel-heading">
              <span className="panel-heading-line" />
              <span className="panel-heading-text">Upload PDF</span>
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
                    {isDragging ? 'Release to Upload' : 'Drag & Drop PDF Here'}
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
                  <div className="zone-hint">Accepts PDF only · Multi-page supported</div>
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
              accept=".pdf,application/pdf"
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
                  <div className="status-sub">Splitting pages and extracting barcodes…</div>
                </div>
              </div>
            )}

            {isSuccess && (
              <div className="status-card success">
                <span className="status-icon">
                  <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="#4ade80" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                </span>
                <div className="status-body">
                  <div className="status-title">Done — {pageCount} label{pageCount !== 1 ? 's' : ''} converted</div>
                  <div className="status-sub">ZIP ready · files named by barcode tracking number</div>
                  <div className="action-row">
                    <button className="download-btn" onClick={triggerDownload}>
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      Download ZIP
                    </button>
                    <button className="reset-btn" onClick={reset}>Convert another</button>
                  </div>
                  {driveUrl
                    ? <div className="drive-note">Also saved to Google Drive</div>
                    : <div className="drive-note" style={{ color: '#334155' }}>Drive backup unavailable</div>
                  }
                </div>
              </div>
            )}

            {isSuccess && filenames.length > 0 && (
              <div className="files-panel">
                <div className="files-head">
                  <span className="files-head-label">Output Files</span>
                  <span className="files-count">{filenames.length}</span>
                  <span className="files-head-rule" />
                  <span className="files-head-hint">named by barcode</span>
                </div>
                <ol className="files-list">
                  {filenames.map((name, i) => {
                    const { stem, isFallback } = nameParts(name)
                    return (
                      <li key={i} className={`file-row${isFallback ? ' fallback' : ''}`}>
                        <span className="file-idx">{String(i + 1).padStart(2, '0')}</span>
                        <svg className="file-glyph" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                        </svg>
                        <span className="file-name">
                          <span className="file-stem">{stem}</span>
                          <span className="file-ext">.pdf</span>
                        </span>
                        {isFallback && <span className="file-tag">no barcode</span>}
                      </li>
                    )
                  })}
                </ol>
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
