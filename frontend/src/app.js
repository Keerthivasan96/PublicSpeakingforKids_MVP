// /src/app.js - PERFECT VERSION WITH SYNC + SPIDER-MAN VOICE
// 🔥 JAW MOVES ONLY DURING ACTUAL TTS PLAYBACK
// 🔥 SPIDER-MAN VOICE FOR KIDS
// -----------------------------------------------------------

import { startListening, stopListening } from "./speech.js";
import { avatarStartTalking, avatarStopTalking } from "./threejs-avatar.js";

const API_URL = "http://localhost:4000/api/chat";

// UI elements
const micBtn = document.getElementById("micBtn");
const testBtn = document.getElementById("testBtn");
const clearBtn = document.getElementById("clearBtn");
const demoLessonBtn = document.getElementById("demoLessonBtn");

const pauseTtsBtn = document.getElementById("pauseTtsBtn");
const resumeTtsBtn = document.getElementById("resumeTtsBtn");
const stopTtsBtn = document.getElementById("stopTtsBtn");

const transcriptBox = document.getElementById("transcript");
const replyBox = document.getElementById("reply");
const statusEl = document.getElementById("status");
const logEl = document.getElementById("log");

const schoolMode = document.getElementById("schoolMode");
const subject = document.getElementById("subject");

const classButtons = document.querySelectorAll(".class-btn");
const subjectButtons = document.querySelectorAll(".subject-btn");

const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const conversationScroll = document.getElementById("conversationScroll");

let isListening = false;
let userWantedContinuous = false;
let isTtsPaused = false;
let isSpeaking = false;
let currentUtterance = null;
let lastSpokenText = "";

// -----------------------------------------------------------
// LOGGING
// -----------------------------------------------------------
function log(msg) {
  if (!logEl) {
    console.log("[log]", msg);
    return;
  }
  logEl.innerHTML += `• ${msg}<br>`;
  logEl.scrollTop = logEl.scrollHeight;
}

// -----------------------------------------------------------
// 🔥 SPIDER-MAN VOICE SELECTOR
// -----------------------------------------------------------
function getKidFriendlyVoice() {
  const voices = window.speechSynthesis.getVoices();
  if (!voices || !voices.length) return null;

  // Priority list for energetic, kid-friendly voices
  const voicePriorities = [
    // Google voices (best quality)
    { pattern: /google.*us.*male/i, score: 100 },
    { pattern: /google.*uk.*male/i, score: 95 },
    
    // Microsoft voices (energetic)
    { pattern: /microsoft.*guy/i, score: 90 },
    { pattern: /microsoft.*david/i, score: 85 },
    
    // Apple voices (clear)
    { pattern: /samantha/i, score: 80 },
    { pattern: /alex/i, score: 75 },
    
    // Any English male voice
    { pattern: /male/i, score: 50 },
  ];

  let bestVoice = null;
  let bestScore = 0;

  for (const voice of voices) {
    if (!voice.lang.startsWith("en")) continue;
    
    for (const priority of voicePriorities) {
      if (priority.pattern.test(voice.name)) {
        if (priority.score > bestScore) {
          bestScore = priority.score;
          bestVoice = voice;
        }
        break;
      }
    }
  }

  // Fallback: first English voice
  return bestVoice || voices.find(v => v.lang.startsWith("en")) || voices[0];
}

