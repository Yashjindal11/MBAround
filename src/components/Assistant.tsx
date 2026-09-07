import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { DeadlineCard, SchoolCard } from './Cards';
import { EmptyState } from './States';
import {
  defaultSuggestions,
  parseIntent,
  type Intent,
  type IntentVocabulary,
} from '../lib/assistant/intent';
import {
  answerHref,
  loadVocabulary,
  resolveIntent,
  type AnswerData,
} from '../lib/assistant/resolve';
import { isSupabaseConfigured } from '../lib/supabase';

/**
 * The MBAround assistant.
 *
 * A retrieval assistant, not a generative one. It parses a question into a
 * typed filter, runs the site's existing queries, and renders the result with
 * the site's existing cards. It writes no prose about any school, so it
 * cannot state a deadline that Supabase does not hold.
 *
 * This distinction is the reason the feature is safe to ship on data that is
 * 121 rounds strong and zero rounds verified: an undated round renders as
 * "Not announced" with its usual badge, exactly as it does everywhere else.
 * A language model asked the same question would answer fluently and be
 * wrong, and a chat answer is trusted more than a page, not less.
 */

interface Exchange {
  id: number;
  question: string;
  intent: Intent;
  data: AnswerData | null;
  error: Error | null;
}

export function Assistant() {
  const [open, setOpen] = useState(false);
  const [vocab, setVocab] = useState<IntentVocabulary | null>(null);
  const [vocabError, setVocabError] = useState<Error | null>(null);
  const [input, setInput] = useState('');
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [busy, setBusy] = useState(false);

  const panelId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);

  // The vocabulary is what keeps answers grounded, so it is fetched once when
  // the panel first opens rather than on every keystroke.
  useEffect(() => {
    if (!open || vocab || vocabError || !isSupabaseConfigured) return;
    let active = true;
    loadVocabulary()
      .then((v) => active && setVocab(v))
      .catch((e: unknown) => active && setVocabError(e instanceof Error ? e : new Error(String(e))));
    return () => {
      active = false;
    };
  }, [open, vocab, vocabError]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Keep the newest answer in view without yanking the whole page around.
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [exchanges, busy]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) setOpen(false);
      // A keyboard user should not have to tab to a floating button.
      if (e.key === '/' && !open && !isTypingTarget(e.target)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const ask = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || !vocab) return;

      const intent = parseIntent(trimmed, vocab);
      const id = nextId.current++;
      setExchanges((prev) => [...prev, { id, question: trimmed, intent, data: null, error: null }]);
      setInput('');
      setBusy(true);

      try {
        const data = await resolveIntent(intent);
        setExchanges((prev) => prev.map((x) => (x.id === id ? { ...x, data } : x)));
      } catch (e: unknown) {
        const error = e instanceof Error ? e : new Error(String(e));
        setExchanges((prev) => prev.map((x) => (x.id === id ? { ...x, error } : x)));
      } finally {
        setBusy(false);
      }
    },
    [vocab],
  );

  // Nothing here can answer anything without a database, and an assistant
  // that cheerfully returns "no deadlines" while disconnected would be making
  // a factual claim it cannot support.
  if (!isSupabaseConfigured) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-ink-900 px-4 py-3 text-sm font-medium text-white shadow-lift transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-white dark:text-ink-900"
      >
        <SparkIcon />
        <span className="hidden sm:inline">{open ? 'Close' : 'Ask'}</span>
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="MBAround assistant"
          className="fixed bottom-20 right-5 z-40 flex h-[min(34rem,calc(100vh-7rem))] w-[min(26rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-lift dark:border-ink-200 dark:bg-ink-50"
        >
          <header className="flex items-start justify-between gap-3 border-b border-ink-200 px-4 py-3">
            <div>
              <h2 className="font-display text-sm font-semibold">Ask MBAround</h2>
              <p className="mt-0.5 text-2xs text-ink-500">
                Answers come only from our database — never generated.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
              className="rounded-lg px-2 py-1 text-ink-500 hover:bg-ink-100 hover:text-ink-900"
            >
              ✕
            </button>
          </header>

          <div ref={logRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {vocabError && (
              <p role="alert" className="text-xs text-red-600 dark:text-red-400">
                Could not load the school list, so I cannot answer accurately.
                Please reload the page.
              </p>
            )}

            {!vocabError && exchanges.length === 0 && (
              <Welcome
                suggestions={vocab ? defaultSuggestions(vocab) : []}
                loading={!vocab}
                onPick={ask}
              />
            )}

            {exchanges.map((exchange) => (
              <ExchangeView key={exchange.id} exchange={exchange} onPick={ask} />
            ))}

            {busy && <p className="text-xs text-ink-500">Searching…</p>}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask(input);
            }}
            className="flex items-center gap-2 border-t border-ink-200 px-3 py-3"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Deadlines in January…"
              aria-label="Ask about deadlines or schools"
              disabled={!vocab}
              className="min-w-0 flex-1 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-ink-400 focus:border-ink-400 disabled:opacity-60 dark:bg-white"
            />
            <button
              type="submit"
              disabled={!vocab || !input.trim() || busy}
              className="btn-primary shrink-0 px-3 py-2 text-sm disabled:opacity-40"
            >
              Ask
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable
  );
}

