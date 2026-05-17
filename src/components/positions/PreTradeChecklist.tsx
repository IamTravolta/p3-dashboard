'use client'

/**
 * PreTradeChecklist
 *
 * A mandatory gate modal shown before any position is added.
 * Forces the investor to articulate thesis, catalyst, invalidation
 * conditions, stop loss, target, and position size rationale.
 *
 * Answers are saved with the position for 30-day thesis review.
 */

import { useState } from 'react'

export interface ChecklistAnswers {
  thesis:        string   // Why am I buying this in one sentence?
  catalyst:      string   // What is the specific near-term trigger?
  invalidation:  string   // What would prove me wrong?
  stopLoss:      string   // At what price am I wrong and getting out?
  target:        string   // Price target and time horizon
  sizeRationale: string   // Why this position size?
}

interface PreTradeChecklistProps {
  ticker:   string
  onSubmit: (answers: ChecklistAnswers) => void
  onCancel: () => void
}

const QUESTIONS: Array<{
  key:         keyof ChecklistAnswers
  label:       string
  placeholder: string
  hint:        string
}> = [
  {
    key:         'thesis',
    label:       '1. What is your thesis in one sentence?',
    placeholder: 'e.g. ASML is the sole supplier of EUV lithography machines with a 20-year moat and is priced below intrinsic value.',
    hint:        'If you can\'t say it in one sentence, you don\'t know it well enough.',
  },
  {
    key:         'catalyst',
    label:       '2. What is the specific catalyst that makes now the right time?',
    placeholder: 'e.g. Q2 earnings beat expectations, management raised guidance, stock pulled back 12% on sector noise.',
    hint:        'A thesis without timing is just research. What\'s happening now that creates the entry?',
  },
  {
    key:         'invalidation',
    label:       '3. What would prove you wrong?',
    placeholder: 'e.g. If revenue growth falls below 15% YoY, or a major competitor enters the EUV market.',
    hint:        'Define this before you buy — you\'ll be too emotional to think clearly after.',
  },
  {
    key:         'stopLoss',
    label:       '4. At what price are you wrong and getting out?',
    placeholder: 'e.g. €620 — a break below the 200-day MA with volume.',
    hint:        'A price or condition. Not a feeling. Not "if it keeps falling".',
  },
  {
    key:         'target',
    label:       '5. What is your price target and time horizon?',
    placeholder: 'e.g. €900 within 18 months based on DCF at 15% discount rate.',
    hint:        'Asymmetry check: is the upside at least 2× the downside?',
  },
  {
    key:         'sizeRationale',
    label:       '6. Why this position size and not more or less?',
    placeholder: 'e.g. High conviction but near earnings — starting at 3% and will add post-report if thesis confirmed.',
    hint:        'Size communicates your actual confidence level. Be honest.',
  },
]

const INPUT_CLS = 'w-full rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition resize-none'

export default function PreTradeChecklist({ ticker, onSubmit, onCancel }: PreTradeChecklistProps) {
  const [answers, setAnswers] = useState<ChecklistAnswers>({
    thesis: '', catalyst: '', invalidation: '', stopLoss: '', target: '', sizeRationale: '',
  })
  const [attempted, setAttempted] = useState(false)

  function set(key: keyof ChecklistAnswers, value: string) {
    setAnswers((a) => ({ ...a, [key]: value }))
  }

  function isValid(key: keyof ChecklistAnswers): boolean {
    return answers[key].trim().length >= 10
  }

  const allValid = QUESTIONS.every((q) => isValid(q.key))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setAttempted(true)
    if (!allValid) return
    onSubmit(answers)
  }

  const completedCount = QUESTIONS.filter((q) => isValid(q.key)).length

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl mb-8">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950 rounded-t-2xl px-6 py-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-bold text-white">{ticker}</span>
                <span className="rounded-full bg-amber-900/40 border border-amber-700/50 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
                  Pre-Trade Checklist
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Answer all 6 questions before this position is added. This takes 3 minutes and saves hours of regret.
              </p>
            </div>
            <button
              onClick={onCancel}
              className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-white transition shrink-0 ml-4"
            >
              ✕
            </button>
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-zinc-500">{completedCount} of 6 answered</span>
              <span className={`font-medium ${allValid ? 'text-emerald-400' : 'text-zinc-500'}`}>
                {allValid ? '✓ Ready to add' : `${6 - completedCount} remaining`}
              </span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${allValid ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                style={{ width: `${(completedCount / 6) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Questions */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {QUESTIONS.map((q) => {
            const touched  = attempted && !isValid(q.key)
            const complete = isValid(q.key)
            return (
              <div key={q.key} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <label className="block text-sm font-semibold text-zinc-200">{q.label}</label>
                  {complete && <span className="text-emerald-400 text-xs">✓</span>}
                </div>
                <p className="text-xs text-zinc-500 italic">{q.hint}</p>
                <textarea
                  rows={2}
                  value={answers[q.key]}
                  onChange={(e) => set(q.key, e.target.value)}
                  placeholder={q.placeholder}
                  className={`${INPUT_CLS} ${touched ? 'border-red-700 focus:border-red-600 focus:ring-red-600/30' : ''}`}
                />
                {touched && (
                  <p className="text-xs text-red-400">Please provide a meaningful answer (at least 10 characters).</p>
                )}
              </div>
            )
          })}

          {/* Warning if attempted but not valid */}
          {attempted && !allValid && (
            <div className="rounded-lg border border-amber-800 bg-amber-900/20 px-4 py-3 text-sm text-amber-400">
              Complete all 6 questions before adding the position.
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
            >
              Cancel — don't add
            </button>
            <button
              type="submit"
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition ${
                allValid
                  ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              }`}
            >
              {allValid ? `Add ${ticker} to portfolio →` : 'Complete all questions first'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
