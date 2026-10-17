import { Renderer } from '@openuidev/react-lang';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import GenUiErrorBoundary from './GenUiErrorBoundary';
import { genUiLibrary } from './library';
import './genui.css';

type GenStatus = 'idle' | 'generating' | 'done' | 'error';

const ENDPOINT = '/api/genui/generate';
const MAX_PROMPT_CHARS = 8000;
const PROMPT_RULE = `Enter a prompt of 1 to ${MAX_PROMPT_CHARS} characters.`;
const DETAIL_CHARS = 300;
const SECRET_VALUE = /\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9]{12,}|xox[abprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16})\b/g;

/** Used when the server's JSON error body is missing or unreadable. */
const FALLBACK_MESSAGES: Record<number, string> = {
  400: PROMPT_RULE,
  409: 'The configured model provider cannot generate UI.',
  503: 'The model is not configured on the server.',
};

/** A failure already described for the user. Anything else is a network or stream error. */
class GenUiRequestError extends Error {}

/** Returns the server's `error` text, redacted and clipped. Null for any other body. */
function serverErrorField(raw: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || !('error' in parsed)) return null;
  const message = parsed.error;
  if (typeof message !== 'string' || message.trim() === '') return null;
  const clean = message.trim().replace(SECRET_VALUE, '[redacted]');
  return clean.length > DETAIL_CHARS ? `${clean.slice(0, DETAIL_CHARS)}…` : clean;
}

async function failureMessage(response: Response): Promise<string> {
  const fallback = FALLBACK_MESSAGES[response.status] ?? `The request failed (HTTP ${response.status}).`;
  let raw: string;
  try {
    raw = await response.text();
  } catch {
    return fallback;
  }
  return serverErrorField(raw) ?? fallback;
}

function statusLine(status: GenStatus, hasOutput: boolean, errorMessage: string | null): string {
  switch (status) {
    case 'idle':
      return hasOutput ? 'Stopped. Partial output kept.' : 'Idle.';
    case 'generating':
      return 'Generating…';
    case 'done':
      return 'Done.';
    case 'error':
      return errorMessage ?? 'Generation failed.';
  }
}

export default function GenUiPanel() {
  const [prompt, setPrompt] = useState('');
  const [output, setOutput] = useState('');
  const [status, setStatus] = useState<GenStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actions, setActions] = useState<string[]>([]);

  const controllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const promptId = useId();
  const outputHeadingId = useId();
  const actionsHeadingId = useId();

  // Abort any in-flight request when the panel unmounts.
  useEffect(() => {
    return () => controllerRef.current?.abort();
  }, []);

  const run = async (text: string) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setOutput('');
    setActions([]);
    setErrorMessage(null);
    setStatus('generating');

    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/plain' },
        body: JSON.stringify({ prompt: text }),
        signal: controller.signal,
      });
      if (!response.ok) throw new GenUiRequestError(await failureMessage(response));
      if (!response.body) throw new GenUiRequestError('The server sent an empty response.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setOutput(accumulated);
      }
      accumulated += decoder.decode();
      setOutput(accumulated);
      setStatus('done');
    } catch (error) {
      // A newer request replaced this one; its state now belongs to the newer request.
      if (controllerRef.current !== controller) return;
      // Stop or unmount aborted the request. Keep whatever streamed so far.
      if (controller.signal.aborted) {
        setStatus('idle');
        return;
      }
      setErrorMessage(
        error instanceof GenUiRequestError
          ? error.message
          : 'Could not complete the request. Check the connection and try again.',
      );
      setStatus('error');
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === 'generating') return;
    const text = prompt.trim();
    if (text === '' || text.length > MAX_PROMPT_CHARS) {
      setErrorMessage(PROMPT_RULE);
      setStatus('error');
      return;
    }
    void run(text);
  };

  const handleStop = () => {
    controllerRef.current?.abort();
    // The Stop button leaves the DOM once streaming ends, so move focus to the prompt.
    textareaRef.current?.focus();
  };

  const generating = status === 'generating';
  const canGenerate = !generating && prompt.trim() !== '';

  return (
    <div className="genui-panel">
      <form className="genui-form" onSubmit={handleSubmit}>
        <label htmlFor={promptId} className="genui-label">
          Prompt
        </label>
        <textarea
          id={promptId}
          ref={textareaRef}
          className="genui-textarea"
          rows={4}
          maxLength={MAX_PROMPT_CHARS}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
        <div className="genui-controls">
          {generating && (
            <button type="button" className="genui-button genui-button-secondary" onClick={handleStop}>
              Stop
            </button>
          )}
          <button type="submit" className="genui-button" disabled={!canGenerate}>
            Generate
          </button>
        </div>
      </form>

      <p
        role="status"
        aria-live="polite"
        aria-busy={generating}
        className="genui-status"
        data-status={status}
      >
        {statusLine(status, output !== '', errorMessage)}
      </p>

      <section className="genui-output" aria-labelledby={outputHeadingId}>
        <h2 id={outputHeadingId} className="genui-heading">
          Preview
        </h2>
        <div className="genui-canvas">
          {output === '' ? (
            <p className="genui-muted">The generated UI appears here.</p>
          ) : (
            <GenUiErrorBoundary source={output}>
              <Renderer
                response={output}
                library={genUiLibrary}
                isStreaming={generating}
                onAction={(event) => setActions((current) => [...current, event.humanFriendlyMessage || event.type])}
              />
            </GenUiErrorBoundary>
          )}
        </div>
      </section>

      {actions.length > 0 && (
        <section className="genui-actions" aria-labelledby={actionsHeadingId}>
          <h2 id={actionsHeadingId} className="genui-heading">
            Actions
          </h2>
          <ol>
            {actions.map((text, index) => (
              <li key={index}>{text}</li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
