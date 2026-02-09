const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const OpenAI = require("openai");

require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit (OpenAI Whisper max)
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "audio/webm",
      "audio/wav",
      "audio/mp3",
      "audio/mpeg",
      "audio/mp4",
      "audio/ogg",
      "audio/flac",
      "video/webm",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio format: ${file.mimetype}`));
    }
  },
});

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to your .env file or environment variables."
    );
  }
  return new OpenAI({ apiKey });
}

// POST /api/transcribe - Transcribe audio file using OpenAI Whisper
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No audio file uploaded" });
  }

  const filePath = req.file.path;

  try {
    const openai = getOpenAIClient();

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
      response_format: "verbose_json",
    });

    res.json({
      text: transcription.text,
      language: transcription.language,
      duration: transcription.duration,
      segments: transcription.segments,
    });
  } catch (err) {
    console.error("Transcription error:", err);
    const message =
      err.message || "Transcription failed. Check your API key and try again.";
    res.status(500).json({ error: message });
  } finally {
    fs.unlink(filePath, () => {});
  }
});

// POST /api/summarize - Summarize transcribed text using GPT
app.post("/api/summarize", async (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return res.status(400).json({ error: "No text provided to summarize" });
  }

  try {
    const openai = getOpenAIClient();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert summarizer. Given a transcript of a voice recording, produce a clear and concise summary. Include:
1. A brief one-line overview
2. Key points (as bullet points)
3. Any action items or decisions mentioned

Keep the summary concise but capture all important information.`,
        },
        {
          role: "user",
          content: `Please summarize this transcript:\n\n${text}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 1024,
    });

    const summary = completion.choices[0].message.content;
    res.json({ summary });
  } catch (err) {
    console.error("Summarization error:", err);
    const message =
      err.message || "Summarization failed. Check your API key and try again.";
    res.status(500).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`Voice Transcription & Summary app running at http://localhost:${PORT}`);
});
