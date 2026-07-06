const drop = document.getElementById("drop");
const player = document.getElementById("player");
const timeDisplay = document.getElementById("time");
const memoCount = document.getElementById("memoCount");
const memoList = document.getElementById("memoList");
const addMemoBtn = document.getElementById("addMemo");
const memoInput = document.getElementById("memoInput");
const noteInput = document.getElementById("noteInput");
const addNoteBtn = document.getElementById("addNote");
const noteList = document.getElementById("noteList");
const fileInput = document.getElementById("fileInput");
const selectFileBtn = document.getElementById("selectFile");
const projectImportBtn = document.getElementById("projectImportBtn");
const projectImportInput = document.getElementById("projectImportInput");
const selectedFileName = document.getElementById("selectedFileName");
const appStatusLabel = document.getElementById("appStatusLabel");
const currentFileNameDisplay = document.getElementById("currentFileNameDisplay");
const uploadScreen = document.getElementById("screen-upload");
const playerScreen = document.getElementById("screen-player");
const backBtn = document.getElementById("backBtn");
const waveformCanvas = document.getElementById("waveform");
const waveformContainer = document.getElementById("waveformContainer");
const waveformMemoTooltip = document.getElementById("waveformMemoTooltip");
const fileListElement = document.getElementById("fileList");
const noFilesMessage = document.getElementById("noFilesMessage");
const projectNameInput = document.getElementById("projectNameInput");
const projectNamePrompt = document.getElementById("projectNamePrompt");
const confirmProjectBtn = document.getElementById("confirmProjectBtn");
const recordProjectBtn = document.getElementById("recordProjectBtn");
const startRecordingBtn = document.getElementById("startRecordingBtn");
const stopRecordingBtn = document.getElementById("stopRecordingBtn");
const replaceAudioBtn = document.getElementById("replaceAudioBtn");
const recordingStatus = document.getElementById("recordingStatus");
const volumeSlider = document.getElementById("volumeSlider");
const volumeValue = document.getElementById("volumeValue");
const projectExportBtn = document.getElementById("projectExportBtn");
const infoBtn = document.getElementById("infoBtn");
const infoPopup = document.getElementById("infoPopup");
const infoFilePath = document.getElementById("infoFilePath");
const infoCreatedAt = document.getElementById("infoCreatedAt");
const closeInfoBtn = document.getElementById("closeInfoBtn");
const projectImportInfoBtn = document.getElementById("projectImportInfoBtn");
const projectExportInfoBtn = document.getElementById("projectExportInfoBtn");
const exportMemosBtn = document.getElementById("exportMemosBtn");

const storageKey = "cuememo-web-projects-v1";

let captureTime = null;
let memos = [];
let notes = [];
let allProjectsData = {};
let editingMemoIndex = null;
let editingMemoText = "";
let editingMemoColor = "red";
let currentProjectName = null;
let currentAudioFileName = null;
let currentAudioUrl = null;
let currentAudioFile = null;
let pendingAudioFile = null;
let pendingAudioDataUrl = null;
let audioContext = null;
let audioBuffer = null;
let waveformData = [];
let hoveredMemoIndex = null;
let mediaRecorder = null;
let recordingChunks = [];
let recordingMode = "new-project";
let recordingStream = null;
let memoComposition = false;
let noteComposition = false;
let projectNameComposition = false;

function loadProjects() {
  try {
    const raw = localStorage.getItem(storageKey);
    allProjectsData = raw ? JSON.parse(raw) : {};
    if (!allProjectsData || typeof allProjectsData !== "object") {
      allProjectsData = {};
    }
  } catch (error) {
    console.error("Failed to load projects:", error);
    allProjectsData = {};
  }
}

function saveProjects() {
  localStorage.setItem(storageKey, JSON.stringify(allProjectsData));
}

function setRecordingStatus(message) {
  if (recordingStatus) recordingStatus.textContent = message;
}

function updateVolumeUI() {
  const percent = Math.round((player.volume || 0) * 100);
  if (volumeSlider) volumeSlider.value = String(percent);
  if (volumeValue) volumeValue.textContent = `${percent}%`;
}

function persistProjects() {
  saveCurrentProjectData();
  saveProjects();
}