// -----------------------------------------------------------
// 🔥 PERFECT TTS WITH JAW SYNC + SPIDER-MAN VOICE
// -----------------------------------------------------------
function speakTextWithSync(text) {
  if (!text || !text.trim()) {
    console.warn("No text to speak");
    return;
  }

  // Cancel any existing speech
  try {
    window.speechSynthesis.cancel();
  } catch (e) {
    console.warn("Error canceling previous speech:", e);
  }

  // Ensure avatar is stopped before starting new speech
  avatarStopTalking && avatarStopTalking();
  
  lastSpokenText = text;

  if (!("speechSynthesis" in window)) {
    console.warn("speechSynthesis not supported");
    statusEl && (statusEl.textContent = "Idle");
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  currentUtterance = utterance;

  // 🔥 SPIDER-MAN VOICE SETTINGS
  utterance.lang = "en-US";
  utterance.pitch = 1.3;      // Higher = younger, heroic
  utterance.rate = 1.15;      // Faster = energetic
  utterance.volume = 1.0;     // Max volume

  // Select best voice
  const spideyVoice = getKidFriendlyVoice();
  if (spideyVoice) {
    utterance.voice = spideyVoice;
    console.log("🕷️ Using voice:", spideyVoice.name);
  }

  // 🔥 CRITICAL: START JAW ONLY WHEN AUDIO STARTS
  utterance.onstart = () => {
    console.log("🔊 TTS onstart fired - Starting jaw movement");
    isSpeaking = true;
    isTtsPaused = false;
    
    // START JAW MOVEMENT
    avatarStartTalking && avatarStartTalking();
    document.dispatchEvent(new CustomEvent("avatarTalkStart"));
    
    statusEl && (statusEl.textContent = "Reading...");
    setPauseResumeUI(false);
    log("🎤 Spider-Man speaking");
  };

  // 🔥 CRITICAL: STOP JAW IMMEDIATELY WHEN AUDIO ENDS
  utterance.onend = () => {
    console.log("🔊 TTS onend fired - Stopping jaw movement");
    isSpeaking = false;
    currentUtterance = null;
    
    // STOP JAW MOVEMENT
    avatarStopTalking && avatarStopTalking();
    document.dispatchEvent(new CustomEvent("avatarTalkStop"));
    
    statusEl && (statusEl.textContent = "Idle");
    log("✅ Speech completed");
  };

  // 🔥 CRITICAL: STOP JAW ON ERROR
  utterance.onerror = (event) => {
    console.error("🔊 TTS error:", event);
    isSpeaking = false;
    currentUtterance = null;
    
    // STOP JAW MOVEMENT
    avatarStopTalking && avatarStopTalking();
    document.dispatchEvent(new CustomEvent("avatarTalkStop"));
    
    statusEl && (statusEl.textContent = "Idle");
    log("❌ TTS error occurred");
  };

  // 🔥 BOUNDARY EVENT: For advanced lip-sync (optional)
  utterance.onboundary = (event) => {
    // This fires for each word/sentence - can be used for advanced sync
    console.log("Word boundary:", event.name, event.charIndex);
  };

  // Start speaking
  try {
    console.log("🔊 Starting speechSynthesis.speak()");
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.error("Error calling speechSynthesis.speak:", e);
    avatarStopTalking && avatarStopTalking();
    statusEl && (statusEl.textContent = "Idle");
  }
}

// Make globally available
window.speakText = speakTextWithSync;

// -----------------------------------------------------------
// STOP SPEAKING
// -----------------------------------------------------------
function stopSpeaking() {
  try {
    window.speechSynthesis.cancel();
    isTtsPaused = false;
    isSpeaking = false;
    currentUtterance = null;
    
    avatarStopTalking && avatarStopTalking();
    document.dispatchEvent(new CustomEvent("avatarTalkStop"));
    
    statusEl && (statusEl.textContent = "Idle");
    setPauseResumeUI(false);
    log("🛑 TTS stopped");
  } catch (e) {
    console.warn("stopSpeaking error:", e);
  }
}

window.stopSpeaking = stopSpeaking;

// -----------------------------------------------------------
// TTS CONTROL HELPERS
// -----------------------------------------------------------
function setPauseResumeUI(paused) {
  if (pauseTtsBtn) pauseTtsBtn.style.display = paused ? "none" : "inline-block";
  if (resumeTtsBtn) resumeTtsBtn.style.display = paused ? "inline-block" : "none";
}

function pauseTTS() {
  if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
    try {
      window.speechSynthesis.pause();
      isTtsPaused = true;
      
      // STOP JAW WHEN PAUSED
      avatarStopTalking && avatarStopTalking();
      
      setPauseResumeUI(true);
      statusEl && (statusEl.textContent = "Paused");
      log("⏸️ TTS paused");
    } catch (e) {
      console.warn("pauseTTS error:", e);
    }
  }
}

function resumeTTS() {
  if (window.speechSynthesis.paused) {
    try {
      window.speechSynthesis.resume();
      isTtsPaused = false;
      
      // RESTART JAW WHEN RESUMED
      avatarStartTalking && avatarStartTalking();
      
      setPauseResumeUI(false);
      statusEl && (statusEl.textContent = "Reading...");
      log("▶️ TTS resumed");
    } catch (e) {
      console.warn("resumeTTS error:", e);
    }
  } else if (lastSpokenText) {
    // Restart from beginning if speech ended
    log("🔄 Restarting speech from beginning");
    speakTextWithSync(lastSpokenText);
  }
}

