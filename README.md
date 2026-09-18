# SyntaxGraph

SyntaxGraph is a full-stack syntactic-graphing workspace. It preserves an original text's meaning while rebuilding each sentence with an abstract structure extracted from a real sentence in a separate style sample. The server requires a sentence-level audit trail and runs an independent semantic validation before any generated result is returned.

## What is implemented

- Five-area responsive React workspace with uploads, drag/drop, counts, loading/error states, and duplicate-submit protection.
- Persistent, searchable style-sample library with full text, author, name, word count, date, selection, editing, and deletion.
- Sentence-by-sentence structured transformations with proposition inventories, exact source sentences, neutral templates, transformed sentences, and per-sentence validation.
- Independent meaning reports, correction/regeneration, limited retransformation, and conservative naturalization.
- Enforced 1,000-word request limit, automatic document sections, 3,000-word sample truncation, and the 2× style-sample rule.
- Server adapters for Anthropic, OpenAI, DeepSeek, Grok, Perplexity (default), and Venice AI.
- Real server-side GPTZero calls, debounced for edited text and immediate for generated text. Missing keys and request failures are displayed honestly.
- SQLite persistence for style samples and the last 50 transformation-history entries.

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- At least one supported AI provider API key

## Local setup

```bash
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to the Express server on port 3001.

For a production-style local run:

```bash
npm run build
npm run server
```

Serve the generated `dist/` directory with your preferred static host and proxy `/api` to the Express process. API keys belong only in the server environment and are never embedded in the Vite bundle.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `PORT` | Express port; defaults to `3001` |
| `DATABASE_PATH` | SQLite path; defaults to `./data/syntaxgraph.db` |
| `REQUEST_TIMEOUT_MS` | Provider request timeout; defaults to `90000` |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Anthropic credentials/model |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | OpenAI credentials/model |
| `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL` | DeepSeek credentials/model |
| `GROK_API_KEY`, `GROK_MODEL` | xAI Grok credentials/model |
| `PERPLEXITY_API_KEY`, `PERPLEXITY_MODEL` | Perplexity credentials/model (default provider) |
| `VENICE_API_KEY`, `VENICE_MODEL` | Venice AI credentials/model |
| `GPTZERO_API_KEY` | GPTZero document prediction API key |

Model defaults are listed in `.env.example` and may be changed without rebuilding the frontend.

## Database

No database server or migration command is required. On first server start, SQLite creates the configured database and both tables automatically. The default file is `data/syntaxgraph.db`; mount or back up the `data/` directory in deployment to preserve the sample library and history across restarts.

## Workflow

1. Add original text in Box A. Files over 1,000 words are split into ordered sections at paragraph/sentence boundaries.
2. Save or select a style sample in Box C. It must contain at least twice the active input section's word count.
3. Optionally add source material in Box D. It is ignored unless Box E explicitly instructs the engine to use Box D.
4. Choose a configured provider and transform. The server retries up to three times and refuses to return a result that fails the independent validator.
5. Open **Details** to inspect each actual sample sentence, abstract template, meaning inventory, and transformed sentence.
6. Run **Meaning Identity** for a separate audit that never receives the style sample. Failed reports can correct only the defective result and validate again.

## File extraction

TXT, PDF, legacy DOC, and DOCX files are extracted server-side using format-specific parsers.

## Tests

```bash
npm test
npm run build
```

The test suite covers non-importation of sample content, factual preservation, length enforcement, sentence traceability, document splitting, inadequate samples, naturalization validation, server-only secrets, persistence, and honest external-service failures.