function getProjectAudioBase64(project) {
  const dataUrl = project?.audioDataUrl || "";
  const separatorIndex = dataUrl.indexOf(",");
  if (separatorIndex === -1) return null;
  return dataUrl.slice(separatorIndex + 1);
}

function downloadTextFile(fileName, contents, mimeType = "application/json") {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsText(file, "utf-8");
  });
}

function showPlayerScreen(fileName) {
  uploadScreen.classList.add("hidden");
  playerScreen.classList.remove("hidden");
  currentFileNameDisplay.textContent = fileName;
  appStatusLabel.textContent = fileName;
}

function showUploadScreen() {
  uploadScreen.classList.remove("hidden");
  playerScreen.classList.add("hidden");
  if (player.src) player.pause();
  appStatusLabel.textContent = "Ready";
  selectedFileName.textContent = "未選択";
  projectNamePrompt.classList.add("hidden");
  currentProjectName = null;
  currentAudioFileName = null;
  currentAudioFile = null;
  pendingAudioFile = null;
  pendingAudioDataUrl = null;
  memos = [];
  notes = [];
  renderMemos();
  renderFileList();
}

function formatDateTime(value) {
  try {
    return new Date(value).toLocaleString("ja-JP");
  } catch {
    return "不明";
  }
}

function updateInfoPopup() {
  const project = currentProjectName ? allProjectsData[currentProjectName] || {} : {};
  infoFilePath.textContent = project.audioDataUrl ? "ブラウザ内保存" : "未登録";
  infoCreatedAt.textContent = project.createdAt ? formatDateTime(project.createdAt) : "未登録";
}

function showInfoPopup() {
  updateInfoPopup();
  infoPopup.classList.remove("hidden");
  infoPopup.classList.add("visible");
}

function hideInfoPopup() {
  infoPopup.classList.add("hidden");
  infoPopup.classList.remove("visible");
}

function getColorLabel(color) {
  const labels = { red: "Red", blue: "Blue", green: "Green", yellow: "Yellow" };
  return labels[color] || color;
}

function getColorValue(color) {
  const colorMap = {
    red: "#4c4c4c",
    blue: "#747474",
    green: "#9a9a9a",
    yellow: "#c6c6c6"
  };
  return colorMap[color] || colorMap.red;
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

async function dataUrlToFile(dataUrl, fileName, mimeType) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], fileName, { type: mimeType || blob.type || "audio/mpeg" });
}

function exportMemosAsText() {
  if (!currentProjectName || (memos.length === 0 && notes.length === 0)) {
    alert("No memos or notes to export");
    return;
  }

  const lines = [`[${currentProjectName}]`, ""];
  [...memos]
    .sort((a, b) => parseFloat(a.time) - parseFloat(b.time))
    .forEach((memo) => {
      lines.push(`${formatTime(parseFloat(memo.time) || 0)} - ${memo.text} (${getColorLabel(memo.color || "red")})`);
    });

  if (notes.length) {
    lines.push("", "[Notes]");
    notes.forEach((note) => lines.push(`- ${note.text}`));
  }

  navigator.clipboard.writeText(lines.join("\n")).then(() => {
    alert("Copied to clipboard");
  }).catch(() => {
    alert("Failed to copy");
  });
}

function exportCurrentProject() {
  if (!currentProjectName || !allProjectsData[currentProjectName]) {
    alert("書き出すプロジェクトがありません。");
    return;
  }

  persistProjects();

  const project = allProjectsData[currentProjectName];
  const payload = {
    format: "cuememo-project",
    version: 1,
    exportedAt: new Date().toISOString(),
    projectName: currentProjectName,
    project: {
      createdAt: project.createdAt || new Date().toISOString(),
      audioFileName: project.audioFileName || currentAudioFileName || "",
      audioMimeType: project.audioMimeType || "audio/mpeg",
      isRecorded: Boolean(project.isRecorded),
      memos: Array.isArray(project.memos) ? project.memos : [],
      notes: Array.isArray(project.notes) ? project.notes : []
    },
    audioBase64: getProjectAudioBase64(project)
  };

  const safeName = (currentProjectName || "project").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim() || "project";
  downloadTextFile(`${safeName}.cuememo`, JSON.stringify(payload, null, 2));
}

