'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Props {
  title: string
  subtitle?: string
  /** Show a "← Tools" link back to the tool picker. */
  backLink?: boolean
}

/** Rock header — needs ROCK_BASE_CSS on the page. */
export default function RockHeader({ title, subtitle = 'Internal Operations Tool', backLink }: Props) {
  const [logoFailed, setLogoFailed] = useState(false)
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <header className="app-header">
      <div className="header-left">
        <Link href="/" className="header-brand header-brand-link" aria-label="All tools">
          {!logoFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
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
        </Link>

        <div className="header-divider" />

        <div className="header-title-block">
          <div className="header-title">{title}</div>
          <div className="header-title-sub">{subtitle}</div>
        </div>
      </div>

      {backLink && <Link href="/" className="back-link">← Tools</Link>}
      <button className="logout-btn" onClick={handleLogout}>Logout</button>
    </header>
  )
}
