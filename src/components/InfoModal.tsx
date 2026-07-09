import { useEffect } from 'react'
import { COLUMNS, type ClaimBlock, type Quote, type Source } from '../data/columns'
import { COUNTRY_COLORS, COUNTRY_NAMES_JA, DISPUTED_COLOR } from '../lib/config'
import { useAppStore } from '../store/useAppStore'

function Blockquote({ quote }: { quote: Quote }) {
  return (
    <blockquote className="column-quote">
      <p>{quote.text}</p>
      <cite>— {quote.cite}</cite>
    </blockquote>
  )
}

function SourceList({ sources, label }: { sources: Source[]; label?: string }) {
  if (sources.length === 0) return null
  return (
    <div className="column-sources">
      {label && <p className="column-sources-label">{label}</p>}
      <ul>
        {sources.map((s) => (
          <li key={s.url}>
            <span className="column-source-publisher">{s.publisher}</span>
            <a href={s.url} target="_blank" rel="noreferrer noopener">
              {s.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** ある国の主張を、その国自身の出典とともに示す */
function Claim({ claim }: { claim: ClaimBlock }) {
  const name = COUNTRY_NAMES_JA[claim.country] ?? claim.country
  const color = COUNTRY_COLORS[claim.country] ?? DISPUTED_COLOR
  return (
    <section className="column-claim" style={{ borderLeftColor: color }}>
      <h4>
        <span className="swatch" style={{ backgroundColor: color }} />
        {name}の主張
      </h4>
      {claim.paragraphs.map((p) => (
        <p key={p}>{p}</p>
      ))}
      {claim.quote && <Blockquote quote={claim.quote} />}
      <SourceList sources={claim.sources} />
    </section>
  )
}

export function InfoModal() {
  const openColumnId = useAppStore((s) => s.openColumnId)
  const closeColumn = useAppStore((s) => s.closeColumn)

  // Escで閉じる。開いている間だけ購読する
  useEffect(() => {
    if (!openColumnId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeColumn()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openColumnId, closeColumn])

  if (!openColumnId) return null
  const column = COLUMNS[openColumnId]
  if (!column) return null

  return (
    <div
      className="modal-backdrop"
      onClick={closeColumn}
      role="presentation"
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={column.title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2>{column.title}</h2>
          <button className="close-button" aria-label="閉じる" onClick={closeColumn}>
            ×
          </button>
        </header>

        <div className="modal-body">
          <p className="column-lead">{column.lead}</p>

          {column.sections.map((sec, i) => (
            <section key={sec.heading ?? i} className="column-section">
              {sec.heading && <h3>{sec.heading}</h3>}
              {sec.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
              {sec.quote && <Blockquote quote={sec.quote} />}
            </section>
          ))}

          {column.claims && (
            <div className="column-claims">
              {column.claims.map((c) => (
                <Claim key={c.country} claim={c} />
              ))}
            </div>
          )}

          {column.modelNote && (
            <section className="column-model-note">
              <h3>このアプリでの扱い</h3>
              {column.modelNote.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </section>
          )}

          <SourceList sources={column.sources} label="出典" />

          <p className="column-disclaimer">
            本アプリは教育目的の簡略モデルであり、法的な境界を示すものではありません。
            各国の主張は、可能な限りその国の政府・公的機関自身が公表した文書を出典としています。
          </p>
        </div>
      </div>
    </div>
  )
}