async function importProjectFile(file) {
  if (!file) return;

  try {
    const raw = await readTextFile(file);
    const payload = JSON.parse(raw);

    if (payload?.format !== "cuememo-project" || payload?.version !== 1 || !payload?.project) {
      throw new Error("Unsupported CueMemo project file");
    }

    const importedProject = payload.project;
    const fileBaseName = (file.name || "").replace(/\.[^/.]+$/, "");
    const baseName = normalizeProjectName(
      payload.projectName ||
      importedProject.audioFileName?.replace(/\.[^/.]+$/, "") ||
      fileBaseName ||
      "Imported Project"
    );
    const projectName = allProjectsData[baseName] ? ensureUniqueProjectName(baseName) : baseName;
    const audioMimeType = importedProject.audioMimeType || "audio/mpeg";

    allProjectsData[projectName] = {
      memos: Array.isArray(importedProject.memos) ? JSON.parse(JSON.stringify(importedProject.memos)) : [],
      notes: Array.isArray(importedProject.notes) ? JSON.parse(JSON.stringify(importedProject.notes)) : [],
      audioFileName: importedProject.audioFileName || `${projectName}.mp3`,
      audioMimeType,
      audioDataUrl: payload.audioBase64 ? `data:${audioMimeType};base64,${payload.audioBase64}` : "",
      isRecorded: Boolean(importedProject.isRecorded),
      createdAt: importedProject.createdAt || new Date().toISOString()
    };

    saveProjects();
    hideInfoPopup();
    renderFileList();
    await openProject(projectName);
    alert(`プロジェクトを読み込みました: ${projectName}`);
  } catch (error) {
    console.error("Failed to import project:", error);
    alert("CueMemo ファイルを読み込めませんでした。");
  }
}

async function setAudioSource(file) {
  if (!file) return;
  currentAudioFile = file;

  if (currentProjectName) {
    const dataUrl = await fileToDataUrl(file);
    const project = allProjectsData[currentProjectName] || {};
    project.audioFileName = file.name;
    project.audioMimeType = file.type || "audio/mpeg";
    project.audioDataUrl = dataUrl;
    project.isRecorded = file.name.startsWith("recording-");
    allProjectsData[currentProjectName] = project;
    saveCurrentProjectData();
    saveProjects();
  } else {
    pendingAudioFile = file;
    pendingAudioDataUrl = await fileToDataUrl(file);
    selectedFileName.textContent = file.name;
    projectNameInput.value = getDefaultProjectNameFromFile(file);
    projectNamePrompt.classList.remove("hidden");
    projectNameInput.focus();
    return;
  }

  if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
  currentAudioUrl = URL.createObjectURL(file);
  player.src = currentAudioUrl;
  player.load();
  await decodeWaveform(file);
  selectedFileName.textContent = file.name;
}

function updateCurrentProjectMemos() {
  if (!currentProjectName) {
    memos = [];
    notes = [];
  } else {
    const project = allProjectsData[currentProjectName] || {};
    memos = project.memos || [];
    notes = project.notes || [];
  }
  renderMemos();
}

function saveCurrentProjectData() {
  if (!currentProjectName) return;
  const project = allProjectsData[currentProjectName] || {};
  project.memos = memos;
  project.notes = notes;
  project.audioFileName = currentAudioFileName;
  allProjectsData[currentProjectName] = project;
  saveProjects();
}

async function decodeWaveform(file) {
  if (!file || !window.AudioContext) {
    waveformData = [];
    drawWaveform();
    return;
  }

  if (audioContext) {
    audioContext.close().catch(() => {});
  }

  audioContext = new AudioContext();
  try {
    const buffer = await file.arrayBuffer();
    audioBuffer = await audioContext.decodeAudioData(buffer);
    buildWaveformData();
  } catch (error) {
    console.error("Failed to decode waveform:", error);
    waveformData = [];
  }
  drawWaveform();
}

