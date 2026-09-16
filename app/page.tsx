import Link from 'next/link'
import RockHeader from './components/RockHeader'
import { ROCK_BASE_CSS } from './components/rock-styles'

interface Tool {
  href: string
  title: string
  description: string
  tag: string
  icon: React.ReactNode
}

const tools: Tool[] = [
  {
    href: '/separator',
    title: 'Shipping Label Separator',
    description: 'Split a multi-page label PDF into one PDF per parcel, named by tracking barcode.',
    tag: 'PDF → ZIP',
    icon: (
      <svg width="30" height="30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.848 8.25l1.536.887M7.848 8.25a3 3 0 11-5.196-3 3 3 0 015.196 3zm1.536.887a2.165 2.165 0 011.083 1.839c.005.351.054.695.14 1.024M9.384 9.137l2.077 1.199M7.848 15.75l1.536-.887m-1.536.887a3 3 0 11-5.196 3 3 3 0 015.196-3zm1.536-.887a2.165 2.165 0 001.083-1.838c.005-.352.054-.695.14-1.025m-1.223 2.863l2.077-1.199m0-3.328a4.323 4.323 0 012.068-1.379l5.325-1.628a4.5 4.5 0 012.48-.044l.803.215-7.794 4.5m-2.882-1.664A4.331 4.331 0 0010.607 12m3.736 0l7.794 4.5-.802.215a4.5 4.5 0 01-2.48-.043l-5.326-1.629a4.324 4.324 0 01-2.068-1.379M14.343 12l-2.882 1.664" />
      </svg>
    ),
  },
  {
    href: '/continental',
    title: 'Continental Converter',
    description: 'Turn the ECang Continental Label CSV into the Continental upload XLSX.',
    tag: 'CSV → XLSX',
    icon: (
      <svg width="30" height="30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
  },
]

export default function ToolPickerPage() {
  return (
    <>
      <style>{ROCK_BASE_CSS}</style>
      <style>{`
        .tool-list { display: flex; flex-direction: column; gap: 16px; }
        .tool-card {
          display: flex;
          align-items: center;
          gap: 22px;
          padding: 26px 28px;
          background: rgba(12,18,32,0.9);
          border: 1px solid rgba(100,116,139,0.18);
          border-left: 3px solid rgba(220,38,38,0.5);
          text-decoration: none;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s, transform 0.2s;
        }
        .tool-card:hover, .tool-card:focus-visible {
          border-color: rgba(220,38,38,0.6);
          border-left-color: #dc2626;
          background: rgba(220,38,38,0.05);
          box-shadow: 0 0 32px rgba(220,38,38,0.12);
          outline: none;
        }
        .tool-icon {
          width: 64px; height: 64px;
          flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: rgba(220,38,38,0.1);
          border: 1px solid rgba(220,38,38,0.3);
          color: #f87171;
          transition: background 0.2s, color 0.2s;
        }
        .tool-card:hover .tool-icon { background: #dc2626; color: #fff; }
        .tool-body { flex: 1; min-width: 0; }
        .tool-title {
          font-size: 26px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #e2e8f0;
          line-height: 1.1;
        }
        .tool-desc { font-size: 18px; color: #7a8fa8; margin-top: 4px; line-height: 1.3; }
        .tool-tag {
          display: inline-block;
          margin-top: 10px;
          font-family: 'Share Tech Mono', monospace;
          font-size: 12px;
          letter-spacing: 0.14em;
          color: #fca5a5;
          background: rgba(220,38,38,0.08);
          border: 1px solid rgba(220,38,38,0.25);
          padding: 2px 8px;
        }
        .tool-arrow { color: #475569; font-size: 28px; transition: transform 0.2s, color 0.2s; }
        .tool-card:hover .tool-arrow { color: #dc2626; transform: translateX(4px); }
        @media (max-width: 640px) {
          .tool-card { padding: 20px 18px; gap: 16px; }
          .tool-icon { width: 52px; height: 52px; }
          .tool-title { font-size: 22px; }
          .tool-desc { font-size: 16px; }
          .tool-arrow { display: none; }
        }
      `}</style>

      <div className="app-root">
        <RockHeader title="Rock Operations Tools" />

        <main className="app-main">
          <div className="content-panel">
            <div className="panel-heading">
              <span className="panel-heading-line" />
              <span className="panel-heading-text">Select a Tool</span>
              <span className="panel-heading-line" />
            </div>

            <div className="tool-list">
              {tools.map(tool => (
                <Link key={tool.href} href={tool.href} className="tool-card">
                  <span className="tool-icon">{tool.icon}</span>
                  <span className="tool-body">
                    <span className="tool-title" style={{ display: 'block' }}>{tool.title}</span>
                    <span className="tool-desc" style={{ display: 'block' }}>{tool.description}</span>
                    <span className="tool-tag">{tool.tag}</span>
                  </span>
                  <span className="tool-arrow">→</span>
                </Link>
              ))}
            </div>
          </div>
        </main>
      </div>
    </>
  )
}
