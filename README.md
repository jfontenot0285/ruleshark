# RuleShark

Web app that reviews tabletop / card game rules for contradictions, loops, ambiguities, and gaps, then suggests concrete rewrites. You can also run a short multi-agent “Test play” simulation against the rules.

**Core loop:** upload or paste → analyze on the fly → keep the fixes you want → download an updated rules file. There is no account system or server-side persistence; kept choices can live in the browser (`localStorage`) for this session’s workflow.

## How it works

1. **Upload or paste** rules (PDF, DOCX, TXT, or plain text).
2. The backend **extracts text** and sends it to **OpenAI** with a structured JSON schema.
3. The UI shows **suggestions** (diff + rationale). Keep what you want, then download.
4. **Test play** runs a sanity check, then a bounded multi-agent simulation (referee + players).

| Surface | URL (local) | Notes |
|--------|-------------|--------|
| App | http://localhost:5173 | Landing + analyze (`/#try`) |
| API | http://localhost:4000 | Vite proxies `/api` → backend |

## Architecture

```mermaid
flowchart LR
  subgraph Client["Frontend (Vite + React)"]
    UI["Landing / Try"]
    Local["Browser localStorage<br/>kept suggestions"]
  end

  subgraph LocalDev["Local proxy"]
    Proxy["Vite /api → :4000"]
  end

  subgraph API["Backend (Express)"]
    Routes["Routes<br/>analyze · simulate"]
    Services["Services<br/>extractText · analyzeRules<br/>sanityCheck · simulation"]
  end

  subgraph External["External"]
    OpenAI["OpenAI API"]
  end

  UI --> Proxy
  UI --> Local
  Proxy --> Routes
  Routes --> Services
  Services --> OpenAI
```

```mermaid
sequenceDiagram
  actor User
  participant UI as React UI
  participant API as Express API
  participant LLM as OpenAI

  User->>UI: Upload / paste rules
  UI->>API: POST /api/analyze/...
  API->>API: Extract + validate text
  API->>LLM: Structured JSON analysis
  LLM-->>API: Suggestions
  API-->>UI: Diff + rationale
  User->>UI: Keep changes
  UI->>UI: Optional localStorage
  User->>UI: Download updated rules

  User->>UI: Test play
  UI->>API: POST /api/simulate
  API->>LLM: Sanity check (+ optional sim)
  LLM-->>API: Result
  API-->>UI: Transcript / blockers
```

### Deploy shape (Vercel)

```mermaid
flowchart TB
  Browser["Browser"]
  subgraph Vercel["Vercel"]
    FE["frontend service<br/>Vite SPA"]
    BE["backend service<br/>Express"]
  end
  OpenAI["OpenAI"]

  Browser -->|"/"| FE
  Browser -->|"/api/*"| BE
  BE --> OpenAI
```

## Repo layout

```
ruleshark/
├── frontend/          React + Vite SPA
├── backend/           Express API (ESM)
│   ├── src/routes/    analyze, simulate
│   ├── src/services/  extractText, analyzeRules, sanityCheck, simulation
│   └── .env.example
└── vercel.json        Frontend + backend multi-service deploy
```

## Prerequisites

- Node.js 22+ recommended
- OpenAI API key for real analysis (or `MOCK_ANALYZE=true` for UI-only)

## Local setup

```powershell
npm install --prefix backend
npm install --prefix frontend
```

Copy env templates and fill in secrets:

```powershell
copy backend\.env.example backend\.env
```

`backend/.env` (typical local values):

```env
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
MOCK_ANALYZE=false
```

### Run

Two terminals from the repo root:

```powershell
npm run dev:backend
npm run dev:frontend
```

- UI: http://localhost:5173  
- API health: http://localhost:4000/api/health  

Without `OPENAI_API_KEY`, set `MOCK_ANALYZE=true` (or leave the key empty — mock turns on automatically unless `MOCK_ANALYZE=false`).

## Main API routes

| Method | Path | Purpose |
|--------|------|--------|
| GET | `/api/health` | Liveness |
| POST | `/api/analyze/upload`, `/api/analyze/paste` | Analyze rules |
| POST | `/api/analyze/validate` | Preflight upload check |
| POST | `/api/simulate` | Sanity check + Test play |

## Deploy (Vercel)

`vercel.json` runs the Express backend and Vite frontend as two services and rewrites `/api/*` to the backend. Set production env on Vercel:

- `OPENAI_API_KEY` / `OPENAI_MODEL`
- `CLIENT_ORIGIN` (your deployment URL), or leave unset to reflect the request Origin
- `MOCK_ANALYZE=false` for real LLM calls

## Sample rules

Under `frontend/public/samples/` there are clean and “with-issues” example rule files you can download from the UI for demos.