function buildWaveformData() {
  if (!audioBuffer) {
    waveformData = [];
    return;
  }

  const rawData = audioBuffer.getChannelData(0);
  const samples = Math.min(300, Math.max(120, Math.floor(rawData.length / 4000)));
  const blockSize = Math.floor(rawData.length / samples) || 1;
  const filteredData = [];

  for (let i = 0; i < samples; i++) {
    let sum = 0;
    const blockStart = i * blockSize;
    for (let j = 0; j < blockSize && blockStart + j < rawData.length; j++) {
      sum += Math.abs(rawData[blockStart + j]);
    }
    filteredData.push(sum / blockSize);
  }

  const max = Math.max(...filteredData) || 1;
  waveformData = filteredData.map((value) => value / max);
}

function drawWaveform() {
  const ctx = waveformCanvas.getContext("2d");
  const rect = waveformCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  waveformCanvas.width = rect.width * dpr;
  waveformCanvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.fillStyle = "#f1f1ee";
  ctx.fillRect(0, 0, rect.width, rect.height);

  const centerY = rect.height / 2;
  ctx.strokeStyle = "rgba(32,32,32,0.08)";
  ctx.beginPath();
  ctx.moveTo(0, centerY);
  ctx.lineTo(rect.width, centerY);
  ctx.stroke();

  const barWidth = Math.max(2, rect.width / Math.max(waveformData.length, 1));
  const progress = player.duration > 0 ? player.currentTime / player.duration : 0;

  waveformData.forEach((value, index) => {
    const x = index * barWidth;
    const barHeight = Math.max(6, value * rect.height * 0.7);
    const y = centerY - barHeight / 2;
    ctx.fillStyle = index / waveformData.length < progress ? "#2f2f2f" : "rgba(32,32,32,0.12)";
    ctx.fillRect(x + 1, y, Math.max(1, barWidth - 2), barHeight);
  });

  const memoPositions = memos.map((memo, index) => {
    const time = parseFloat(memo.time);
    if (!player.duration || Number.isNaN(time)) return null;
    const x = Math.min(1, Math.max(0, time / player.duration)) * rect.width;
    return { memo, index, x, color: getColorValue(memo.color || "red") };
  }).filter(Boolean);

  memoPositions.forEach((item) => {
    ctx.beginPath();
    ctx.fillStyle = item.color;
    ctx.arc(item.x, centerY, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  const active = memoPositions.find((item) => item.index === hoveredMemoIndex) || null;
  if (active) {
    waveformMemoTooltip.textContent = `${formatTime(parseFloat(active.memo.time) || 0)} - ${active.memo.text}`;
    waveformMemoTooltip.style.left = `${Math.min(Math.max(active.x - 20, 8), rect.width - 160)}px`;
    waveformMemoTooltip.style.top = "10px";
    waveformMemoTooltip.classList.remove("hidden");
  } else {
    waveformMemoTooltip.classList.add("hidden");
  }
}

function getWaveformMemoIndexAtX(clientX) {
  if (!waveformContainer || !player.duration || !memos.length) return null;
  const rect = waveformContainer.getBoundingClientRect();
  const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
  let closestIndex = null;
  let closestDist = Infinity;

  memos.forEach((memo, index) => {
    const time = parseFloat(memo.time);
    if (Number.isNaN(time)) return;
    const memoX = Math.min(1, Math.max(0, time / player.duration)) * rect.width;
    const dist = Math.abs(memoX - x);
    if (dist < closestDist) {
      closestDist = dist;
      closestIndex = index;
    }
  });

  return closestDist <= 16 ? closestIndex : null;
}

function renderMemos() {
  memoList.innerHTML = "";
  const sorted = [...memos].map((memo, idx) => ({ memo, idx }))
    .sort((a, b) => parseFloat(a.memo.time) - parseFloat(b.memo.time));

  sorted.forEach(({ memo, idx }) => {
    const li = document.createElement("li");
    li.className = "memo-item";

    const timeLabel = document.createElement("span");
    timeLabel.className = "memo-time";
    timeLabel.textContent = formatTime(parseFloat(memo.time) || 0);

    const colorBadge = document.createElement("span");
    colorBadge.className = "memo-color-badge";
    colorBadge.style.backgroundColor = getColorValue(memo.color || "red");

    const content = document.createElement("span");
    content.className = "memo-text";
    content.textContent = memo.text;

    const editButton = document.createElement("button");
    editButton.textContent = "編集";
    editButton.addEventListener("click", (event) => {
      event.stopPropagation();
      editMemo(idx);
    });

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "削除";
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      removeMemo(idx);
    });

    li.append(timeLabel, colorBadge, content, editButton, deleteButton);
    li.addEventListener("click", () => {
      if (!player.src) return;
      player.currentTime = parseFloat(memo.time) || 0;
      player.play();
    });
    memoList.appendChild(li);

    if (editingMemoIndex === idx) {
      const editRow = document.createElement("li");
      editRow.className = "memo-edit-row";

      const textarea = document.createElement("textarea");
      textarea.value = editingMemoText;
      textarea.addEventListener("input", (event) => {
        editingMemoText = event.target.value;
      });

      const colorPicker = document.createElement("div");
      colorPicker.className = "memo-edit-color";
      ["red", "blue", "green", "yellow"].forEach((color) => {
        const colorButton = document.createElement("button");
        colorButton.type = "button";
        colorButton.className = `${color}${editingMemoColor === color ? " active" : ""}`;
        colorButton.addEventListener("click", () => {
          editingMemoColor = color;
          renderMemos();
        });
        colorPicker.appendChild(colorButton);
      });

      const actions = document.createElement("div");
      actions.className = "memo-edit-actions";

      const cancelBtn = document.createElement("button");
      cancelBtn.textContent = "キャンセル";
      cancelBtn.addEventListener("click", cancelInlineEdit);

      const saveBtn = document.createElement("button");
      saveBtn.textContent = "保存";
      saveBtn.addEventListener("click", saveInlineEdit);

      actions.append(cancelBtn, saveBtn);
      editRow.append(textarea, colorPicker, actions);
      memoList.appendChild(editRow);
      textarea.focus();
    }
  });

  memoCount.textContent = String(memos.length);
  renderNotes();
}

function renderNotes() {
  noteList.innerHTML = "";
  if (!notes.length) {
    const empty = document.createElement("li");
    empty.className = "memo-item";
    empty.textContent = "メモはありません。";
    noteList.appendChild(empty);
    return;
  }

  notes.forEach((note, index) => {
    const li = document.createElement("li");
    li.className = "memo-item";

    const timeLabel = document.createElement("span");
    timeLabel.className = "memo-time";
    timeLabel.textContent = "—";

    const colorBadge = document.createElement("span");
    colorBadge.className = "memo-color-badge";
    colorBadge.style.backgroundColor = "#8a8a8a";

    const content = document.createElement("span");
    content.className = "memo-text";
    content.textContent = note.text;

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "削除";
    deleteButton.addEventListener("click", () => removeNote(index));

    li.append(timeLabel, colorBadge, content, deleteButton);
    noteList.appendChild(li);
  });
}

function addNote() {
  const text = noteInput.value.trim();
  if (!text) return;
  notes.push({ text, createdAt: new Date().toISOString() });
  noteInput.value = "";
  saveCurrentProjectData();
  renderNotes();
}

function removeNote(index) {
  notes.splice(index, 1);
  saveCurrentProjectData();
  renderNotes();
}

function editMemo(index) {
  const memo = memos[index];
  if (!memo) return;
  editingMemoIndex = index;
  editingMemoText = memo.text;
  editingMemoColor = memo.color || "red";
  renderMemos();
}

function saveInlineEdit() {
  if (editingMemoIndex === null) return;
  const newText = editingMemoText.trim();
  if (!newText) return;
  memos[editingMemoIndex] = { ...memos[editingMemoIndex], text: newText, color: editingMemoColor };
  editingMemoIndex = null;
  saveCurrentProjectData();
  renderMemos();
  drawWaveform();
}

function cancelInlineEdit() {
  editingMemoIndex = null;
  renderMemos();
}

function removeMemo(index) {
  memos.splice(index, 1);
  saveCurrentProjectData();
  renderMemos();
  drawWaveform();
}

function addMemo() {
  const text = memoInput.value.trim();
  if (!text) return;
  if (captureTime === null) captureTime = player.currentTime.toFixed(2);
  memos.push({ time: captureTime, text, color: "red" });
  memoInput.value = "";
  captureTime = null;
  saveCurrentProjectData();
  renderMemos();
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function renderFileList() {
  fileListElement.innerHTML = "";
  const projectNames = Object.keys(allProjectsData);
  if (!projectNames.length) {
    noFilesMessage.style.display = "block";
    return;
  }

  noFilesMessage.style.display = "none";
  const recentProjects = JSON.parse(localStorage.getItem("cuememo-web-recent") || "[]");
  const sortedProjects = projectNames.sort((a, b) => {
    const aIndex = recentProjects.indexOf(a);
    const bIndex = recentProjects.indexOf(b);
    return (aIndex === -1 ? Infinity : aIndex) - (bIndex === -1 ? Infinity : bIndex);
  });

  sortedProjects.forEach((projectName) => {
    const project = allProjectsData[projectName];
    const li = document.createElement("li");
    li.className = "file-item";

    const nameSpan = document.createElement("span");
    nameSpan.className = "file-item-name";
    nameSpan.textContent = projectName;

    const countSpan = document.createElement("span");
    countSpan.className = "file-item-count";
    countSpan.textContent = `${(project.memos || []).length} メモ`;

    li.append(nameSpan, countSpan);
    li.addEventListener("click", () => openProject(projectName));
    fileListElement.appendChild(li);
  });
}

async function openProject(projectName) {
  currentProjectName = projectName;
  const project = allProjectsData[projectName];
  currentAudioFileName = project.audioFileName || null;
  updateCurrentProjectMemos();
  addToRecentFiles(projectName);

  if (!project.audioDataUrl) {
    alert("このプロジェクトには音声がありません。");
    return;
  }

  if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
  currentAudioUrl = project.audioDataUrl;
  player.src = currentAudioUrl;
  player.load();
  currentAudioFile = await dataUrlToFile(project.audioDataUrl, currentAudioFileName || "audio", project.audioMimeType);
  await decodeWaveform(currentAudioFile);
  showPlayerScreen(projectName);
  selectedFileName.textContent = currentAudioFileName || "未選択";
}

function normalizeProjectName(name) {
  return (name || "").replace(/^[\s\u3000]+|[\s\u3000]+$/g, "");
}

function getDefaultProjectNameFromFile(file) {
  const rawName = file?.name || "";
  const baseName = rawName.replace(/\.[^/.]+$/, "");
  return normalizeProjectName(baseName) || normalizeProjectName(rawName);
}

function ensureUniqueProjectName(baseName) {
  let uniqueName = baseName;
  let counter = 1;
  while (allProjectsData[uniqueName]) {
    counter += 1;
    uniqueName = `${baseName} (${counter})`;
  }
  return uniqueName;
}

function addToRecentFiles(projectName) {
  const recentProjects = JSON.parse(localStorage.getItem("cuememo-web-recent") || "[]");
  const index = recentProjects.indexOf(projectName);
  if (index > -1) recentProjects.splice(index, 1);
  recentProjects.unshift(projectName);
  if (recentProjects.length > 20) recentProjects.pop();
  localStorage.setItem("cuememo-web-recent", JSON.stringify(recentProjects));
}

async function createProject() {
  let projectName = normalizeProjectName(projectNameInput.value);
  if (!projectName && pendingAudioFile) {
    projectName = getDefaultProjectNameFromFile(pendingAudioFile);
  }
  if (!projectName) {
    projectNameInput.focus();
    return;
  }
  if (allProjectsData[projectName]) {
    if (projectName === getDefaultProjectNameFromFile(pendingAudioFile)) {
      projectName = ensureUniqueProjectName(projectName);
    } else {
      alert("Project name already exists");
      return;
    }
  }
  if (!pendingAudioFile || !pendingAudioDataUrl) {
    alert("Select or record audio first");
    return;
  }

  currentProjectName = projectName;
  currentAudioFileName = pendingAudioFile.name;
  currentAudioFile = pendingAudioFile;
  memos = [];
  notes = [];

  allProjectsData[projectName] = {
    memos: [],
    notes: [],
    audioFileName: currentAudioFileName,
    audioMimeType: pendingAudioFile.type || "audio/mpeg",
    audioDataUrl: pendingAudioDataUrl,
    isRecorded: Boolean(pendingAudioFile.name.startsWith("recording-")),
    createdAt: new Date().toISOString()
  };
  saveProjects();
  addToRecentFiles(projectName);

  if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
  currentAudioUrl = URL.createObjectURL(pendingAudioFile);
  player.src = currentAudioUrl;
  player.load();
  await decodeWaveform(pendingAudioFile);
  showPlayerScreen(projectName);
  selectedFileName.textContent = "未選択";
  projectNamePrompt.classList.add("hidden");
  pendingAudioFile = null;
  pendingAudioDataUrl = null;
}

async function startRecording(mode = "new-project") {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setRecordingStatus("この環境では録音に対応していません。");
    return;
  }
  if (mediaRecorder && mediaRecorder.state === "recording") return;

  try {
    recordingMode = mode;
    recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "";
    mediaRecorder = new MediaRecorder(recordingStream, mimeType ? { mimeType } : undefined);
    recordingChunks = [];

    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data?.size) recordingChunks.push(event.data);
    });

    mediaRecorder.addEventListener("stop", async () => {
      try {
        const blob = new Blob(recordingChunks, { type: mediaRecorder.mimeType || "audio/webm" });
        const fileName = `recording-${Date.now()}.webm`;
        const recordedFile = new File([blob], fileName, { type: blob.type || "audio/webm" });
        const dataUrl = await fileToDataUrl(recordedFile);

        if (recordingMode === "replace-current" && currentProjectName) {
          currentAudioFile = recordedFile;
          currentAudioFileName = fileName;
          const project = allProjectsData[currentProjectName] || {};
          project.audioFileName = fileName;
          project.audioMimeType = recordedFile.type;
          project.audioDataUrl = dataUrl;
          project.isRecorded = true;
          allProjectsData[currentProjectName] = project;
          saveCurrentProjectData();
          saveProjects();
          await setAudioSource(recordedFile);
        } else {
          pendingAudioFile = recordedFile;
          pendingAudioDataUrl = dataUrl;
          selectedFileName.textContent = fileName;
          projectNameInput.value = getDefaultProjectNameFromFile(recordedFile);
          projectNamePrompt.classList.remove("hidden");
        }
        setRecordingStatus("録音を保存しました。");
      } catch (error) {
        console.error("Failed to save recording:", error);
        setRecordingStatus("録音の保存に失敗しました。");
      } finally {
        recordingStream?.getTracks().forEach((track) => track.stop());
        recordingStream = null;
        mediaRecorder = null;
        recordingChunks = [];
        startRecordingBtn.disabled = false;
        stopRecordingBtn.disabled = true;
      }
    }, { once: true });

    mediaRecorder.start();
    setRecordingStatus(recordingMode === "replace-current" ? "録音中です。停止すると差し替えます。" : "録音中です。停止すると新規音声になります。");
    startRecordingBtn.disabled = true;
    stopRecordingBtn.disabled = false;
  } catch (error) {
    console.error("Failed to start recording:", error);
    setRecordingStatus("録音を開始できませんでした。");
  }
}

