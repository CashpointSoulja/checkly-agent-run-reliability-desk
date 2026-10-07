export type StepKind = 'plan' | 'tool' | 'approval' | 'response'

export interface Step {
  id: string
  kind: StepKind
  label: string
  startMs: number
  durationMs: number
  tool?: string
  target?: string
  args?: Record<string, unknown>
  httpStatus?: number
  sideEffect?: boolean
  idempotencyKey?: string
  result?: Record<string, unknown>
  approval?: { forStep: string; approver: string; granted: boolean }
  note?: string
}

export interface Source {
  id: string
  title: string
  uri: string
  asOf: string
  excerpt: string
  stepId?: string
}

export interface Claim {
  id: string
  text: string
  sourceIds: string[]
  quote?: string
}

export type Invariant =
  | { id: string; kind: 'tools_allowed'; tools: string[]; description: string }
  | { id: string; kind: 'target_matches'; tool: string; expected: string; description: string }
  | { id: string; kind: 'max_source_age'; minutes: number; description: string }
  | { id: string; kind: 'latency_budget'; ms: number; description: string }
  | { id: string; kind: 'approval_required'; tool: string; aboveAmount: number; description: string }
  | { id: string; kind: 'complete_all'; tool: string; expectedCount: number; description: string }
  | { id: string; kind: 'idempotent'; tool: string; description: string }
  | { id: string; kind: 'claims_grounded'; description: string }

export interface Trace {
  id: string
  scenario: string
  title: string
  agent: string
  release: string
  startedAt: string
  task: { goal: string; requestedBy: string }
  policy: { id: string; version: string; abstainAllowed: boolean; invariants: Invariant[] }
  steps: Step[]
  sources: Source[]
  output: {
    httpStatus: number
    status: 'completed' | 'abstained'
    message: string
    claims: Claim[]
    abstainReason?: string
  }
}

export type AssertionStatus = 'pass' | 'fail' | 'review' | 'skip'

export interface AssertionResult {
  id: string
  kind: Invariant['kind'] | 'abstention_safe' | 'evidence_coverage'
  description: string
  status: AssertionStatus
  expected: string
  actual: string
  stepId?: string
  claimId?: string
  message: string
  /** Passed without proving the job was done (nothing it checks happened, or it only checks speed). */
  vacuous?: boolean
}

export type TaskVerdict = 'pass' | 'fail' | 'review'

export interface Evaluation {
  traceId: string
  validatorVersion: string
  transport: {
    status: 'pass' | 'fail'
    finalHttp: number
    totalMs: number
    stepErrors: { stepId: string; httpStatus: number }[]
  }
  task: TaskVerdict
  assertions: AssertionResult[]
  firstFailure?: AssertionResult
  reviewReason?: 'abstained' | 'insufficient_evidence'
  coverage: { substantivePasses: number; declaredInvariants: number; steps: number }
  summary: string
}
