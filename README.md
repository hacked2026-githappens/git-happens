# SpeakSmart — AI-Powered Public Speaking Coach

SpeakSmart is a hackathon app that helps people become better public speakers. Upload a recorded video of your presentation and get instant AI-powered coaching: timestamped feedback on filler words, pacing, and weak language; an interactive annotated video player with a marker timeline; and a full dashboard with scores, strengths, and actionable improvements.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React Native + Expo SDK 54, Expo Router, NativeWind (Tailwind) |
| Backend | Express.js (Node.js) |
| Transcription | OpenAI Whisper API (`whisper-1`) with word-level timestamps |
| Analysis | Anthropic Claude (`claude-sonnet-4-6`) |
| Storage + DB | Supabase Storage (`videos` bucket) + Supabase Postgres (`jobs` table) |
| Audio extraction | fluent-ffmpeg |

---

## Repo Structure

```
git-happens/
├── presentation-coach-app/   # React Native Expo frontend
├── api-server/               # Express.js backend
├── backend/                  # Legacy Python FastAPI — not used
├── AGENTS.md                 # Context for AI agents and teammates
└── README.md
```

---

## Setup

### 1. Environment variables

Copy the example file and fill in your credentials:

```bash
cp .env.example api-server/.env
```

Also create `presentation-coach-app/.env.local`:
```
EXPO_PUBLIC_API_URL=http://localhost:3001
```

See `.env.example` at the repo root for all required variables.

### 2. Supabase

In your Supabase project:

- Create a **Storage bucket** named `videos` (private)
- Create a **table** named `jobs` — see [AGENTS.md](./AGENTS.md#supabase-schema) for the full schema

### 3. Run the backend

```bash
cd api-server
npm install
node index.js
# Server listens on PORT (default 3001)
```

### 4. Run the frontend

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
3. A background job extracts audio, transcribes it with Whisper, and analyzes it with Claude
4. Frontend polls `/api/results/:jobId` every 2 seconds until the job is done
5. Results screen shows an annotated video player with a marker timeline, coaching popups, and a full dashboard

---

## Features

- Annotated video player with clickable timeline markers
- Auto-popups as video plays at moments of flagged speech
- Filler word detection, pace analysis, repetition detection (via Whisper)
- Scores, strengths, improvements, and structure analysis (via Claude)
- Transcript with color-coded word chips — tap any word to seek the video
- Radar chart of 5 coaching dimensions
- High-contrast accessibility mode + screen reader support