function stopRecording() {
  if (mediaRecorder?.state === "recording") mediaRecorder.stop();
}

function handleDropFile(file) {
  if (!file) return;
  setAudioSource(file).catch((error) => {
    console.error("Failed to handle file:", error);
    alert("音声ファイルを読み込めませんでした。");
  });
}

function seekFromWaveform(event) {
  if (!waveformContainer || !player.duration) return;
  const rect = waveformContainer.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const ratio = Math.min(1, Math.max(0, x / rect.width));
  player.currentTime = ratio * player.duration;
}

waveformContainer.addEventListener("click", seekFromWaveform);
waveformContainer.addEventListener("mousemove", (event) => {
  hoveredMemoIndex = getWaveformMemoIndexAtX(event.clientX);
  drawWaveform();
});
waveformContainer.addEventListener("mouseleave", () => {
  hoveredMemoIndex = null;
  waveformMemoTooltip.classList.add("hidden");
  drawWaveform();
});

drop.addEventListener("dragover", (event) => {
  event.preventDefault();
  drop.classList.add("dragover");
});
drop.addEventListener("dragleave", () => drop.classList.remove("dragover"));
drop.addEventListener("drop", (event) => {
  event.preventDefault();
  drop.classList.remove("dragover");
  handleDropFile(event.dataTransfer.files[0]);
});

