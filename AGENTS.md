# AGENTS.md — SpeakSmart Project Context

This file is for AI agents and teammates jumping into any part of the codebase. Read this first.

---

## What This Project Is

**SpeakSmart** — a 48-hour hackathon app that coaches public speakers.

Flow:
1. User picks a video file on the home screen
2. Frontend POSTs it to the Python FastAPI backend → gets back a `jobId`
3. Backend pipeline (async, FastAPI BackgroundTasks):
   - Uploads video to Supabase Storage
   - Downloads and extracts audio with ffmpeg (mono 16kHz MP3)
   - Transcribes with local Whisper model (`faster-whisper`, word-level timestamps, 4-8x faster than openai-whisper, free)
   - Detects filler words, pace issues, and repetition from Whisper word array
   - Sends indexed transcript to local LLM via Ollama (free, no API key)
   - Merges all feedback events, stores results in Supabase
4. Frontend polls until done, then shows: annotated video player + coaching dashboard

---

## Repo Layout

```
git-happens/
├── presentation-coach-app/     # React Native Expo frontend (SDK 54)
│   ├── app/                    # Expo Router screens
│   │   ├── _layout.tsx         # Root layout — wraps AccessibilityProvider, imports global.css
│   │   ├── index.tsx           # Upload screen (/)
│   │   ├── analyzing/
│   │   │   └── [jobId].tsx     # Polling/progress screen
│   │   └── results/
│   │       └── [jobId].tsx     # Annotated player + dashboard
│   ├── components/
│   │   ├── VideoUploader.native.tsx   # expo-document-picker
│   │   ├── VideoUploader.web.tsx      # <input type="file">
│   │   └── AnnotatedPlayer/
│   │       ├── index.tsx        # Video player (expo-av native, <video> web)
│   │       ├── TimelineBar.tsx  # Clickable marker dots + progress line
│   │       └── FeedbackPopup.tsx # Slide-up coaching popup
│   ├── contexts/
│   │   └── AccessibilityContext.tsx  # High-contrast toggle
│   ├── lib/
│   │   └── api.ts              # submitVideo() + getResults() fetch wrappers
│   ├── constants/
│   │   ├── colors.ts           # Normal + high-contrast palettes
│   │   └── theme.ts            # Existing theme (light/dark)
│   ├── __mocks__/
│   │   └── results.json        # Sample results object for local development
│   ├── global.css              # NativeWind Tailwind entry
│   ├── tailwind.config.js
│   └── babel.config.js
│
├── backend/                     # Python FastAPI backend (extended from existing scaffold)
│   ├── main.py                  # FastAPI app + all routes (existing + new /api/analyze, /api/results)
│   ├── job_runner.py            # New: async pipeline (ffmpeg → Whisper → filler/pace/rep → Claude → Supabase)
│   ├── requirements.txt         # Python dependencies
│   └── .env                    # Server-side secrets (never commit)
│
├── .env.example                 # Documents all required env vars
├── README.md
└── AGENTS.md                   # This file
```

---

## Supabase Schema

### Storage
- Bucket name: `videos` (private, no public access)
- File path convention: `uploads/{jobId}.mp4`

### Table: `jobs`

```sql
create table jobs (
  id              uuid primary key default gen_random_uuid(),
  status          text not null default 'pending',  -- 'pending' | 'processing' | 'done' | 'error'
  video_path      text,
  results         jsonb,
  error_message   text,
  created_at      timestamptz not null default now()
);
```

---

## API Contract

Backend runs on port **8000** (`uvicorn main:app --port 8000`).

### `POST /api/analyze`
- Body: `multipart/form-data` with field `video` (video file)
- Response: `{ "jobId": string }`
- Side effect: uploads video to Supabase Storage, inserts job row, fires async background pipeline

### `GET /api/results/{job_id}`
- Response (pending/processing): `{ "status": "pending" | "processing" }`
- Response (done): `{ "status": "done", "results": ResultsObject, "videoUrl": string }`
- Response (error): `{ "status": "error", "error_message": string }`
- `videoUrl` is a Supabase signed URL expiring in 1 hour

### Results Object Shape

```ts
{
  transcript: Array<{ word: string; start: number; end: number; index: number }>;
  duration: number;
  feedbackEvents: Array<{
    id: string;          // uuid
    timestamp: number;   // seconds into video
    type: "filler_word" | "pace" | "repetition" | "weak_language" | "confidence" | "grammar" | "content";
    severity: "low" | "medium" | "high";
    title: string;
    message: string;
    wordIndex: number;
  }>;
  scores: {
    clarity: number;            // 1-10
    pace_consistency: number;
    confidence_language: number;
    content_structure: number;
    filler_word_density: number;
  };
  strengths: string[];
  improvements: Array<{ title: string; detail: string; actionable_tip: string }>;
  structure: { has_clear_intro: boolean; has_clear_conclusion: boolean; body_feedback: string };
  stats: { total_filler_words: number; avg_wpm: number; total_words: number; flagged_sentences: number };
}
```

---

## Existing Code to Reuse (`backend/main.py`)

