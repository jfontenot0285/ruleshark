# RuleShark — Project Overview

**Version:** documentation snapshot  
**Stack:** React + Vite frontend, Express API, OpenAI (`gpt-4o-mini`)  
**Persistence:** none on the server (optional browser `localStorage` for kept suggestions)

---

## 1. What it does

RuleShark reviews tabletop / card game rules for contradictions, loops, ambiguities, gaps, and inconsistencies, then suggests concrete rewrites. Users can also run a short multi-agent **Test play** simulation.

**Core loop (no accounts):**

1. Upload or paste rules (PDF, Word, TXT).
2. Backend extracts text and calls OpenAI with a structured JSON schema.
3. UI shows suggestions (diff + rationale). User keeps what they want.
4. Download an updated rules file.
5. Optional: Test play → sanity check → bounded simulation.

---

## 2. Architecture

```
Browser (React / Vite :5173)
    │  /api/*  (Vite proxy in local dev)
    ▼
Express API (:4000)
    ├── /api/analyze   → extractText → analyzeRules → OpenAI
    ├── /api/simulate  → sanityCheck → simulation → OpenAI
    └── Rate limits    → per-IP + global token budgets (in-memory)
    ▼
OpenAI API (gpt-4o-mini)
```

**Deploy (Vercel):** two services — Vite SPA + Express — with `/api/*` rewritten to the backend.

**Not in scope anymore:** MongoDB, user accounts, JWT auth, saved rules library.

---

## 3. Local run

```powershell
npm install --prefix backend
npm install --prefix frontend
copy backend\.env.example backend\.env   # then set OPENAI_API_KEY
npm run dev:backend
npm run dev:frontend
```

- UI: http://localhost:5173  
- API: http://localhost:4000/api/health  

---

## 4. Environment

| Variable | Purpose | Default |
|----------|---------|---------|
| `PORT` | API port | `4000` |
| `CLIENT_ORIGIN` | CORS allowed origin(s) | `http://localhost:5173` |
| `OPENAI_API_KEY` | OpenAI key | (required for real LLM) |
| `OPENAI_MODEL` | Model id | `gpt-4o-mini` |
| `MOCK_ANALYZE` | Fake LLM responses | `true` if no key |
| `LLM_RATE_LIMIT_REQUESTS` | Max LLM calls per IP / hour | `5` |
| `LLM_RATE_LIMIT_TOKENS` | Max tokens per IP / hour | `40000` |
| `LLM_RATE_LIMIT_WINDOW_MS` | Per-IP window | `3600000` (1h) |
| `LLM_GLOBAL_TOKEN_BUDGET` | Max tokens all clients / window | `40000000` |
| `LLM_GLOBAL_TOKEN_WINDOW_MS` | Global window | ~30 days |

---

## 5. Rate limiting & cost controls

### OpenAI pricing context (`gpt-4o-mini`)

| Direction | Price |
|-----------|--------|
| Input | ~$0.15 / 1M tokens |
| Output | ~$0.60 / 1M tokens |

A **$20 / month** OpenAI hard limit is roughly:

- **~33M tokens** if spend were all output  
- **~133M tokens** if spend were all input  

RuleShark assumes a conservative **~40M tokens / 30 days** app-side budget.

### App limits (defaults)

| Limit | Default | Rationale |
|--------|---------|-----------|
| Per IP requests | **5 / hour** | Blocks spam; enough for normal demos |
| Per IP tokens | **40,000 / hour** | One IP at max ≈ **28.8M tokens/mo** — under the 33M floor |
| Global tokens | **40,000,000 / 30 days** | Shared ceiling ≈ conservative $20 mix |

- Applies to: `/api/analyze/upload`, `/api/analyze/paste`, `/api/simulate/check`, `/api/simulate/run`  
- Does **not** apply to: `/api/analyze/validate` (no OpenAI call)  
- Over limit → HTTP **429** with a clear message  
- Token usage is recorded from OpenAI `usage` after each call  
- Counters are **in-memory** (reset on process restart; not shared across multiple Vercel instances)  
- **Keep the OpenAI dashboard $20 hard limit** as the real billing backstop  

