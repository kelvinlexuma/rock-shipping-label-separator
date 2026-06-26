'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
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
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Barlow+Condensed:wght@300;400;600;700&display=swap');

        .login-root {
          font-family: 'Barlow Condensed', sans-serif;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0a0f1a;
          background-image:
            repeating-linear-gradient(
              0deg,
              transparent,
              transparent 39px,
              rgba(220,38,38,0.04) 39px,
              rgba(220,38,38,0.04) 40px
            ),
            repeating-linear-gradient(
              90deg,
              transparent,
              transparent 39px,
              rgba(220,38,38,0.04) 39px,
              rgba(220,38,38,0.04) 40px
            );
          padding: 24px;
        }

        .login-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0,0,0,0.15) 2px,
            rgba(0,0,0,0.15) 4px
          );
          pointer-events: none;
          z-index: 0;
        }

        .login-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 400px;
          background: #0f1624;
          border: 1px solid rgba(220,38,38,0.25);
          border-top: 2px solid #dc2626;
          box-shadow:
            0 0 40px rgba(220,38,38,0.08),
            0 20px 60px rgba(0,0,0,0.6),
            inset 0 1px 0 rgba(255,255,255,0.04);
        }

        .card-header {
          padding: 32px 32px 0;
          text-align: center;
        }

        .card-header .corner-tag {
          font-family: 'Share Tech Mono', monospace;
          font-size: 10px;
          color: #dc2626;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 24px;
        }
        .corner-tag::before,
        .corner-tag::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(220,38,38,0.3);
        }

        .logo-wrap {
          display: flex;
          justify-content: center;
          margin-bottom: 20px;
        }

        .logo-wrap img {
          height: 52px;
          object-fit: contain;
          filter: brightness(0) invert(1);
        }

        .logo-fallback {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 28px;
          font-weight: 700;
          letter-spacing: 0.12em;
          color: #fff;
          text-transform: uppercase;
        }

        .card-title {
          font-size: 13px;
          font-weight: 300;
          letter-spacing: 0.3em;
          color: #64748b;
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .card-subtitle {
          font-size: 20px;
          font-weight: 600;
          letter-spacing: 0.08em;
          color: #e2e8f0;
          text-transform: uppercase;
          margin-bottom: 0;
        }

        .divider {
          margin: 28px 32px 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(220,38,38,0.3), transparent);
        }

        .card-body {
          padding: 28px 32px 32px;
        }

        .field-group {
          margin-bottom: 18px;
        }

        .field-label {
          font-family: 'Share Tech Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.2em;
          color: #64748b;
          text-transform: uppercase;
          display: block;
          margin-bottom: 8px;
        }

        .field-input {
          width: 100%;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(148,163,184,0.12);
          border-bottom: 1px solid rgba(220,38,38,0.3);
          padding: 11px 14px;
          color: #e2e8f0;
          font-family: 'Share Tech Mono', monospace;
          font-size: 14px;
          letter-spacing: 0.05em;
          outline: none;
          transition: all 0.2s;
          box-sizing: border-box;
        }

        .field-input:focus {
          border-color: rgba(220,38,38,0.6);
          background: rgba(220,38,38,0.03);
          box-shadow: 0 0 0 1px rgba(220,38,38,0.15) inset;
        }

        .field-input::placeholder {
          color: #334155;
        }

        .error-bar {
          background: rgba(220,38,38,0.08);
          border-left: 2px solid #dc2626;
          padding: 10px 14px;
          margin-bottom: 18px;
          font-family: 'Share Tech Mono', monospace;
          font-size: 12px;
          color: #fca5a5;
          letter-spacing: 0.05em;
        }

        .submit-btn {
          width: 100%;
          padding: 14px;
          background: #dc2626;
          color: #fff;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 24px;
        }

        .submit-btn:hover:not(:disabled) {
          background: #b91c1c;
          box-shadow: 0 0 20px rgba(220,38,38,0.4);
        }

        .submit-btn:active:not(:disabled) {
          transform: translateY(1px);
        }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .card-footer {
          padding: 12px 32px 20px;
          text-align: center;
          font-family: 'Share Tech Mono', monospace;
          font-size: 10px;
          color: #1e293b;
          letter-spacing: 0.15em;
        }
      `}</style>

      <div className="login-root">
        <div className="login-card">
          <div className="card-header">
            <div className="corner-tag">SECURE ACCESS</div>
            <div className="logo-wrap">
              <img
                src="/rock-logo.jpg"
                alt="Rock Enterprise"
                onError={e => {
                  const t = e.currentTarget
                  t.style.display = 'none'
                  const fb = t.nextElementSibling as HTMLElement
                  if (fb) fb.style.display = 'block'
                }}
              />
              <span className="logo-fallback" style={{ display: 'none' }}>ROCK</span>
            </div>
            <div className="card-title">Rock Enterprise</div>
            <div className="card-subtitle">Shipping Label Separator</div>
          </div>

          <div className="divider" />

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
                {loading ? (
                  <>
                    <span className="spinner" />
                    Authenticating
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>
          </div>

          <div className="card-footer">INTERNAL USE ONLY · ROCK ENTERPRISE</div>
        </div>
      </div>
    </>
  )
}
