# Voice Transcription & Summary App

A web app that records or accepts audio files, transcribes them using OpenAI Whisper, and generates AI-powered summaries.

## Features

- **Record audio** directly in the browser using your microphone
- **Upload audio files** (WAV, MP3, WebM, OGG, FLAC — up to 25MB)
- **Transcribe** audio to text using OpenAI Whisper
- **Summarize** transcriptions with GPT, including key points and action items
- **Copy** transcription or summary to clipboard
- Dark-themed, responsive UI

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file with your OpenAI API key:
   ```bash
   cp .env.example .env
   # Edit .env and add your key
   ```

3. Start the server:
   ```bash
   npm start
   ```

4. Open http://localhost:3000 in your browser.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/transcribe` | Upload audio file for transcription (multipart form, field: `audio`) |
| POST | `/api/summarize` | Summarize text (JSON body: `{ "text": "..." }`) |

## Tech Stack

- **Backend**: Node.js, Express, Multer
- **Frontend**: Vanilla HTML/CSS/JS, Web Audio API
- **AI**: OpenAI Whisper (transcription), GPT-4o-mini (summarization)