---

## 6. Main API routes

| Method | Path | Purpose |
|--------|------|--------|
| GET | `/api/health` | Liveness + rate-limit summary |
| POST | `/api/analyze/validate` | Preflight file check |
| POST | `/api/analyze/upload` | Analyze uploaded rules |
| POST | `/api/analyze/paste` | Analyze pasted text |
| POST | `/api/simulate/check` | Sanity check only |
| POST | `/api/simulate/run` | Sanity check + simulation |

---

## 7. Repo layout

```
ruleshark/
├── frontend/                 React + Vite SPA
│   └── src/                  pages, components, localStorage keeps
├── backend/
│   ├── src/routes/           analyze, simulate
│   ├── src/services/         extract, analyze, sanity, simulation, ipUsage
│   ├── src/middleware/       llmRateLimit
│   └── .env.example
├── docs/                     This overview (+ PDF)
├── vercel.json
└── README.md
```

---

## 8. Libraries and tradeoffs

### Backend runtime dependencies

| Library | Role | Pros | Cons / tradeoffs |
|---------|------|------|------------------|
| **express** | HTTP API framework | Simple, ubiquitous, easy Vercel Fluid entry | You assemble middleware yourself (CORS, limits, uploads) |
| **cors** | Cross-origin headers | Tiny, standard | Must configure origins carefully in production |
| **dotenv** | Load `backend/.env` | Zero config for local secrets | Not for production secret injection (use host env) |
| **openai** | Official OpenAI SDK | Structured outputs, usage stats, maintained | Tied to OpenAI billing/quotas; needs network + key |
| **multer** | Multipart file upload | Memory storage fits short analyze jobs | Holds whole file in RAM; need size limits (15MB) |
| **pdf-parse** | Extract text from PDF | Easy Node PDF text pull | Layout/OCR-poor PDFs yield weak text; not a full PDF engine |
| **mammoth** | Extract text from DOCX | Good plain-text from Word | Not for complex layouts; `.doc` (legacy) limited |

### Frontend runtime dependencies

| Library | Role | Pros | Cons / tradeoffs |
|---------|------|------|------------------|
| **react** / **react-dom** | UI | Huge ecosystem, fits interactive modals/forms | Bundle + learning curve vs plain HTML |
| **react-router-dom** | Client routing | Simple SPA routes (`/`, `/#try`) | Overkill if you stay single-page forever |
| **vite** (dev) | Dev server + build | Fast HMR, easy `/api` proxy | Build output still needs static hosting |
| **@vitejs/plugin-react** | React transform | Official Vite React support | Dev-only concern |
| **oxlint** | Lint | Fast Rust linter | Not as deep as ESLint+plugins ecosystem |

### Intentionally **not** used (and why)

| Approach | Why skipped |
|----------|-------------|
| **MongoDB / Mongoose** | Core product is analyze → edit → download; accounts/library added cost and ops without required value |
| **JWT / bcrypt auth** | No server persistence → no login |
| **Cursor Cloud Agents / SDK** | Hits Background Agent quotas / on-demand billing; OpenAI is simpler for this JSON analyze use case |
| **Local Cursor CLI** | Great for desktop apps; awkward for a public web API |
| **Redis for rate limits** | In-memory is enough for a single Node process / demo; Redis would be better for multi-instance Vercel |

---

## 9. Operational notes

1. Set OpenAI **monthly hard limit ($20)** in the dashboard.  
2. Prefer `gpt-4o-mini` for cost.  
3. Use `MOCK_ANALYZE=true` for UI work without spend.  
4. Input is capped (`MAX_ANALYZE_CHARS` = 40,000) to bound tokens per call.  
5. For multi-instance production, move rate-limit counters to Redis/KV or rely primarily on OpenAI’s hard cap.

---

## 10. Sample files

`frontend/public/samples/` includes clean and “with-issues” rule files for demos from the UI.
