type Kind = 'pass' | 'fail' | 'review' | 'skip'
const TEXT: Record<Kind, [string, string]> = { pass: ['✓', 'PASS'], fail: ['✕', 'FAIL'], review: ['◐', 'REVIEW'], skip: ['–', 'N/A'] }

export function StatusChip({ kind, label, compact }: { kind: Kind; label?: string; compact?: boolean }) {
  const [icon, word] = TEXT[kind]
  return (
    <span className={`chip ${kind}${compact ? ' compact' : ''}`}>
      <span aria-hidden="true">{icon}</span> {label ?? word}
      {label && <span className="sr-only"> {word}</span>}
    </span>
  )
}
