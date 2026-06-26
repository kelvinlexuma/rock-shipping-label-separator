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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function acceptFile(f: File) {
    if (f.type !== 'application/pdf') {
      showToast('Only PDF files are accepted.')
      return
    }
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

  const isDropZoneActive = state === 'dragging'
  const isProcessing = state === 'processing'
  const isSuccess = state === 'success'
  const isError = state === 'error'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Barlow+Condensed:wght@300;400;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; }

        .app-root {
          font-family: 'Barlow Condensed', sans-serif;
          min-height: 100vh;
          background: #0a0f1a;
          background-image:
            repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(220,38,38,0.04) 39px,rgba(220,38,38,0.04) 40px),
            repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(220,38,38,0.04) 39px,rgba(220,38,38,0.04) 40px);
          display: flex;
          flex-direction: column;
        }

        .app-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 28px;
          height: 60px;
          background: #0f1624;
          border-bottom: 1px solid rgba(220,38,38,0.2);
          border-top: 2px solid #dc2626;
          position: sticky;
          top: 0;
          z-index: 10;
          box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        }

        .header-logo {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .header-logo img {
          height: 30px;
          object-fit: contain;
          filter: brightness(0) invert(1);
        }
        .header-logo-text {
          font-size: 20px;
          font-weight: 700;
          color: #fff;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .header-logo-text-hidden { display: none; }

        .header-title {
          font-family: 'Share Tech Mono', monospace;
          font-size: 12px;
          letter-spacing: 0.2em;
          color: #64748b;
          text-transform: uppercase;
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
        }

        .logout-btn {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #94a3b8;
          background: transparent;
          border: 1px solid rgba(220,38,38,0.3);
          padding: 7px 16px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .logout-btn:hover {
          color: #fca5a5;
          border-color: #dc2626;
          background: rgba(220,38,38,0.08);
        }

        .app-main {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
        }

        .content-panel {
          width: 100%;
          max-width: 560px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .panel-label {
          font-family: 'Share Tech Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.25em;
          color: #dc2626;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .panel-label::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(220,38,38,0.2);
        }

        .drop-zone {
          position: relative;
          background: rgba(15,22,36,0.8);
          border: 2px dashed rgba(100,116,139,0.25);
          min-height: 220px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
          gap: 12px;
          padding: 40px 32px;
          text-align: center;
          outline: none;
        }
        .drop-zone:focus-visible { outline: 2px solid #dc2626; outline-offset: 2px; }
        .drop-zone.dragging {
          border-color: #dc2626;
          background: rgba(220,38,38,0.04);
          box-shadow: 0 0 30px rgba(220,38,38,0.1) inset;
        }
        .drop-zone.has-file {
          border-color: rgba(100,116,139,0.4);
          background: rgba(15,22,36,0.9);
        }
        .drop-zone.no-file { cursor: pointer; }

        .zone-icon {
          width: 48px;
          height: 48px;
          color: #334155;
          transition: color 0.2s;
        }
        .drop-zone.dragging .zone-icon { color: #dc2626; }

        .zone-text-primary {
          font-size: 18px;
          font-weight: 600;
          letter-spacing: 0.06em;
          color: #94a3b8;
          text-transform: uppercase;
        }
        .zone-text-secondary {
          font-size: 14px;
          font-weight: 400;
          color: #475569;
          letter-spacing: 0.05em;
        }
        .zone-browse {
          color: #dc2626;
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 3px;
          font-weight: 600;
          background: none;
          border: none;
          font-family: inherit;
          font-size: inherit;
          letter-spacing: inherit;
          padding: 0;
        }
        .zone-browse:hover { color: #f87171; }

        .file-chip {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(220,38,38,0.08);
          border: 1px solid rgba(220,38,38,0.25);
          padding: 10px 16px;
          font-family: 'Share Tech Mono', monospace;
          font-size: 12px;
          color: #e2e8f0;
          max-width: 100%;
          width: 100%;
        }
        .file-chip-name {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #f8fafc;
        }
        .file-chip-size { color: #64748b; white-space: nowrap; }
        .file-chip-remove {
          background: none;
          border: none;
          color: #64748b;
          cursor: pointer;
          padding: 0;
          line-height: 1;
          font-size: 18px;
          transition: color 0.15s;
        }
        .file-chip-remove:hover { color: #dc2626; }

        .convert-btn {
          width: 100%;
          padding: 16px;
          background: #dc2626;
          color: #fff;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 17px;
          font-weight: 700;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: background 0.2s, box-shadow 0.2s, letter-spacing 0.2s;
        }
        .convert-btn:hover:not(:disabled) {
          background: #b91c1c;
          box-shadow: 0 0 24px rgba(220,38,38,0.45);
          letter-spacing: 0.35em;
        }
        .convert-btn:disabled {
          background: #1e293b;
          color: #334155;
          cursor: not-allowed;
        }

        .status-card {
          border-left: 3px solid;
          padding: 20px 24px;
          background: rgba(15,22,36,0.9);
          display: flex;
          align-items: flex-start;
          gap: 16px;
        }
        .status-card.processing { border-color: #f59e0b; }
        .status-card.success { border-color: #22c55e; }
        .status-card.error { border-color: #dc2626; }

        .status-icon { flex-shrink: 0; margin-top: 2px; }
        .status-body { flex: 1; }

        .status-title {
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .status-card.processing .status-title { color: #fbbf24; }
        .status-card.success .status-title { color: #4ade80; }
        .status-card.error .status-title { color: #fca5a5; }

        .status-sub {
          font-family: 'Share Tech Mono', monospace;
          font-size: 12px;
          color: #64748b;
          margin-bottom: 14px;
        }

        .download-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: #22c55e;
          color: #052e16;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          margin-right: 12px;
          margin-bottom: 10px;
        }
        .download-btn:hover {
          background: #4ade80;
          box-shadow: 0 0 16px rgba(34,197,94,0.4);
        }

        .reset-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: transparent;
          color: #64748b;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          border: 1px solid rgba(100,116,139,0.25);
          cursor: pointer;
          transition: all 0.2s;
          margin-bottom: 10px;
        }
        .reset-btn:hover {
          color: #94a3b8;
          border-color: rgba(100,116,139,0.5);
        }

        .drive-note {
          font-family: 'Share Tech Mono', monospace;
          font-size: 10px;
          color: #334155;
          letter-spacing: 0.1em;
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 4px;
        }
        .drive-note::before { content: '▸'; color: #22c55e; font-size: 8px; }

        .spin-ring {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(251,191,36,0.2);
          border-top-color: #fbbf24;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .toast {
          position: fixed;
          bottom: 28px;
          right: 28px;
          background: #0f1624;
          border: 1px solid #dc2626;
          border-left: 3px solid #dc2626;
          padding: 12px 18px;
          font-family: 'Share Tech Mono', monospace;
          font-size: 12px;
          color: #fca5a5;
          letter-spacing: 0.08em;
          z-index: 100;
          animation: toastIn 0.2s ease;
          max-width: 300px;
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {toast && <div className="toast">{toast}</div>}

      <div className="app-root">
        <header className="app-header">
          <div className="header-logo">
            <img
              src="/rock-logo.png"
              alt="Rock Enterprise"
              onError={e => {
                const t = e.currentTarget
                t.style.display = 'none'
                const fb = t.nextElementSibling as HTMLElement
                if (fb) fb.style.display = 'block'
              }}
            />
            <span className="header-logo-text header-logo-text-hidden">ROCK</span>
          </div>
          <div className="header-title">Shipping Label Separator</div>
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </header>

        <main className="app-main">
          <div className="content-panel">
            <div className="panel-label">Upload PDF</div>

            <div
              className={`drop-zone${isDropZoneActive ? ' dragging' : ''}${file ? ' has-file' : ' no-file'}`}
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
                  <svg className="zone-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
                  </svg>
                  <div className="zone-text-primary">
                    {isDropZoneActive ? 'Release to upload' : 'Drag & drop PDF here'}
                  </div>
                  <div className="zone-text-secondary">
                    — or —&nbsp;
                    <button
                      className="zone-browse"
                      type="button"
                      onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}
                    >
                      Browse file
                    </button>
                  </div>
                </>
              ) : (
                <div className="file-chip" onClick={e => e.stopPropagation()}>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#dc2626" strokeWidth={2}>
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
              {isProcessing ? (
                <>
                  <span className="spin-ring" />
                  Converting…
                </>
              ) : 'Convert'}
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
                  <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#4ade80" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                </span>
                <div className="status-body">
                  <div className="status-title">Done — {pageCount} label{pageCount !== 1 ? 's' : ''} converted</div>
                  <div className="status-sub">ZIP ready · files named by barcode</div>
                  <div>
                    <button className="download-btn" onClick={triggerDownload}>
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      Download ZIP
                    </button>
                    <button className="reset-btn" onClick={reset}>Convert another</button>
                  </div>
                  {driveUrl
                    ? <div className="drive-note">Saved to Google Drive</div>
                    : <div className="drive-note" style={{ color: '#4b5563' }}>Drive backup unavailable</div>
                  }
                </div>
              </div>
            )}

            {isError && (
              <div className="status-card error">
                <span className="status-icon">
                  <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#fca5a5" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                  </svg>
                </span>
                <div className="status-body">
                  <div className="status-title">Conversion failed</div>
                  <div className="status-sub">{errorMsg || 'An unexpected error occurred.'}</div>
                  <button className="reset-btn" style={{ marginTop: 4 }} onClick={reset}>Try again</button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  )
}