These functions are already implemented and should be kept/reused as-is:
- `FILLER_WORDS` set — extend with `'right'`, `'kind of'`, `'sort of'`
- `tokenize(text)` — word tokenization
- `count_stutter_events(words)` — consecutive repeated words
- `classify_pace(wpm)` — slow/good/fast classification
- `ensure_supported_media(upload)` — validates audio/video content type
- `save_upload_to_temp(upload)` — saves UploadFile to `/tmp`, returns `Path`
- `get_whisper_model()` with `@lru_cache` — rewrite for `faster-whisper` (`WhisperModel(size, device="cpu", compute_type="int8")`)
- FastAPI app instance, CORS middleware setup

The old `POST /analyze` endpoint (synchronous, no Supabase) can be kept for backward compatibility or removed.

---

## Frontend Route Map

| Route | File | Purpose |
|-------|------|---------|
| `/` | `app/index.tsx` | File picker + upload trigger |
| `/analyzing/[jobId]` | `app/analyzing/[jobId].tsx` | Polling + animated progress |
| `/results/[jobId]` | `app/results/[jobId].tsx` | Player + full dashboard |

---

## Key Conventions

### Platform-specific components
Use `.native.tsx` / `.web.tsx` file suffixes. Expo Router resolves them automatically — import without the suffix:
```ts
import VideoUploader from '@/components/VideoUploader'; // resolves .native or .web
```

### Styling
NativeWind (Tailwind classes via `className` prop). Avoid `StyleSheet.create` except for dynamic values that can't be expressed as static classes.

### Accessibility — required for judging
- Every `Pressable` and `TouchableOpacity` must have `accessibilityLabel` and `accessibilityRole`
- Never convey info through color alone — colored word chips also need `accessibilityLabel` like `"filler word: um"`
- Font sizes: always multiply by `PixelRatio.getFontScale()`, never hardcode pixel values
- Web video: `tabIndex={0}`, space = play/pause, arrow keys = seek ±5s

### Environment variables
- `EXPO_PUBLIC_*` prefix = safe for frontend bundle (Expo reads from `.env.local`)
- All other secrets (Supabase service key, OpenAI, Anthropic) = `backend/.env` only, never in frontend

### FormData on native vs web
```ts
// native
formData.append('video', { uri: file.uri, name: file.name, type: file.mimeType ?? 'video/mp4' } as any);
// web
formData.append('video', file); // raw File object
```
Use `Platform.OS === 'web'` to branch.

---

## Environment Variables

No paid API keys required. Both Whisper and the LLM run locally for free.

### `backend/.env`
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...        # service_role key, NOT anon key — only external service needed
CORS_ALLOW_ORIGINS=http://localhost:8081
PORT=8000
WHISPER_MODEL=base                 # tiny | base | small | medium
OLLAMA_MODEL=qwen2.5:7b            # must be pulled first: ollama pull qwen2.5:7b
```

### `presentation-coach-app/.env.local`
```
EXPO_PUBLIC_API_URL=http://localhost:8000
```

---

## Python Dependencies (`backend/requirements.txt`)

```
fastapi
uvicorn[standard]
python-multipart
python-dotenv
faster-whisper      # Local Whisper — 4-8x faster than openai-whisper, same accuracy, free
ollama              # Local LLM client — free, no API key (requires Ollama app installed)
supabase            # Supabase Python client
ffmpeg-python       # ffmpeg wrapper for audio extraction
```

Note: `openai-whisper` has been replaced by `faster-whisper`. `opencv-python` and `mediapipe` removed.
Do NOT add `openai` or `anthropic` — no paid API calls.

**faster-whisper API is different from openai-whisper:**
- Returns a generator (not a list) — must consume in the same thread
- Word objects are NamedTuples: `w.word`, `w.start`, `w.end` (not dict keys)

**One-time setup per developer:**
```bash
# 1. Install Ollama: https://ollama.com  (or: winget install Ollama.Ollama)
# 2. Pull a model (Ollama starts automatically in background):
ollama pull qwen2.5:7b    # ~4.7GB — best JSON reliability (recommended)
# or if RAM/disk is tight:
ollama pull qwen2.5:3b    # ~2GB — faster, slightly lower quality
```

---

## Build Order

Work in this sequence — do not skip ahead:

1. **Phase 0** — This file + README (done)
2. **Phase 1** — Scaffold: update `backend/requirements.txt`, add Expo packages, NativeWind setup, delete `app/(tabs)/`
3. **Phase 2** — Backend: new `POST /api/analyze` + `GET /api/results/{job_id}` routes in `main.py`, full `job_runner.py` pipeline
4. **Phase 3** — Upload screen (`app/index.tsx`) + VideoUploader components + `lib/api.ts`
5. **Phase 4** — Analyzing screen with polling + animated spinner
6. **Phase 5** — AnnotatedPlayer (player + TimelineBar + FeedbackPopup)
7. **Phase 6** — Results screen + full dashboard (stats, radar chart, transcript chips)
8. **Phase 7** — Accessibility: AccessibilityContext, high-contrast palette, font scaling, keyboard nav

---

## Running Locally

```bash
# Terminal 1 — backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Terminal 2 — frontend
cd presentation-coach-app
npx expo start --web
```

Verify: `GET http://localhost:8000/health` → `{ "status": "ok" }`
