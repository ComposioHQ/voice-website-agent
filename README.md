## Voice Website Agent

Speak your intent. The agent transcribes your voice, plans with GPT‑5, executes tools to update a live HTML preview, and replies by voice.

### Features
- Modular pipeline: STT → Agent (with tools) → TTS
- Progressive UX: chat updates after each stage
- Composio tool `WRITE_FULL_HTML_PREVIEW` to write `public/preview.html`
- Composio Notion tools: `NOTION_FETCH_DATA`, `NOTION_FETCH_BLOCK_CONTENTS`
- Next.js App Router (Node runtime)

### Quickstart
1) Install
```bash
npm install
```

2) Environment
Create `.env.local`:
```bash
OPENAI_API_KEY=your_openai_api_key
COMPOSIO_API_KEY=your_composio_api_key
```

3) Run
```bash
npm run dev
```
Open http://localhost:3000 and click the mic.

### API routes
- POST `/api/stt`
  - Request: multipart form with `audio` (e.g., `audio/webm`)
  - Response: `{ transcript: string }`
- POST `/api/agent`
  - Request: JSON `{ text: string }`
  - Response: `{ text: string }`
- POST `/api/tts`
  - Request: JSON `{ text: string }`
  - Response: `{ audioBase64: string, mimeType: string }`
- POST `/api/voice-chat` (orchestrator)
  - Request: multipart form with `audio`
  - Response: `{ transcript, text, audioBase64, mimeType }`

### Architecture
- `app/api/_lib/agentState.ts`: minimal global message state + OpenAI message adapter
- `app/api/_lib/openaiClient.ts`: OpenAI client factory
- `app/api/_lib/composioTools.ts`: Composio setup and `ensureToolsRegistered()`
- `app/api/_lib/stt.ts`: Whisper transcription
- `app/api/_lib/agent.ts`: GPT‑5 reasoning, tool calls, summary + voice‑friendly rewrite
- `app/api/_lib/tts.ts`: Text‑to‑speech with length‑safe condensation

Notes
- Global state is in‑memory; use persistent storage for multi‑user production.
- Tool list is intentionally small to keep behavior focused and safe.

### cURL examples
STT
```bash
curl -X POST http://localhost:3000/api/stt \
  -F "audio=@input.webm;type=audio/webm"
```

Agent
```bash
curl -X POST http://localhost:3000/api/agent \
  -H "Content-Type: application/json" \
  -d '{"text":"Create a landing page with a hero and CTA"}'
```

TTS
```bash
curl -X POST http://localhost:3000/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Your page is ready."}'
```

### Composio
 - GitHub: [Composio](https://github.com/composiohq/composio)
 - Website: [composio.dev](https://composio.dev)

### Composio + Notion setup
1) Create API key
   - Go to the Composio platform dashboard and create an API key.
   - Add it to `.env.local` as `COMPOSIO_API_KEY` (see Environment section above).

2) Connect Notion
   - In the Composio platform, Add Notion to your project.
   - Complete the Notion OAuth flow. Share the pages/databases you want the agent to read with the Composio integration so it has access.
   - Ensure this Notion connection is available as the default connection (aka default user/connection). The agent will use the first connected account by default;

3) Tools used
   - `NOTION_FETCH_DATA`: fetches metadata/data for pages or databases.
   - `NOTION_FETCH_BLOCK_CONTENTS`: fetches the block contents of a page.