selectFileBtn.addEventListener("click", () => fileInput.click());
projectImportBtn.addEventListener("click", () => projectImportInput.click());
recordProjectBtn.addEventListener("click", () => startRecording("new-project"));
startRecordingBtn.addEventListener("click", () => startRecording("new-project"));
stopRecordingBtn.addEventListener("click", stopRecording);
replaceAudioBtn.addEventListener("click", () => startRecording("replace-current"));
projectExportBtn.addEventListener("click", exportCurrentProject);
backBtn.addEventListener("click", showUploadScreen);
infoBtn.addEventListener("click", showInfoPopup);
closeInfoBtn.addEventListener("click", hideInfoPopup);
infoPopup.addEventListener("click", (event) => {
  if (event.target?.dataset.closePopup !== undefined) hideInfoPopup();
});
projectImportInfoBtn.addEventListener("click", () => projectImportInput.click());
projectExportInfoBtn.addEventListener("click", exportCurrentProject);
exportMemosBtn.addEventListener("click", exportMemosAsText);
confirmProjectBtn.addEventListener("click", () => createProject());

projectNameInput.addEventListener("compositionstart", () => { projectNameComposition = true; });
projectNameInput.addEventListener("compositionend", () => { projectNameComposition = false; });
projectNameInput.addEventListener("keydown", (event) => {
  const composing = event.isComposing || projectNameComposition;
  if (event.key === "Enter" && !composing) {
    event.preventDefault();
    createProject();
  } else if (event.key === "Escape") {
    event.preventDefault();
    projectNamePrompt.classList.add("hidden");
    projectNameInput.value = "";
    selectedFileName.textContent = "未選択";
    pendingAudioFile = null;
    pendingAudioDataUrl = null;
  }
});

