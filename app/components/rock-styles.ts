// Shared look for every Rock tool page: header, drop zone, buttons, status cards.
// Page-specific styles live next to the page in their own <style> block.
export const ROCK_BASE_CSS = `
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
          min-height: 68px;
          background: #0c1220;
          border-bottom: 1px solid rgba(220,38,38,0.18);
          border-top: 3px solid #dc2626;
          position: sticky;
          top: 0;
          z-index: 10;
          box-shadow: 0 4px 24px rgba(0,0,0,0.5);
          gap: 16px;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 18px;
          min-width: 0;
          flex: 1;
        }

        .header-brand {
          display: flex;
          align-items: center;
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
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 16px;
          color: #fff;
          letter-spacing: 0.04em;
          flex-shrink: 0;
        }

        .header-divider {
          width: 1px;
          height: 30px;
          background: rgba(220,38,38,0.2);
          flex-shrink: 0;
        }

        .header-title-block {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .header-title {
          font-size: 23px;
          font-weight: 700;
          letter-spacing: 0.12em;
          color: #e2e8f0;
          text-transform: uppercase;
          line-height: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .header-title-sub {
          font-family: 'Share Tech Mono', monospace;
          font-size: 13px;
          color: #64748b;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .logout-btn {
          flex-shrink: 0;
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


        /* ── Back link (tool pages) ── */
        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: 'Share Tech Mono', monospace;
          font-size: 13px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #64748b;
          text-decoration: none;
          padding: 8px 12px;
          border: 1px solid rgba(100,116,139,0.2);
          transition: all 0.2s;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .back-link:hover { color: #fca5a5; border-color: rgba(220,38,38,0.5); }
        .header-brand-link { display: flex; align-items: center; text-decoration: none; }

        @media (max-width: 640px) {
          .app-header {
            padding: 12px 16px;
            gap: 12px;
          }
          .header-left { gap: 12px; }
          .header-logo-img { height: 30px; }
          /* App title is redundant with the panel heading on small screens */
          .header-divider,
          .header-title-block { display: none; }
          .logout-btn {
            font-size: 14px;
            padding: 8px 14px;
            letter-spacing: 0.14em;
          }
          .app-main { padding: 32px 16px; }
          .panel-heading-text { font-size: 13px; letter-spacing: 0.2em; }
          .drop-zone { min-height: 200px; padding: 36px 20px; }
          .zone-icon { width: 52px; height: 52px; }
          .zone-main-text { font-size: 21px; }
          .zone-sub-text { font-size: 16px; }
          .convert-btn { font-size: 19px; letter-spacing: 0.28em; }
          .toast { left: 16px; right: 16px; bottom: 16px; max-width: none; }
          .back-link { padding: 7px 10px; font-size: 12px; letter-spacing: 0.1em; }
        }
`