function stopTTS() {
  stopSpeaking();
  if (resumeTtsBtn) resumeTtsBtn.style.display = "none";
}

if (pauseTtsBtn) pauseTtsBtn.addEventListener("click", pauseTTS);
if (resumeTtsBtn) resumeTtsBtn.addEventListener("click", resumeTTS);
if (stopTtsBtn) stopTtsBtn.addEventListener("click", stopTTS);

// -----------------------------------------------------------
// MARKDOWN RENDERING
// -----------------------------------------------------------
function renderReplyMarkdown(markdownText) {
  const md = markdownText || "";
  const unsafeHtml = (typeof marked !== "undefined") ? marked.parse(md) : md;
  const safeHtml = (typeof DOMPurify !== "undefined") ? DOMPurify.sanitize(unsafeHtml, { ADD_ATTR: ["target"] }) : unsafeHtml;

  if (replyBox) {
    replyBox.innerHTML = safeHtml;
  }

  const temp = document.createElement("div");
  temp.innerHTML = safeHtml;
  let plainText = temp.textContent || temp.innerText || "";

  plainText = plainText
    .replace(/[*_]{1,3}/g, "")
    .replace(/#{1,6}\s+/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();

  return plainText;
}

// -----------------------------------------------------------
// AUTO-SCROLL
// -----------------------------------------------------------
function scrollConversationToBottom(smooth = true) {
  if (!conversationScroll) return;
  try {
    if (smooth) {
      conversationScroll.scrollTo({ top: conversationScroll.scrollHeight, behavior: "smooth" });
    } else {
      conversationScroll.scrollTop = conversationScroll.scrollHeight;
    }
  } catch (e) {
    conversationScroll.scrollTop = conversationScroll.scrollHeight;
  }
}

// -----------------------------------------------------------
// PROMPT BUILDING
// -----------------------------------------------------------
function buildPrompt(userText) {
  const classMode = (schoolMode && schoolMode.value) || "general";
  const sub = (subject && subject.value) || "general";

  const baseRole = `You are "Spidey Teacher" — a warm, playful, and patient teacher who explains things clearly. Use age-appropriate vocabulary and tone.`;

  const gradeConfig = {
    general: {
      label: "General audience",
      tone: "friendly and clear",
      vocab: "plain",
      sentenceAdvice: "short sentences; avoid technical jargon",
      lengthLimit: "Keep answers concise.",
      examplesInstruction: "Use a simple example if helpful.",
      checkQuestion: "Ask one brief question at the end to check understanding."
    },
    class3: {
      label: "Class 3 (about 8 years old)",
      tone: "very friendly, playful, encouraging",
      vocab: "very simple; words a child in class 3 knows",
      sentenceAdvice: "use short sentences and simple phrases (1–2 short sentences per idea)",
      lengthLimit: "Keep responses very short — about 30–70 words (one short paragraph).",
      examplesInstruction: "Use a relatable analogy (toys, pets, school) and one short example.",
      checkQuestion: "Finish with a single simple question (yes/no or one-word answer)."
    },
    class7: {
      label: "Class 7 (about 13 years old)",
      tone: "friendly, slightly more explanatory",
      vocab: "everyday vocabulary with a few new words explained",
      sentenceAdvice: "short paragraphs (2–3 sentences each); introduce one new idea at a time",
      lengthLimit: "Keep responses concise — about 80–140 words (1–2 short paragraphs).",
      examplesInstruction: "Use a clear example and one analogy (everyday life or simple science).",
      checkQuestion: "Ask one quick comprehension question (multiple-choice or short answer)."
    },
    class10: {
      label: "Class 10 (about 15–16 years old)",
      tone: "clear, slightly formal but friendly, explanatory",
      vocab: "use proper subject vocabulary but define terms briefly",
      sentenceAdvice: "use 2–3 short paragraphs; allow slightly longer sentences",
      lengthLimit: "Keep responses focused — about 120–250 words as needed.",
      examplesInstruction: "Give an example or small step-by-step explanation; show one mini-analogy.",
      checkQuestion: "Ask one short comprehension or application question."
    }
  };

  const cfg = gradeConfig[classMode] || gradeConfig.general;
  const subjectHint = (sub && sub !== "general") ? `Focus on the subject: ${sub}.` : "";

  const formattingGuidance = [
    "Do not use code blocks.",
    "If you use bullet points, keep them to 3 or fewer short bullets.",
    "Avoid raw Markdown symbols in the visible text (no ** or ##).",
    "Do not ask for additional follow-ups unless asked—keep the answer self-contained.",
    "Use friendly punctuation and short sentences for younger grades."
  ].join(" ");

  const prompt = [
    baseRole,
    `Grade instructions: ${cfg.label}. Tone: ${cfg.tone}. Vocabulary: ${cfg.vocab}. ${cfg.sentenceAdvice}. ${cfg.lengthLimit}`,
    subjectHint,
    `Instructions for examples: ${cfg.examplesInstruction}. ${cfg.checkQuestion}`,
    `Formatting rules: ${formattingGuidance}`,
    "\nNow answer the user's question below. Keep the answer within the length guidance for this grade and end with the short comprehension question as requested.",
    `\nUser question: ${userText}`
  ].filter(Boolean).join("\n\n");

  return prompt;
}

function getGenerationParamsForClass() {
  const classMode = (schoolMode && schoolMode.value) || "general";
  const mapping = {
    general:  { temperature: 0.25, max_tokens: 220, top_p: 0.9 },
    class3:   { temperature: 0.20, max_tokens: 120, top_p: 0.9 },
    class7:   { temperature: 0.25, max_tokens: 220, top_p: 0.9 },
    class10:  { temperature: 0.30, max_tokens: 350, top_p: 0.9 }
  };
  return mapping[classMode] || mapping.general;
}

// -----------------------------------------------------------
// 🔥 BACKEND REQUEST - AVATAR STAYS IDLE UNTIL TTS STARTS
// -----------------------------------------------------------
async function askBackend(text) {
  try {
    if (!text || !text.trim()) return;
    
    // 🔥 UPDATE STATUS - NO JAW MOVEMENT YET
    statusEl && (statusEl.textContent = "Thinking...");
    log("💭 Waiting for response...");
    
    // 🔥 AVATAR STAYS IDLE DURING THIS PHASE
    
    const genParams = getGenerationParamsForClass();
    const payload = {
      prompt: buildPrompt(text),
      temperature: genParams.temperature,
      max_tokens: genParams.max_tokens,
      top_p: genParams.top_p
    };

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      if (replyBox) replyBox.textContent = "Error from server.";
      log("❌ Backend error: " + response.status);
      statusEl && (statusEl.textContent = "Idle");
      return;
    }

    const data = await response.json();
    
    // 🔥 GOT RESPONSE - STILL IDLE (waiting for TTS)
    log("✅ Response received");
    
    const reply = data.reply ?? "No reply.";
    const speakable = renderReplyMarkdown(reply);
    
    scrollConversationToBottom(true);

    // Stop listening while speaking
    try { stopListening(); } catch (e) { /* ignore */ }
    isListening = false;

    // 🔥 START TTS - JAW WILL MOVE WHEN onstart FIRES
    if (speakable && speakable.trim()) {
      log("🎤 Starting TTS...");
      speakTextWithSync(speakable);
    } else {
      console.warn("No speakable text generated");
      statusEl && (statusEl.textContent = "Idle");
    }
    
  } catch (err) {
    if (replyBox) replyBox.textContent = "Network error.";
    log("❌ Network error");
    console.error(err);
    statusEl && (statusEl.textContent = "Idle");
  }
}

