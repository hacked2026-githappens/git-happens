# AGENTS.md — SpeakSmart Project Context

This file is for AI agents and teammates jumping into any part of the codebase. Read this first.

---

## What This Project Is

**SpeakSmart** — a 48-hour hackathon app that coaches public speakers.

Flow:
1. User picks a video file on the home screen
2. Frontend POSTs it to the Express backend → gets back a `jobId`
3. Backend pipeline (async, fire-and-forget):
   - Extracts audio with ffmpeg
   - Transcribes with OpenAI Whisper (word-level timestamps)
   - Detects filler words, pace issues, and repetition from Whisper output
   - Sends indexed transcript to Anthropic Claude for deep analysis
   - Merges all feedback events, stores results in Supabase
4. Frontend polls until done, then shows: annotated video player + coaching dashboard

---

## Repo Layout

```
git-happens/
├── presentation-coach-app/     # React Native Expo frontend (SDK 54)
│   ├── app/                    # Expo Router screens
│   │   ├── _layout.tsx         # Root layout — wraps AccessibilityProvider
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
│   ├── global.css              # NativeWind Tailwind entry
│   ├── tailwind.config.js
│   └── babel.config.js
│
├── api-server/                  # Express.js backend
│   ├── index.js                 # Routes: POST /api/analyze, GET /api/results/:jobId
│   ├── jobRunner.js             # Async pipeline: ffmpeg → Whisper → Claude → Supabase
│   ├── package.json
│   └── .env                    # Server-side secrets (never commit)
│
├── backend/                     # IGNORE — legacy Python FastAPI, not used
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

### `POST /api/analyze`
- Body: `multipart/form-data` with field `video` (video file)
- Response: `{ jobId: string }`
- Side effect: uploads video to Supabase Storage, inserts job row, fires async pipeline

### `GET /api/results/:jobId`
- Response (pending/processing): `{ status: "pending" | "processing" }`
- Response (done): `{ status: "done", results: ResultsObject, videoUrl: string }`
- Response (error): `{ status: "error", error_message: string }`
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
- All other secrets (Supabase service key, OpenAI, Anthropic) = `api-server/.env` only, never in frontend

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

### `api-server/.env`
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...        # service_role key, NOT anon key
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
PORT=3001
```

### `presentation-coach-app/.env.local`
```
EXPO_PUBLIC_API_URL=http://localhost:3001
```

---

## Build Order

Work in this sequence — do not skip ahead:

1. **Phase 0** — This file + README (done)
2. **Phase 1** — Scaffold: `api-server/` skeleton, add Expo packages, NativeWind setup, delete `app/(tabs)/`
3. **Phase 2** — Backend: `POST /api/analyze`, `GET /api/results/:jobId`, `jobRunner.js` full pipeline
4. **Phase 3** — Upload screen (`app/index.tsx`) + VideoUploader components + `lib/api.ts`
5. **Phase 4** — Analyzing screen with polling + animated spinner
6. **Phase 5** — AnnotatedPlayer (player + TimelineBar + FeedbackPopup)
7. **Phase 6** — Results screen + full dashboard (stats, radar chart, transcript chips)
8. **Phase 7** — Accessibility: AccessibilityContext, high-contrast palette, font scaling, keyboard nav

---

## Running Locally

```bash
# Terminal 1 — backend
cd api-server && node index.js

# Terminal 2 — frontend
cd presentation-coach-app && npx expo start --web
```

Verify: `GET http://localhost:3001/health` → `{ "status": "ok" }`
