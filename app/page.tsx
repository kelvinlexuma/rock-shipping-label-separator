'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type AppState = 'idle' | 'dragging' | 'ready' | 'processing' | 'success' | 'error'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null)
  const [state, setState] = useState<AppState>('idle')
  const [toast, setToast] = useState('')
  const [pageCount, setPageCount] = useState(0)
  const [driveUrl, setDriveUrl] = useState('')
  const [zipBlob, setZipBlob] = useState<{ blob: Blob; filename: string } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [logoFailed, setLogoFailed] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

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

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' })
    router.push('/login')
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
      const blob = await res.blob()
      setPageCount(count)
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
  }

  const isDragging = state === 'dragging'
  const isProcessing = state === 'processing'
  const isSuccess = state === 'success'
  const isError = state === 'error'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Barlow+Condensed:ital,wght@0,300;0,400;0,600;0,700;1,300&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .app-root {
          font-family: 'Barlow Condensed', sans-serif;
          min-height: 100vh;
          background: #080d18;
          background-image:
            repeating-linear-gradient(0deg,  transparent, transparent 59px, rgba(220,38,38,0.04) 59px, rgba(220,38,38,0.04) 60px),
            repeating-linear-gradient(90deg, transparent, transparent 59px, rgba(220,38,38,0.04) 59px, rgba(220,38,38,0.04) 60px);
          display: flex;
          flex-direction: column;
        }

        /* ── Header ── */
        .app-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 32px;
          height: 68px;
          background: #0c1220;
          border-bottom: 1px solid rgba(220,38,38,0.18);
          border-top: 3px solid #dc2626;
          position: sticky;
          top: 0;
          z-index: 10;
          box-shadow: 0 4px 24px rgba(0,0,0,0.5);
          gap: 20px;
        }

        .header-brand {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-shrink: 0;
        }
        .header-logo-img {
          height: 36px;
          width: auto;
          object-fit: contain;
          filter: invert(1) hue-rotate(180deg);
          display: block;
        }
        .header-logo-fallback {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .header-re-badge {
          background: #dc2626;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 16px;
          color: #fff;
          letter-spacing: 0.04em;
          flex-shrink: 0;
        }
        .header-brand-text {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .header-brand-name {
          font-size: 20px;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: #f1f5f9;
          text-transform: uppercase;
          line-height: 1;
        }
        .header-brand-sub {
          font-size: 14px;
          font-weight: 400;
          font-style: italic;
          letter-spacing: 0.12em;
          color: #7a8fa8;
          text-transform: uppercase;
        }

        .header-divider {
          width: 1px;
          height: 28px;
          background: rgba(220,38,38,0.2);
          flex-shrink: 0;
        }

        .header-title-block {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .header-title {
          font-size: 23px;
          font-weight: 700;
          letter-spacing: 0.12em;
          color: #e2e8f0;
          text-transform: uppercase;
          line-height: 1;
        }
        .header-title-sub {
          font-family: 'Share Tech Mono', monospace;
          font-size: 13px;
          color: #64748b;
          letter-spacing: 0.2em;
          text-transform: uppercase;
        }

        .header-right { flex: 1; display: flex; justify-content: flex-end; }

        .logout-btn {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: #94a3b8;
          background: transparent;
          border: 1px solid rgba(220,38,38,0.3);
          padding: 9px 20px;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .logout-btn:hover {
          color: #fca5a5;
          border-color: #dc2626;
          background: rgba(220,38,38,0.08);
          box-shadow: 0 0 12px rgba(220,38,38,0.2);
        }

        /* ── Main ── */
        .app-main {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
        }

        .content-panel {
          width: 100%;
          max-width: 600px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .panel-heading {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .panel-heading-line { height: 1px; flex: 1; background: rgba(220,38,38,0.2); }
        .panel-heading-text {
          font-family: 'Share Tech Mono', monospace;
          font-size: 15px;
          letter-spacing: 0.28em;
          color: #dc2626;
          text-transform: uppercase;
          white-space: nowrap;
        }

        /* ── Drop zone ── */
        .drop-zone {
          position: relative;
          background: rgba(12,18,32,0.9);
          border: 2px dashed rgba(100,116,139,0.22);
          min-height: 240px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
          gap: 14px;
          padding: 48px 36px;
          text-align: center;
          outline: none;
        }
        .drop-zone:focus-visible { outline: 2px solid #dc2626; outline-offset: 2px; }
        .drop-zone.dragging {
          border-color: #dc2626;
          border-style: solid;
          background: rgba(220,38,38,0.04);
          box-shadow: 0 0 40px rgba(220,38,38,0.1) inset, 0 0 0 1px rgba(220,38,38,0.2) inset;
        }

        .zone-icon {
          width: 64px; height: 64px;
          color: #2d3f52;
          transition: color 0.25s, transform 0.25s;
        }
        .drop-zone.dragging .zone-icon { color: #dc2626; transform: translateY(-4px); }

        .zone-main-text {
          font-size: 26px;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: #94a3b8;
          text-transform: uppercase;
          line-height: 1.2;
        }
        .drop-zone.dragging .zone-main-text { color: #e2e8f0; }

        .zone-sub-text {
          font-size: 18px;
          font-weight: 400;
          color: #4d6278;
          letter-spacing: 0.06em;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: center;
        }
        .zone-browse {
          color: #dc2626;
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 3px;
          font-weight: 700;
          background: none;
          border: none;
          font-family: inherit;
          font-size: inherit;
          letter-spacing: inherit;
          padding: 0;
          transition: color 0.15s;
        }
        .zone-browse:hover { color: #f87171; }

        .zone-hint {
          font-family: 'Share Tech Mono', monospace;
          font-size: 13px;
          color: #4d6278;
          letter-spacing: 0.1em;
        }

        /* ── File chip ── */
        .file-chip {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(220,38,38,0.07);
          border: 1px solid rgba(220,38,38,0.22);
          padding: 14px 20px;
          width: 100%;
          max-width: 100%;
        }
        .file-chip-name {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-family: 'Share Tech Mono', monospace;
          font-size: 14px;
          color: #f1f5f9;
        }
        .file-chip-size {
          font-family: 'Share Tech Mono', monospace;
          font-size: 13px;
          color: #64748b;
          white-space: nowrap;
        }
        .file-chip-remove {
          background: none;
          border: none;
          color: #475569;
          cursor: pointer;
          padding: 0;
          line-height: 1;
          font-size: 22px;
          transition: color 0.15s;
        }
        .file-chip-remove:hover { color: #dc2626; }

        /* ── Convert button ── */
        .convert-btn {
          width: 100%;
          padding: 20px;
          background: #dc2626;
          color: #fff;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 22px;
          font-weight: 700;
          letter-spacing: 0.36em;
          text-transform: uppercase;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          transition: background 0.2s, box-shadow 0.2s, letter-spacing 0.2s;
          position: relative;
          overflow: hidden;
        }
        .convert-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 60%);
          pointer-events: none;
        }
        .convert-btn:hover:not(:disabled) {
          background: #b91c1c;
          box-shadow: 0 0 36px rgba(220,38,38,0.5), 0 6px 20px rgba(0,0,0,0.4);
          letter-spacing: 0.44em;
        }
        .convert-btn:disabled {
          background: #141e2e;
          color: #2d3f52;
          cursor: not-allowed;
        }

        /* ── Status cards ── */
        .status-card {
          border-left: 3px solid;
          padding: 22px 26px;
          background: rgba(12,18,32,0.95);
          display: flex;
          align-items: flex-start;
          gap: 18px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }
        .status-card.processing { border-color: #f59e0b; }
        .status-card.success    { border-color: #22c55e; }
        .status-card.error      { border-color: #dc2626; }

        .status-icon { flex-shrink: 0; margin-top: 3px; }
        .status-body { flex: 1; }

        .status-title {
          font-size: 22px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 6px;
          line-height: 1.1;
        }
        .status-card.processing .status-title { color: #fbbf24; }
        .status-card.success    .status-title { color: #4ade80; }
        .status-card.error      .status-title { color: #fca5a5; }

        .status-sub {
          font-family: 'Share Tech Mono', monospace;
          font-size: 14px;
          color: #64748b;
          margin-bottom: 16px;
          line-height: 1.5;
        }

        .action-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .download-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          background: #22c55e;
          color: #052e16;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 18px;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }
        .download-btn:hover {
          background: #4ade80;
          box-shadow: 0 0 20px rgba(34,197,94,0.45);
        }

        .reset-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          background: transparent;
          color: #7a8fa8;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 17px;
          font-weight: 600;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          border: 1px solid rgba(100,116,139,0.25);
          cursor: pointer;
          transition: all 0.2s;
        }
        .reset-btn:hover { color: #94a3b8; border-color: rgba(100,116,139,0.5); }

        .drive-note {
          font-family: 'Share Tech Mono', monospace;
          font-size: 13px;
          color: #4d6278;
          letter-spacing: 0.1em;
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 8px;
        }
        .drive-note::before { content: '▸'; color: #22c55e; font-size: 10px; }

        /* ── Spinner ── */
        .spin-ring {
          width: 22px; height: 22px;
          border: 2.5px solid rgba(251,191,36,0.2);
          border-top-color: #fbbf24;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }
        .spin-ring-sm {
          width: 20px; height: 20px;
          border: 2px solid rgba(255,255,255,0.25);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Toast ── */
        .toast {
          position: fixed;
          bottom: 28px;
          right: 28px;
          background: #0c1220;
          border: 1px solid #dc2626;
          border-left: 3px solid #dc2626;
          padding: 14px 20px;
          font-family: 'Share Tech Mono', monospace;
          font-size: 13px;
          color: #fca5a5;
          letter-spacing: 0.06em;
          z-index: 100;
          animation: toastIn 0.2s ease;
          max-width: 320px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {toast && <div className="toast">{toast}</div>}

      <div className="app-root">
        <header className="app-header">
          <div className="header-brand">
            {!logoFailed ? (
              <img
                className="header-logo-img"
                src="/rock-logo.png"
                alt="Rock Enterprise"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <div className="header-logo-fallback">
                <div className="header-re-badge">RE</div>
              </div>
            )}
            <div className="header-brand-text">
              <div className="header-brand-name">Rock Enterprise</div>
              <div className="header-brand-sub">Co. Ltd.</div>
            </div>
          </div>

          <div className="header-divider" />

          <div className="header-title-block">
            <div className="header-title">Shipping Label Separator</div>
            <div className="header-title-sub">Internal Operations Tool</div>
          </div>

          <div className="header-right">
            <button className="logout-btn" onClick={handleLogout}>Logout</button>
          </div>
        </header>

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
