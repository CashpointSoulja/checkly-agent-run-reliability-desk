import { useEffect, useMemo, useRef, useState } from 'react'
import { compareReleases, gate, type ComparisonRow } from './domain/compare'
import { alertPreview, fixtureFile, releaseReport, reviewMemo } from './domain/exports'
import { BASELINE, CANDIDATE, SCENARIOS, seedFixtures } from './domain/fixtures'
import { importTraces, type ImportResult } from './domain/importTrace'
import type { Evaluation, Trace } from './domain/types'
import { evaluate } from './domain/validators'
import { download } from './download'
import { RunDetail } from './components/RunDetail'
import { StatusChip } from './components/StatusChip'

type View = 'candidate' | 'baseline' | 'imported'
type Review = { decision?: string; note?: string }
interface Persisted { imported: Trace[]; evaluated: string[]; reviews: Record<string, Review> }

const KEY = 'agent-run-desk:v1'
const seeds = seedFixtures()
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Persisted
  } catch { /* ignore corrupt local state */ }
  return { imported: [], evaluated: [], reviews: {} }
}

const scenarioLabel = (k: string) => SCENARIOS.find((s) => s.key === k)?.label ?? k
const today = () => new Date().toISOString().slice(0, 10)

export default function App() {
  const initial = useMemo(load, [])
  const [view, setView] = useState<View>('candidate')
  const [imported, setImported] = useState<Trace[]>(initial.imported)
  const [evaluated, setEvaluated] = useState<Set<string>>(new Set(initial.evaluated))
  const [reviews, setReviews] = useState<Record<string, Review>>(initial.reviews)
  const [selectedId, setSelectedId] = useState<string>(seeds.candidate[0].id)
  const [busy, setBusy] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [toast, setToast] = useState('')
  const timers = useRef<number[]>([])

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify({ imported, evaluated: [...evaluated], reviews } satisfies Persisted))
  }, [imported, evaluated, reviews])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const lists: Record<View, Trace[]> = { candidate: seeds.candidate, baseline: seeds.baseline, imported }
  const all = useMemo(() => [...seeds.candidate, ...seeds.baseline, ...imported], [imported])
  const evals = useMemo(() => new Map<string, Evaluation>(all.map((t) => [t.id, evaluate(t)])), [all])
  const list = lists[view]
  const selected = all.find((t) => t.id === selectedId) ?? list[0]
  const selectedEval = selected && evaluated.has(selected.id) ? evals.get(selected.id) : undefined

  const suiteDone = [...seeds.candidate, ...seeds.baseline].every((t) => evaluated.has(t.id))
  const rows = useMemo(() => compareReleases(seeds.baseline, seeds.candidate, evals), [evals])
  const g = gate(rows)
  const rowFor = (t?: Trace): ComparisonRow | undefined => (t && t.release === CANDIDATE ? rows.find((r) => r.scenario === t.scenario) : undefined)

  function selectFromList(id: string) {
    setSelectedId(id)
    if (window.innerWidth < 900) requestAnimationFrame(() => document.getElementById('run-detail')?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' }))
  }

  function flash(msg: string) {
    setToast(msg)
    const id = window.setTimeout(() => setToast(''), 2600)
    timers.current.push(id)
  }

  function evaluateList(ids: string[]) {
    const delay = reduceMotion() ? 0 : 110
    setBusy(true)
    ids.forEach((id, i) => {
      timers.current.push(window.setTimeout(() => setEvaluated((s) => new Set(s).add(id)), delay * (i + 1)))
    })
    timers.current.push(window.setTimeout(() => setBusy(false), delay * (ids.length + 1)))
  }

  function evaluateRelease() {
    const order = view === 'imported' ? imported : [...lists[view], ...(view === 'candidate' ? seeds.baseline : seeds.candidate)]
    evaluateList(order.map((t) => t.id).filter((id) => !evaluated.has(id)))
  }

  function reset() {
    timers.current.forEach(clearTimeout)
    timers.current = []
    localStorage.removeItem(KEY)
    setImported([]); setEvaluated(new Set()); setReviews({}); setView('candidate'); setSelectedId(seeds.candidate[0].id)
    setImportOpen(false); setImportText(''); setImportResult(null); setBusy(false)
    flash('Reset: fixtures re-seeded, evaluations and reviews cleared.')
  }

  function runImport(text: string) {
    const r = importTraces(text)
    setImportResult(r)
    if (r.traces.length) {
      const known = new Set(all.map((t) => t.id))
      const fresh = r.traces.map((t) => (known.has(t.id) ? { ...t, id: `${t.id}#import-${imported.length + 1}` } : t))
      setImported((p) => [...p, ...fresh])
      setView('imported')
      setSelectedId(fresh[0].id)
      setEvaluated((s) => { const n = new Set(s); fresh.forEach((t) => n.add(t.id)); return n })
    }
  }

  async function onFile(f: File | undefined) {
    if (!f) return
    const text = await f.text()
    setImportText(text)
    runImport(text)
  }

  const exampleJson = () => JSON.stringify({ ...seeds.candidate[4], id: 'my-run-001', title: 'Pasted trace: refund without approval' }, null, 2)

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src={`${import.meta.env.BASE_URL}brand/checkly-logo-on-dark.svg`} alt="Checkly" height={24} />
          <span className="divider" aria-hidden="true" />
          <span className="product">Agent Run Reliability Desk</span>
        </div>
        <p className="disclaimer">Independent concept by Ayo Ahmed. Not affiliated with Checkly.</p>
      </header>
      <div className="banner" role="note">
        <strong>Synthetic fixtures</strong> · evaluated locally in your browser · no telemetry, no monitoring connection, no real agent actions. Validators are deterministic rules; there is no AI scoring.
      </div>

      <div className="toolbar">
        <div className="seg" role="group" aria-label="Run set">
          {(['candidate', 'baseline', 'imported'] as View[]).map((v) => (
            <button key={v} aria-pressed={view === v} onClick={() => { setView(v); if (lists[v][0]) setSelectedId(lists[v][0].id) }}>
              {v === 'candidate' ? `Candidate ${CANDIDATE}` : v === 'baseline' ? `Baseline ${BASELINE}` : `Imported (${imported.length})`}
            </button>
          ))}
        </div>
        <div className="actions">
          <button className="btn primary" onClick={evaluateRelease} disabled={busy || (view === 'imported' && imported.length === 0)}>
            {busy ? 'Running validators…' : view === 'imported' ? 'Re-run validators' : 'Run validators on both releases'}
          </button>
          <button className="btn" onClick={() => { setImportOpen((o) => !o); setImportResult(null) }} aria-expanded={importOpen} aria-controls="import-panel">Load JSON trace</button>
          <button className="btn ghost" onClick={reset}>Reset</button>
        </div>
      </div>

      {importOpen && (
        <section id="import-panel" className="panel import" aria-label="Load JSON trace">
          <div className="import-head">
            <h2>Load a JSON trace</h2>
            <p>Paste a trace, an array of traces, or an exported fixture file. Parsed and evaluated only in this tab.</p>
          </div>
          <label className="sr-only" htmlFor="trace-json">Trace JSON</label>
          <textarea id="trace-json" value={importText} onChange={(e) => setImportText(e.target.value)} spellCheck={false} placeholder='{"id": "...", "steps": [...], "policy": {...}, "output": {...}}' />
          <div className="import-actions">
            <button className="btn primary" onClick={() => runImport(importText)} disabled={!importText.trim()}>Import and evaluate</button>
            <button className="btn" onClick={() => setImportText(exampleJson())}>Insert example trace</button>
            <label className="btn file">Choose .json file<input type="file" accept="application/json,.json" onChange={(e) => onFile(e.target.files?.[0])} /></label>
          </div>
          {importResult && (
            <div className="import-result" role="status">
              {importResult.traces.length > 0 && <p className="ok">Imported {importResult.traces.length} trace(s).</p>}
              {importResult.warnings.length > 0 && <ul className="warn">{importResult.warnings.slice(0, 8).map((w) => <li key={w}>{w}</li>)}</ul>}
              {importResult.reproduced.map((r) => <p key={r.id} className={r.match ? 'ok' : 'bad'}>{r.detail}</p>)}
              {importResult.errors.length > 0 && <ul className="bad">{importResult.errors.slice(0, 8).map((e) => <li key={e}><code>{e}</code></li>)}</ul>}
            </div>
          )}
        </section>
      )}

      <main className="layout">
        <nav className="runs panel" aria-label="Runs">
          <h2 className="panel-title">{view === 'imported' ? 'Imported runs' : `${view === 'candidate' ? 'Candidate' : 'Baseline'} runs`} <span className="muted">{list.length}</span></h2>
          {list.length === 0 && <p className="empty">No imported traces yet. Use <b>Load JSON trace</b>.</p>}
          <ul>
            {list.map((t) => {
              const e = evaluated.has(t.id) ? evals.get(t.id) : undefined
              return (
                <li key={t.id}>
                  <button className="run" aria-current={selected?.id === t.id} onClick={() => selectFromList(t.id)}>
                    <span className="run-name">{scenarioLabel(t.scenario)}</span>
                    <span className="run-title">{t.title}</span>
                    <span className="run-chips">
                      <span className="chip-label">HTTP</span>{e ? <StatusChip kind={e.transport.status} label={String(e.transport.finalHttp)} /> : <span className="chip pending">-</span>}
                      <span className="chip-label">Task</span>{e ? <StatusChip kind={e.task} /> : <span className="chip pending">not run</span>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <section className="detail" id="run-detail" aria-label="Run detail">
          {selected ? (
            <RunDetail
              trace={selected}
              evaluation={selectedEval}
              row={rowFor(selected)}
              onRun={() => evaluateList([selected.id])}
              review={reviews[selected.id] ?? {}}
              onReview={(r) => setReviews((p) => ({ ...p, [selected.id]: { ...p[selected.id], ...r } }))}
            />
          ) : <div className="panel empty">Select a run.</div>}
        </section>

        <aside className="rail" aria-label="Release comparison and exports">
          <section className="panel">
            <h2 className="panel-title">Release gate <span className="muted">{BASELINE} → {CANDIDATE}</span></h2>
            {suiteDone ? (
              <>
                <div className={`gate ${g.blocked ? 'blocked' : 'clear'}`} role="status">
                  <strong>{g.blocked ? '✕ Release blocked' : '✓ Release clear'}</strong>
                  <span>{g.failing} failing · {g.regressions} regressions · {g.review} review</span>
                </div>
                <table className="compare">
                  <thead><tr><th scope="col">Scenario</th><th scope="col">Base</th><th scope="col">Cand.</th><th scope="col">Change</th></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.scenario} className={selected?.scenario === r.scenario ? 'sel' : ''}>
                        <th scope="row"><button className="link" onClick={() => { setView('candidate'); setSelectedId(`${r.scenario}@${CANDIDATE}`) }}>{scenarioLabel(r.scenario)}</button></th>
                        <td>{r.baseline && <StatusChip kind={r.baseline} compact />}</td>
                        <td><StatusChip kind={r.candidate} compact /></td>
                        <td><span className={`delta ${r.delta}`}>{r.delta.replace('-', ' ')}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button className="btn block" onClick={() => { download(`release-${BASELINE}-to-${CANDIDATE}.md`, releaseReport(BASELINE, CANDIDATE, rows, today()), 'text/markdown'); flash('Downloaded release comparison (Markdown).') }}>Download release comparison</button>
              </>
            ) : <p className="empty">Run validators on both releases to compare {BASELINE} with {CANDIDATE}.</p>}
          </section>

          <section className="panel">
            <h2 className="panel-title">Export this run</h2>
            {selected && selectedEval ? (
              <div className="exports">
                <button className="btn block" onClick={() => { download(`fixture-${selected.id.replace(/[^a-z0-9.-]+/gi, '_')}.json`, JSON.stringify(fixtureFile(selected, selectedEval), null, 2)); flash('Downloaded reproducible fixture (JSON).') }}>Reproducible fixture (.json)</button>
                <button className="btn block" onClick={() => { const r = reviews[selected.id]; download(`review-memo-${selected.id.replace(/[^a-z0-9.-]+/gi, '_')}.md`, reviewMemo(selected, selectedEval, { row: rowFor(selected), decision: r?.decision, note: r?.note, date: today() }), 'text/markdown'); flash('Downloaded review memo (Markdown).') }}>Review memo (.md)</button>
              </div>
            ) : <p className="empty">Run validators on this run to enable exports.</p>}
          </section>

          <section className="panel">
            <h2 className="panel-title">Alert preview <span className="tag">Preview only, not sent</span></h2>
            {selected && selectedEval ? (
              <>
                <pre className="alert" aria-label="Alert preview text">{alertPreview(selected, selectedEval, rowFor(selected))}</pre>
                <button className="btn block" onClick={() => { navigator.clipboard?.writeText(alertPreview(selected, selectedEval, rowFor(selected))).then(() => flash('Alert text copied to clipboard. Nothing was sent.'), () => flash('Clipboard unavailable.')) }}>Copy alert text</button>
              </>
            ) : <p className="empty">The alert appears after validation.</p>}
          </section>
        </aside>
      </main>

      <footer className="foot">
        Independent concept by Ayo Ahmed. Not affiliated with Checkly. The Checkly name and logo belong to Checkly and are used only to show the brand context of this concept. All runs, people, orders and URLs are synthetic.
      </footer>
      <div className="toast" role="status" aria-live="polite">{toast}</div>
    </div>
  )
}