// -----------------------------------------------------------
// USER SPEECH CALLBACK
// -----------------------------------------------------------
async function onUserSpeech(text) {
  if (transcriptBox) {
    transcriptBox.style.display = "block";
    transcriptBox.textContent = text;
  }
  log("👤 User said: " + text);
  await askBackend(text);
}

// -----------------------------------------------------------
// MIC BUTTON
// -----------------------------------------------------------
if (micBtn) {
  micBtn.addEventListener("click", () => {
    if (!isListening) {
      stopTTS();
      userWantedContinuous = true;
      isListening = true;
      micBtn.textContent = "🛑 Stop Listening";
      statusEl && (statusEl.textContent = "Listening...");
      startListening(onUserSpeech, { continuous: false });
    } else {
      userWantedContinuous = false;
      isListening = false;
      micBtn.textContent = "🎤 Start Listening";
      stopListening();
      statusEl && (statusEl.textContent = "Idle");
    }
  });
}

// -----------------------------------------------------------
// TEST BUTTON
// -----------------------------------------------------------
if (testBtn) {
  testBtn.addEventListener("click", async () => {
    if (transcriptBox) {
      transcriptBox.style.display = "block";
      transcriptBox.textContent = "Hello!";
    }
    await askBackend("Hello! Introduce yourself as Spidey Teacher in a fun way!");
  });
}

