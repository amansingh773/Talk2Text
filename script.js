// ============ DOM ELEMENTS ============
const micBtn = document.getElementById("micBtn");
const status = document.getElementById("status");
const textBox = document.getElementById("textBox");
const saveBtn = document.getElementById("saveBtn");
const clearBtn = document.getElementById("clearBtn");
const tasksContainer = document.getElementById("tasksContainer");
const taskCount = document.getElementById("taskCount");
const themeToggle = document.querySelector(".theme-toggle-sidebar");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

// ============ STATE ============
let transcript = "";
let interimText = "";
let isListening = false;
let tasks = [];
let history = [];

// 🎤 NEW (Whisper recording)
let mediaRecorder;
let audioChunks = [];

// ============ STORAGE KEYS ============
const TASKS_STORAGE_KEY = "voicetask_tasks";
const HISTORY_STORAGE_KEY = "voicetask_history";
const THEME_STORAGE_KEY = "voicetask_theme";

// ============ INITIALIZATION ============

function init() {
  loadTheme();
  loadTasks();
  loadHistory();
  setupRecording(); // 🔥 changed
  renderTasks();
  renderHistory();
}

// ============ THEME MANAGEMENT ============
function loadTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === "dark") {
    document.documentElement.classList.add("dark-mode");
  } else if (savedTheme === "light") {
    document.documentElement.classList.remove("dark-mode");
  } else {
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      document.documentElement.classList.add("dark-mode");
    }
  }
}

themeToggle.addEventListener("click", () => {
  document.documentElement.classList.toggle("dark-mode");
  const isDark = document.documentElement.classList.contains("dark-mode");
  localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light");
});

// ============ 🎤 WHISPER RECORDING ============
function setupRecording() {
  micBtn.addEventListener("click", async () => {
    if (!isListening) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (e) => {
          audioChunks.push(e.data);
        };

        mediaRecorder.start();

        isListening = true;
        status.textContent = "🎙️ Recording...";
        micBtn.classList.add("listening");
      } catch (err) {
        console.error(err);
        status.textContent = "❌ Mic Error";
      }
    } else {
      mediaRecorder.stop();

      mediaRecorder.onstop = async () => {
        status.textContent = "⏳ Processing...";

        const blob = new Blob(audioChunks, { type: "audio/webm" });

        await sendToWhisper(blob);
      };

      isListening = false;
      micBtn.classList.remove("listening");
    }
  });
}

// ============ 🔥 WHISPER API ============
async function sendToWhisper(audioBlob) {
  const formData = new FormData();
  formData.append("file", audioBlob, "audio.webm");
  formData.append("model", "whisper-1");

  try {
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${API_KEY}` 
      },
      body: formData,
    });

    const data = await res.json();

    transcript += data.text + " ";
    interimText = "";

    updateTranscriptUI();
    status.textContent = "Processing Done ✅";
  } catch (err) {
    console.error(err);
    status.textContent = "❌ Error";
  }
}

// ============ UI ============
function updateTranscriptUI() {
  textBox.innerHTML = `
    <span>${escapeHtml(transcript)}</span>
    <span style="color:var(--text-muted)">${escapeHtml(interimText)}</span>
  `;
  textBox.scrollTop = textBox.scrollHeight;
}

// ============ TASK MANAGEMENT ============
saveBtn.addEventListener("click", () => {
  const text = (transcript + interimText).trim();
  if (!text) return;

  const now = new Date();
  const task = {
    id: Date.now(),
    text,
    timestamp: now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    date: now.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  };

  tasks.unshift(task);
  saveTasks();

  history.unshift({
    id: Date.now(),
    text,
    timestamp: now.toLocaleString(),
  });
  saveHistory();

  transcript = "";
  interimText = "";
  updateTranscriptUI();

  renderTasks();
  renderHistory();
  showSuccessFeedback();
});

clearBtn.addEventListener("click", () => {
  transcript = "";
  interimText = "";
  updateTranscriptUI();
});

function renderTasks() {
  if (tasks.length === 0) {
    tasksContainer.innerHTML =
      '<div class="empty-state">No tasks yet. Start speaking!</div>';
    taskCount.textContent = "0";
    return;
  }

  taskCount.textContent = tasks.length;
  tasksContainer.innerHTML = tasks
    .map(
      (task) => `
    <div class="task-item">
      <div>
        <div class="task-item-text">${escapeHtml(task.text)}</div>
        <div class="task-item-time">${task.date} • ${task.timestamp}</div>
      </div>
      <button class="task-item-delete" onclick="deleteTask(${task.id})">✕</button>
    </div>
  `,
    )
    .join("");
}

function deleteTask(id) {
  tasks = tasks.filter((task) => task.id !== id);
  saveTasks();
  renderTasks();
}

// ============ HISTORY ============
function renderHistory() {
  if (history.length === 0) {
    historyList.innerHTML = '<div class="empty-state">No history yet</div>';
    return;
  }

  historyList.innerHTML = history
    .map(
      (item) => `
    <div class="history-item">
      <div class="history-item-text">${escapeHtml(item.text)}</div>
      <button onclick="deleteHistoryItem(${item.id})">✕</button>
    </div>
  `,
    )
    .join("");
}

function deleteHistoryItem(id) {
  history = history.filter((item) => item.id !== id);
  saveHistory();
  renderHistory();
}

clearHistoryBtn.addEventListener("click", () => {
  if (confirm("Clear all history?")) {
    history = [];
    saveHistory();
    renderHistory();
  }
});

// ============ STORAGE ============
function saveTasks() {
  localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
}

function loadTasks() {
  const saved = localStorage.getItem(TASKS_STORAGE_KEY);
  tasks = saved ? JSON.parse(saved) : [];
}

function saveHistory() {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
}

function loadHistory() {
  const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
  history = saved ? JSON.parse(saved) : [];
}

// ============ UTILS ============
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function showSuccessFeedback() {
  saveBtn.style.transform = "scale(0.95)";
  setTimeout(() => {
    saveBtn.style.transform = "scale(1)";
  }, 200);
}

// ============ START ============
document.addEventListener("DOMContentLoaded", init);
