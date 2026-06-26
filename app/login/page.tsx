'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (res.ok) {
        router.push('/')
      } else {
        setError('Invalid credentials. Access denied.')
        setLoading(false)
      }
    } catch {
      setError('Connection error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Barlow+Condensed:ital,wght@0,300;0,400;0,600;0,700;1,300&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .login-root {
          font-family: 'Barlow Condensed', sans-serif;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #080d18;
          background-image:
            radial-gradient(ellipse 90% 50% at 50% -5%, rgba(220,38,38,0.14) 0%, transparent 65%),
            repeating-linear-gradient(0deg,   transparent, transparent 59px, rgba(220,38,38,0.04) 59px, rgba(220,38,38,0.04) 60px),
            repeating-linear-gradient(90deg,  transparent, transparent 59px, rgba(220,38,38,0.04) 59px, rgba(220,38,38,0.04) 60px);
          padding: 32px 20px;
        }

        .login-card {
          width: 100%;
          max-width: 460px;
          background: #0c1220;
          border: 1px solid rgba(220,38,38,0.18);
          border-top: 3px solid #dc2626;
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.02) inset,
            0 0 80px rgba(220,38,38,0.07),
            0 32px 80px rgba(0,0,0,0.75);
        }

        .card-eyebrow {
          display: flex;
          align-items: center;
          padding: 16px 32px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          gap: 14px;
        }
        .eyebrow-line { height: 1px; flex: 1; background: rgba(220,38,38,0.2); }
        .eyebrow-text {
          font-family: 'Share Tech Mono', monospace;
          font-size: 13px;
          color: #dc2626;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .card-logo-section {
          padding: 40px 40px 28px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
        }

        .logo-img {
          height: 56px;
          width: auto;
          object-fit: contain;
          filter: invert(1) hue-rotate(180deg);
          display: block;
        }

        .logo-fallback-block {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .re-badge {
          background: #dc2626;
          width: 54px;
          height: 54px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 24px;
          color: #fff;
          letter-spacing: 0.04em;
          flex-shrink: 0;
        }
        .fallback-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .fallback-name {
          font-size: 26px;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: #f1f5f9;
          text-transform: uppercase;
          line-height: 1;
        }
        .fallback-sub {
          font-size: 14px;
          font-weight: 300;
          font-style: italic;
          letter-spacing: 0.14em;
          color: #64748b;
          text-transform: uppercase;
        }

        .app-name-block { text-align: center; margin-top: 8px; }
        .app-name {
          font-size: 34px;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: #f1f5f9;
          text-transform: uppercase;
          line-height: 1.1;
        }
        .app-tag {
          font-family: 'Share Tech Mono', monospace;
          font-size: 13px;
          color: #dc2626;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          margin-top: 8px;
        }

        .card-divider {
          margin: 8px 40px 0;
          height: 1px;
          background: linear-gradient(90deg, transparent 0%, rgba(220,38,38,0.3) 50%, transparent 100%);
        }

        .card-body { padding: 30px 40px 40px; }

        .field-group { margin-bottom: 22px; }

        .field-label {
          font-family: 'Share Tech Mono', monospace;
          font-size: 13px;
          letter-spacing: 0.22em;
          color: #7a8fa8;
          text-transform: uppercase;
          display: block;
          margin-bottom: 10px;
        }

        .field-input {
          width: 100%;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(148,163,184,0.08);
          border-bottom: 2px solid rgba(220,38,38,0.3);
          padding: 14px 16px;
          color: #f1f5f9;
          font-family: 'Share Tech Mono', monospace;
          font-size: 16px;
          letter-spacing: 0.04em;
          outline: none;
          transition: all 0.2s;
        }
        .field-input:focus {
          border-bottom-color: #dc2626;
          background: rgba(220,38,38,0.03);
          box-shadow: 0 4px 16px rgba(220,38,38,0.08);
        }
        .field-input::placeholder { color: #253040; }

        .error-bar {
          background: rgba(220,38,38,0.1);
          border-left: 3px solid #dc2626;
          padding: 13px 16px;
          margin-bottom: 22px;
          font-family: 'Share Tech Mono', monospace;
          font-size: 13px;
          color: #fca5a5;
          letter-spacing: 0.04em;
        }

        .submit-btn {
          width: 100%;
          padding: 18px;
          background: #dc2626;
          color: #fff;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 22px;
          font-weight: 700;
          letter-spacing: 0.38em;
          text-transform: uppercase;
          border: none;
          cursor: pointer;
          transition: background 0.2s, box-shadow 0.2s, letter-spacing 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-top: 30px;
          position: relative;
          overflow: hidden;
        }
        .submit-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 60%);
          pointer-events: none;
        }
        .submit-btn:hover:not(:disabled) {
          background: #b91c1c;
          box-shadow: 0 0 36px rgba(220,38,38,0.55), 0 6px 20px rgba(0,0,0,0.4);
          letter-spacing: 0.44em;
        }
        .submit-btn:active:not(:disabled) { transform: translateY(1px); }
        .submit-btn:disabled { opacity: 0.45; cursor: not-allowed; }

        .spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .card-footer {
          padding: 14px 40px 22px;
          text-align: center;
          font-family: 'Share Tech Mono', monospace;
          font-size: 12px;
          color: #3d5068;
          letter-spacing: 0.2em;
          border-top: 1px solid rgba(255,255,255,0.03);
        }
      `}</style>

      <div className="login-root">
        <div className="login-card">
          <div className="card-eyebrow">
            <span className="eyebrow-line" />
            <span className="eyebrow-text">Secure Access</span>
            <span className="eyebrow-line" />
          </div>

          <div className="card-logo-section">
            {!logoFailed ? (
              <img
                className="logo-img"
                src="/rock-logo.png"
                alt="Rock Enterprise"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <div className="logo-fallback-block">
                <div className="re-badge">RE</div>
                <div className="fallback-text">
                  <div className="fallback-name">Rock Enterprise</div>
                  <div className="fallback-sub">Co. Ltd.</div>
                </div>
              </div>
            )}

            <div className="app-name-block">
              <div className="app-name">Shipping Label Separator</div>
              <div className="app-tag">Internal Operations Tool</div>
            </div>
          </div>

          <div className="card-divider" />

          <div className="card-body">
            {error && <div className="error-bar">{error}</div>}
            <form ref={formRef} onSubmit={handleSubmit}>
              <div className="field-group">
                <label className="field-label" htmlFor="username">User ID</label>
                <input
                  id="username"
                  className="field-input"
                  type="text"
                  autoComplete="username"
                  placeholder="Enter user ID"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="password">Password</label>
                <input
                  id="password"
                  className="field-input"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
              <button className="submit-btn" type="submit" disabled={loading}>
                {loading ? <><span className="spinner" />Authenticating…</> : 'Sign In'}
              </button>
            </form>
          </div>

          <div className="card-footer">Internal Use Only · Rock Enterprise Co. Ltd.</div>
        </div>
      </div>
    </>
  )
}
