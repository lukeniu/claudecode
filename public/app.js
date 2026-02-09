(() => {
  // DOM elements
  const recordBtn = document.getElementById("recordBtn");
  const recordIcon = document.getElementById("recordIcon");
  const recordLabel = document.getElementById("recordLabel");
  const timer = document.getElementById("timer");
  const fileInput = document.getElementById("fileInput");
  const browseBtn = document.getElementById("browseBtn");
  const uploadArea = document.getElementById("uploadArea");
  const audioPreview = document.getElementById("audioPreview");
  const audioPlayer = document.getElementById("audioPlayer");
  const clearAudioBtn = document.getElementById("clearAudioBtn");
  const transcribeBtn = document.getElementById("transcribeBtn");
  const transcriptionResult = document.getElementById("transcriptionResult");
  const transcriptionMeta = document.getElementById("transcriptionMeta");
  const transcriptionText = document.getElementById("transcriptionText");
  const copyTranscriptBtn = document.getElementById("copyTranscriptBtn");
  const summarizeBtn = document.getElementById("summarizeBtn");
  const summaryResult = document.getElementById("summaryResult");
  const summaryText = document.getElementById("summaryText");
  const copySummaryBtn = document.getElementById("copySummaryBtn");
  const loadingOverlay = document.getElementById("loadingOverlay");
  const loadingMessage = document.getElementById("loadingMessage");

  // State
  let mediaRecorder = null;
  let audioChunks = [];
  let audioBlob = null;
  let timerInterval = null;
  let seconds = 0;
  let currentTranscription = "";

  // --- Recording ---

  recordBtn.addEventListener("click", async () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      stopRecording();
    } else {
      await startRecording();
    }
  });

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream, { mimeType: getSupportedMimeType() });
      audioChunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType;
        audioBlob = new Blob(audioChunks, { type: mimeType });
        stream.getTracks().forEach((t) => t.stop());
        showAudioPreview(audioBlob);
      };

      mediaRecorder.start(1000);
      recordBtn.classList.add("recording");
      recordIcon.textContent = "\u25A0"; // stop square
      recordLabel.textContent = "Stop Recording";
      startTimer();
    } catch (err) {
      alert("Microphone access denied. Please allow microphone access and try again.");
      console.error("getUserMedia error:", err);
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
    }
    recordBtn.classList.remove("recording");
    recordIcon.textContent = "\u25CF"; // filled circle
    recordLabel.textContent = "Start Recording";
    stopTimer();
  }

  function getSupportedMimeType() {
    const types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return "audio/webm";
  }

  // --- Timer ---

  function startTimer() {
    seconds = 0;
    updateTimerDisplay();
    timer.classList.remove("hidden");
    timerInterval = setInterval(() => {
      seconds++;
      updateTimerDisplay();
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerInterval);
  }

  function updateTimerDisplay() {
    const m = String(Math.floor(seconds / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    timer.textContent = `${m}:${s}`;
  }

  // --- File Upload ---

  browseBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  uploadArea.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  });

  uploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadArea.classList.add("dragover");
  });

  uploadArea.addEventListener("dragleave", () => {
    uploadArea.classList.remove("dragover");
  });

  uploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadArea.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  function handleFile(file) {
    if (file.size > 25 * 1024 * 1024) {
      alert("File too large. Maximum size is 25MB.");
      return;
    }
    audioBlob = file;
    showAudioPreview(file);
  }

  // --- Audio Preview ---

  function showAudioPreview(blob) {
    const url = URL.createObjectURL(blob);
    audioPlayer.src = url;
    audioPreview.classList.remove("hidden");
    transcribeBtn.disabled = false;
    // Reset downstream results
    resetTranscription();
    resetSummary();
  }

  clearAudioBtn.addEventListener("click", () => {
    audioBlob = null;
    audioPlayer.src = "";
    audioPreview.classList.add("hidden");
    transcribeBtn.disabled = true;
    timer.classList.add("hidden");
    fileInput.value = "";
    resetTranscription();
    resetSummary();
  });

  function resetTranscription() {
    currentTranscription = "";
    transcriptionResult.classList.add("hidden");
    summarizeBtn.disabled = true;
  }

  function resetSummary() {
    summaryResult.classList.add("hidden");
  }

  // --- Transcription ---

  transcribeBtn.addEventListener("click", async () => {
    if (!audioBlob) return;

    showLoading("Transcribing audio...");

    const formData = new FormData();
    const ext = audioBlob.type.includes("webm") ? ".webm" : audioBlob.type.includes("ogg") ? ".ogg" : ".wav";
    formData.append("audio", audioBlob, `recording${ext}`);

    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      currentTranscription = data.text;
      transcriptionText.textContent = data.text;

      const metaParts = [];
      if (data.language) metaParts.push(`Language: ${data.language}`);
      if (data.duration) metaParts.push(`Duration: ${formatDuration(data.duration)}`);
      transcriptionMeta.textContent = metaParts.join(" | ");

      transcriptionResult.classList.remove("hidden");
      summarizeBtn.disabled = false;
    } catch (err) {
      alert(`Transcription failed: ${err.message}`);
    } finally {
      hideLoading();
    }
  });

  function formatDuration(secs) {
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  // --- Summarization ---

  summarizeBtn.addEventListener("click", async () => {
    if (!currentTranscription) return;

    showLoading("Generating summary...");

    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: currentTranscription }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      summaryText.textContent = data.summary;
      summaryResult.classList.remove("hidden");
    } catch (err) {
      alert(`Summary failed: ${err.message}`);
    } finally {
      hideLoading();
    }
  });

  // --- Copy ---

  copyTranscriptBtn.addEventListener("click", () => copyToClipboard(currentTranscription, copyTranscriptBtn));
  copySummaryBtn.addEventListener("click", () => copyToClipboard(summaryText.textContent, copySummaryBtn));

  async function copyToClipboard(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
      const original = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => (btn.textContent = original), 1500);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  }

  // --- Loading ---

  function showLoading(msg) {
    loadingMessage.textContent = msg;
    loadingOverlay.classList.remove("hidden");
  }

  function hideLoading() {
    loadingOverlay.classList.add("hidden");
  }
})();