function Welcome({
  suggestions,
  loading,
  onPick,
}: {
  suggestions: string[];
  loading: boolean;
  onPick: (q: string) => void;
}) {
  return (
    <div>
      <p className="text-xs leading-relaxed text-ink-600">
        I look up schools, programmes and application rounds. I never write
        dates myself — if a school has not announced one, I will say so.
      </p>
      {loading ? (
        <p className="mt-3 text-2xs text-ink-500">Loading school list…</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => onPick(s)}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-left text-xs text-ink-700 transition-colors hover:border-ink-400 hover:bg-ink-50"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ExchangeView({
  exchange,
  onPick,
}: {
  exchange: Exchange;
  onPick: (q: string) => void;
}) {
  const { question, intent, data, error } = exchange;
  const href = answerHref(intent);

  return (
    <section className="space-y-2.5">
      <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-ink-900 px-3 py-2 text-xs text-white dark:bg-ink-200 dark:text-ink-900">
        {question}
      </p>

      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          That search failed: {error.message}
        </p>
      )}

      {!error && data && (
        <div className="space-y-2.5">
          <p className="text-2xs font-medium uppercase tracking-wide text-ink-500">
            {intent.label}
          </p>
          <AnswerView data={data} onPick={onPick} />
          {href && hasRows(data) && (
            <Link to={href} className="inline-block text-2xs font-medium underline text-ink-600 hover:text-ink-900">
              See all on the full page →
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

function hasRows(data: AnswerData): boolean {
  if (data.kind === 'deadlines') return data.rows.length > 0;
  if (data.kind === 'schools') return data.schools.length > 0;
  return data.kind === 'school-detail' || data.kind === 'compare';
}

function AnswerView({ data, onPick }: { data: AnswerData; onPick: (q: string) => void }) {
  switch (data.kind) {
    case 'deadlines':
      if (!data.rows.length) {
        return (
          <EmptyState
            title="No deadlines match"
            description="Either nothing is scheduled, or the schools involved have not announced their dates yet."
          />
        );
      }
      return (
        <ul className="space-y-2.5">
          {data.rows.map((row) => (
            <li key={row.roundId}>
              <DeadlineCard row={row} />
            </li>
          ))}
        </ul>
      );

    case 'schools':
      if (!data.schools.length) {
        return <EmptyState title="No schools match" />;
      }
      return (
        <ul className="space-y-2.5">
          {data.schools.map((school) => (
            <li key={school.id}>
              <SchoolCard school={school} />
            </li>
          ))}
        </ul>
      );

    case 'school-detail':
      return (
        <div className="space-y-2.5">
          <SchoolCard school={data.school} />
          {data.rows.length === 0 ? (
            <p className="text-xs text-ink-500">
              No rounds recorded for {data.school.name} yet.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {data.rows.slice(0, 4).map((row) => (
                <li key={row.roundId}>
                  <DeadlineCard row={row} />
                </li>
              ))}
            </ul>
          )}
        </div>
      );

    case 'compare':
      return (
        <div className="space-y-2.5">
          {data.schools.map((school) => (
            <div key={school.id} className="space-y-2">
              <p className="text-2xs font-semibold text-ink-700">{school.name}</p>
              {data.rows.filter((r) => r.schoolId === school.id).slice(0, 3).map((row) => (
                <DeadlineCard key={row.roundId} row={row} />
              ))}
            </div>
          ))}
        </div>
      );

    case 'help':
      return (
        <ul className="space-y-1 text-xs text-ink-600">
          <li>• Deadlines for a school, region, country or month</li>
          <li>• Schools filtered by region or programme type</li>
          <li>• A side-by-side comparison of two schools</li>
          <li className="pt-1 text-ink-500">
            I only report what schools have published. Nothing is inferred.
          </li>
        </ul>
      );

    case 'unknown':
      return (
        <div>
          <p className="text-xs text-ink-600">
            I could not turn that into a search, so I would rather not guess.
            Try one of these:
          </p>
          <ul className="mt-2 space-y-1.5">
            {data.suggestions.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => onPick(s)}
                  className="w-full rounded-lg border border-ink-200 px-3 py-2 text-left text-xs text-ink-700 hover:border-ink-400 hover:bg-ink-50"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      );
  }
}

function SparkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1.5l1.6 4.2 4.4 1.5-4.4 1.5L8 13l-1.6-4.3L2 7.2l4.4-1.5L8 1.5z"
        fill="currentColor"
      />
    </svg>
  );
}
