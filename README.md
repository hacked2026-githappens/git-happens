# SpeakSmart — AI-Powered Public Speaking Coach

SpeakSmart is a hackathon app that helps people become better public speakers. Upload a recorded video of your presentation and get instant AI-powered coaching: timestamped feedback on filler words, pacing, and weak language; an interactive annotated video player with a marker timeline; and a full dashboard with scores, strengths, and actionable improvements.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React Native + Expo SDK 54, Expo Router, NativeWind (Tailwind) |
| Backend | Python FastAPI + Uvicorn |
| Transcription | Local Whisper (`faster-whisper`) with word-level timestamps — free |
| Speech Analysis | Local LLM via Ollama (`qwen2.5:7b`) — free, no API key |
| Non-verbal Analysis | MediaPipe Holistic (hand landmark tracking) + OpenCV (frame extraction) |
| Storage + DB | Supabase Storage (`videos` bucket) + Supabase Postgres (`jobs` table) |
| Audio extraction | ffmpeg-python |

---

## Repo Structure

```
git-happens/
├── presentation-coach-app/   # React Native Expo frontend
├── backend/                  # Python FastAPI backend
├── AGENTS.md                 # Context for AI agents and teammates
└── README.md
```

---

## Setup

### 1. Environment variables

Copy the example file — only Supabase credentials are required:

```bash
cp .env.example backend/.env
# Fill in SUPABASE_URL and SUPABASE_SERVICE_KEY only
```

Also create `presentation-coach-app/.env.local`:
```
EXPO_PUBLIC_API_URL=http://localhost:8000
```

No OpenAI or Anthropic API keys needed — Whisper and the LLM run locally for free.

### 2. Supabase

In your Supabase project:

- Create a **Storage bucket** named `videos` (private)
- Create a **table** named `jobs` — see [AGENTS.md](./AGENTS.md#supabase-schema) for the full schema

### 3. Install Ollama (one-time)

```bash
# Download from https://ollama.com (or: winget install Ollama.Ollama)
ollama pull qwen2.5:7b   # ~4.7GB, best JSON output — or: qwen2.5:3b (~2GB) if tight on space
```

### 4. Run the backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# API available at http://localhost:8000
```

### 5. Run the frontend

```bash
cd presentation-coach-app
npx expo install   # installs all deps
npx expo start --web      # web
npx expo start --ios      # iOS simulator
npx expo start --android  # Android emulator
```

---

## How It Works

1. User uploads a video file on the home screen
2. Backend receives the video, stores it in Supabase, and returns a `jobId` immediately
3. A background job extracts audio, transcribes it with Whisper, and simultaneously analyzes hand movements via MediaPipe — then runs LLM coaching analysis via Ollama
4. Frontend polls `/api/results/{jobId}` every 2 seconds until the job is done
5. Results screen shows an annotated video player with a marker timeline, coaching popups, and a full dashboard

---

## Features

- Annotated video player with clickable timeline markers
- Auto-popups as video plays at moments of flagged speech
- Filler word detection, pace analysis, repetition detection (via Whisper)
- Scores, strengths, improvements, and structure analysis (via Ollama)
- Hand movement / gesture energy score with coaching tips (via MediaPipe)
- Transcript with color-coded word chips — tap any word to seek the video
- Radar chart of 5 coaching dimensions
- High-contrast accessibility mode + screen reader support