fileInput.addEventListener("change", (event) => handleDropFile(event.target.files[0]));
projectImportInput.addEventListener("change", (event) => {
  importProjectFile(event.target.files[0]);
  event.target.value = "";
});
player.addEventListener("timeupdate", () => {
  timeDisplay.textContent = formatTime(player.currentTime);
  drawWaveform();
});
player.addEventListener("loadedmetadata", () => {
  timeDisplay.textContent = formatTime(player.currentTime);
  drawWaveform();
});
player.addEventListener("ended", () => {
  captureTime = null;
  drawWaveform();
});
if (volumeSlider) {
  volumeSlider.addEventListener("input", (event) => {
    player.volume = Math.min(1, Math.max(0, Number(event.target.value) / 100));
    updateVolumeUI();
  });
}
addMemoBtn.addEventListener("click", addMemo);
addNoteBtn.addEventListener("click", addNote);

memoInput.addEventListener("compositionstart", () => { memoComposition = true; });
memoInput.addEventListener("compositionend", () => { memoComposition = false; });
memoInput.addEventListener("input", () => {
  if (captureTime === null && player.currentTime) captureTime = player.currentTime.toFixed(2);
});
memoInput.addEventListener("keydown", (event) => {
  const composing = event.isComposing || memoComposition;
  if (event.key === "Enter" && !composing) {
    event.preventDefault();
    addMemo();
  }
});

noteInput.addEventListener("compositionstart", () => { noteComposition = true; });
noteInput.addEventListener("compositionend", () => { noteComposition = false; });
noteInput.addEventListener("keydown", (event) => {
  const composing = event.isComposing || noteComposition;
  if (event.key === "Enter" && !composing) {
    event.preventDefault();
    addNote();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !infoPopup.classList.contains("hidden")) {
    hideInfoPopup();
    return;
  }
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

  switch (event.code) {
    case "Space":
      event.preventDefault();
      if (player.src) player.paused ? player.play() : player.pause();
      break;
    case "ArrowLeft":
      event.preventDefault();
      if (player.src) player.currentTime = Math.max(0, player.currentTime - 5);
      break;
    case "ArrowRight":
      event.preventDefault();
      if (player.src) player.currentTime = Math.min(player.duration || 0, player.currentTime + 5);
      break;
  }
});

function init() {
  loadProjects();
  player.volume = 1;
  updateVolumeUI();
  setRecordingStatus("ブラウザ内に保存します。");
  updateCurrentProjectMemos();
  renderFileList();
}

init();