// -----------------------------------------------------------
// CLEAR BUTTON
// -----------------------------------------------------------
if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    if (transcriptBox) transcriptBox.textContent = "";
    if (replyBox) replyBox.textContent = "";
    log("🗑️ Cleared screen");
    if (conversationScroll) conversationScroll.scrollTop = 0;
  });
}

// -----------------------------------------------------------
// DEMO LESSON BUTTON
// -----------------------------------------------------------
if (demoLessonBtn) {
  demoLessonBtn.addEventListener("click", async () => {
    await askBackend("Teach me a quick 30-second fun science fact!");
  });
}

// -----------------------------------------------------------
// QUICK-SELECT BUTTONS
// -----------------------------------------------------------
function clearActiveClassButtons() {
  classButtons.forEach(b => b.classList.remove("active"));
}
function clearActiveSubjectButtons() {
  subjectButtons.forEach(b => b.classList.remove("active"));
}

classButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const cls = btn.dataset.class;
    if (!cls) return;
    if (schoolMode) schoolMode.value = cls;
    clearActiveClassButtons();
    btn.classList.add("active");
    log("📚 Class set to " + cls);
  });
});

subjectButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const sub = btn.dataset.sub;
    if (!sub) return;
    if (subject) subject.value = sub;
    clearActiveSubjectButtons();
    btn.classList.add("active");
    log("📖 Subject set to " + sub);
  });
});

if (schoolMode) {
  schoolMode.addEventListener("change", () => {
    clearActiveClassButtons();
    const cls = schoolMode.value;
    classButtons.forEach(b => { if (b.dataset.class === cls) b.classList.add("active"); });
  });
}
if (subject) {
  subject.addEventListener("change", () => {
    clearActiveSubjectButtons();
    const s = subject.value;
    subjectButtons.forEach(b => { if (b.dataset.sub === s) b.classList.add("active"); });
  });
}

// -----------------------------------------------------------
// CHAT INPUT
// -----------------------------------------------------------
if (sendBtn && chatInput) {
  sendBtn.addEventListener("click", async () => {
    const v = chatInput.value.trim();
    if (!v) return;
    if (transcriptBox) {
      transcriptBox.style.display = "block";
      transcriptBox.textContent = v;
    }
    chatInput.value = "";
    log("⌨️ Typed: " + v);
    await askBackend(v);
  });

  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendBtn.click();
    }
  });
}

// -----------------------------------------------------------
// AUTO-SCROLL OBSERVER
// -----------------------------------------------------------
if (conversationScroll) {
  setTimeout(() => scrollConversationToBottom(false), 200);
  try {
    const obs = new MutationObserver(() => scrollConversationToBottom(true));
    obs.observe(replyBox || document.body, { childList: true, subtree: true, characterData: true });
  } catch (e) { /* ignore */ }
}

// -----------------------------------------------------------
// GLOBAL EVENT LISTENERS
// -----------------------------------------------------------
document.addEventListener("avatarTalkStart", () => {
  isSpeaking = true;
  if (pauseTtsBtn) pauseTtsBtn.style.display = "inline-block";
  if (resumeTtsBtn) resumeTtsBtn.style.display = "none";
});

document.addEventListener("avatarTalkStop", () => {
  isSpeaking = false;
  if (!userWantedContinuous) {
    statusEl && (statusEl.textContent = "Idle");
  }
});

// -----------------------------------------------------------
// 🔥 VOICE LOADING (CRITICAL FOR CHROME/EDGE)
// -----------------------------------------------------------
if (window.speechSynthesis) {
  // Load voices immediately
  window.speechSynthesis.getVoices();
  
  // Chrome/Edge require this event
  window.speechSynthesis.onvoiceschanged = () => {
    const voice = getKidFriendlyVoice();
    if (voice) {
      console.log("🕷️ Spider-Man voice ready:", voice.name);
      log("🎙️ Voice loaded: " + voice.name);
    }
  };
}

// -----------------------------------------------------------
// INITIALIZATION
// -----------------------------------------------------------
log("🕷️ Spidey Teacher loaded!");
log("🎤 Spider-Man voice active");
if (pauseTtsBtn) pauseTtsBtn.style.display = "inline-block";
if (resumeTtsBtn) resumeTtsBtn.style.display = "none";
if (statusEl) statusEl.textContent = "Idle";

console.log("✅ App initialized - Perfect jaw sync enabled!");