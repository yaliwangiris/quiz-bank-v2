/* ==============================
   律師一試考題專家 — app.js
   ============================== */

// --- 科目設定 ---
const SUBJECTS = [
  { code: '1301', name: '刑法', full: '刑法、刑事訴訟法、法律倫理', icon: '⚖️' },
  { code: '2301', name: '憲法', full: '憲法、行政法、國際公法、國際私法', icon: '📜' },
  { code: '3301', name: '民法', full: '民法、民事訴訟法', icon: '🏛️' },
  { code: '4301', name: '商法', full: '公司法、保險法、票據法、證券交易法、強制執行法、法學英文', icon: '💼' },
];

const SUBJECT_SHORT = {};
const SUBJECT_LABELS = {};
SUBJECTS.forEach(s => {
  SUBJECT_SHORT[s.code] = s.name;
  SUBJECT_LABELS[s.code] = s.full;
});

// --- State ---
const state = {
  manifest: [],
  bankData: {},           // filename -> questions[] (cache)
  questions: [],
  currentIndex: 0,
  score: 0,
  answered: false,
  maxQuestions: 20,
  results: [],            // { questionId, correct, subjectCode }
  multiSelected: new Set(),
  selectedYear: null,
  quizOrigin: null,     // which screen started the quiz: 'subject' | 'year-subject'
};

// --- DOM refs ---
const $ = (id) => document.getElementById(id);

// --- Utilities ---
function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function parseFileName(filename) {
  const base = filename.replace('.json', '');
  const parts = base.split('_');
  return { year: parseInt(parts[0], 10), subjectCode: parts[1] };
}

function showScreen(id) {
  document.querySelectorAll('#app > section').forEach(s => s.classList.add('hidden'));
  $(id).classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- Animations ---
function launchConfetti() {
  const canvas = document.createElement('canvas');
  canvas.id = 'confetti-canvas';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();

  const colors = ['#4f46e5', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4', '#ec4899', '#facc15'];
  const particles = [];

  // 3 burst points: left, center, right
  const bursts = [
    { x: canvas.width * 0.25, y: canvas.height * 0.7 },
    { x: canvas.width * 0.5,  y: canvas.height * 0.6 },
    { x: canvas.width * 0.75, y: canvas.height * 0.7 },
  ];

  bursts.forEach(origin => {
    for (let i = 0; i < 40; i++) {
      const angle = (Math.random() * Math.PI * 0.8) + Math.PI * 0.1; // upward spread
      const speed = Math.random() * 12 + 6;
      particles.push({
        x: origin.x + (Math.random() - 0.5) * 30,
        y: origin.y,
        vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
        vy: -Math.sin(angle) * speed,
        size: Math.random() * 7 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
        opacity: 1,
        shape: Math.random() > 0.4 ? 'rect' : 'circle',
      });
    }
  });

  let frame = 0;
  const maxFrames = 140;

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx;
      p.vy += 0.35;
      p.y += p.vy;
      p.vx *= 0.99;
      p.rotation += p.rotationSpeed;
      p.opacity = Math.max(0, 1 - (frame / maxFrames) * 1.2);

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation * Math.PI / 180);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;

      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    frame++;
    if (frame < maxFrames) {
      requestAnimationFrame(animate);
    } else {
      canvas.remove();
    }
  }
  requestAnimationFrame(animate);
}

function showSadCat() {
  const overlay = document.createElement('div');
  overlay.className = 'sad-cat-overlay';
  overlay.innerHTML = `
    <div class="sad-cat-emoji">
      😿
      <div class="tear tear-left"></div>
      <div class="tear tear-right"></div>
      <div class="tear tear-left2"></div>
      <div class="tear tear-right2"></div>
    </div>`;
  document.body.appendChild(overlay);

  // Add wobble after initial bounce
  setTimeout(() => {
    const emoji = overlay.querySelector('.sad-cat-emoji');
    if (emoji) emoji.classList.add('sad-cat-wobble');
  }, 600);

  // Fade out and remove
  setTimeout(() => {
    overlay.classList.add('fade-out');
    setTimeout(() => overlay.remove(), 500);
  }, 2200);
}

// --- Notes (localStorage) ---
const NOTES_KEY = 'quiz_notes';

function loadAllNotes() {
  try { return JSON.parse(localStorage.getItem(NOTES_KEY) || '{}'); } catch { return {}; }
}

function loadNote(questionId) {
  return loadAllNotes()[questionId] || '';
}

function saveNote(questionId, text) {
  const notes = loadAllNotes();
  if (text.trim()) {
    notes[questionId] = text;
  } else {
    delete notes[questionId];
  }
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

function deleteNote(questionId) {
  const notes = loadAllNotes();
  delete notes[questionId];
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

// --- Init ---
async function init() {
  try {
    const res = await fetch('bank/manifest.json');
    if (!res.ok) throw new Error('manifest fetch failed');
    const manifest = await res.json();
    state.manifest = manifest.files || [];

    if (!state.manifest.length) {
      $('bank-status').textContent = '題庫為空';
      $('bank-status').className = 'bank-status error';
      return;
    }

    // Load saved max questions preference
    try {
      const prefs = JSON.parse(localStorage.getItem('quiz_preferences') || '{}');
      if (prefs.maxQuestions) {
        state.maxQuestions = prefs.maxQuestions;
        $('max-questions-subject').value = prefs.maxQuestions;
      }
    } catch (e) { /* ignore */ }

    $('bank-status').textContent = `題庫就緒 (${state.manifest.length} 個檔案)`;
    $('bank-status').className = 'bank-status ready';

  } catch (e) {
    console.error('Init failed:', e);
    $('bank-status').textContent = '題庫載入失敗';
    $('bank-status').className = 'bank-status error';
  }

  // --- Wire up events ---

  // Home: mode selection
  $('btn-mode-subject').addEventListener('click', showPickSubject);
  $('btn-mode-year').addEventListener('click', showPickYear);

  // Back buttons
  $('btn-back-from-subject').addEventListener('click', () => showScreen('screen-home'));
  $('btn-back-from-year').addEventListener('click', () => showScreen('screen-home'));
  $('btn-back-from-year-subject').addEventListener('click', () => showScreen('screen-pick-year'));

  // Quiz controls
  $('btn-exit').addEventListener('click', exitQuiz);
  $('btn-next').addEventListener('click', nextQuestion);
  $('btn-restart').addEventListener('click', goHome);

  // Note controls
  $('btn-note-toggle').addEventListener('click', toggleNote);
  $('btn-note-save').addEventListener('click', onNoteSave);
  $('btn-note-clear').addEventListener('click', onNoteClear);

  // Max questions
  $('max-questions-subject').addEventListener('change', (e) => {
    state.maxQuestions = Math.max(1, parseInt(e.target.value, 10) || 20);
    try { localStorage.setItem('quiz_preferences', JSON.stringify({ maxQuestions: state.maxQuestions })); } catch (e) { /* ignore */ }
  });
}

// ===========================
// PICK SUBJECT (依科目練習)
// ===========================
function showPickSubject() {
  showScreen('screen-pick-subject');
  const container = $('subject-list');
  container.innerHTML = '';

  SUBJECTS.forEach(s => {
    // Count available questions for this subject across all years
    const files = state.manifest.filter(f => parseFileName(f).subjectCode === s.code);
    const btn = document.createElement('button');
    btn.className = 'pick-card';
    btn.innerHTML = `
      <div class="pick-card-icon">${s.icon}</div>
      <div class="pick-card-body">
        <div class="pick-card-title">${s.name}</div>
        <div class="pick-card-sub">${s.full}（${files.length} 個年度）</div>
      </div>
      <div class="pick-card-arrow">→</div>`;
    btn.addEventListener('click', () => startBySubject(s.code));
    container.appendChild(btn);
  });
}

async function startBySubject(subjectCode) {
  state.quizOrigin = 'subject';
  showScreen('screen-loading');

  try {
    // Fetch all files for this subject across all years
    const files = state.manifest.filter(f => parseFileName(f).subjectCode === subjectCode);
    await fetchFiles(files);

    // Combine all questions from these files
    let pool = [];
    files.forEach(f => {
      (state.bankData[f] || []).forEach(q => {
        if (q.choices && q.choices.length > 0 && q.correct_choice_ids && q.correct_choice_ids.length > 0) {
          pool.push(q);
        }
      });
    });

    if (pool.length === 0) {
      alert('此科目無可用題目。');
      showScreen('screen-pick-subject');
      return;
    }

    // Shuffle across all years, slice to max
    pool = shuffle(pool).slice(0, state.maxQuestions);
    prepareAndStartQuiz(pool);

  } catch (e) {
    console.error(e);
    alert('載入失敗：' + e.message);
    showScreen('screen-pick-subject');
  }
}

// ===========================
// PICK YEAR (依年份練習)
// ===========================
function showPickYear() {
  showScreen('screen-pick-year');
  const container = $('year-list');
  container.innerHTML = '';

  // Get unique years from manifest
  const yearSet = new Set();
  state.manifest.forEach(f => yearSet.add(parseFileName(f).year));
  const years = [...yearSet].sort((a, b) => b - a); // newest first

  years.forEach(year => {
    const files = state.manifest.filter(f => parseFileName(f).year === year);
    const btn = document.createElement('button');
    btn.className = 'pick-card';
    btn.innerHTML = `
      <div class="pick-card-icon">📅</div>
      <div class="pick-card-body">
        <div class="pick-card-title">民國 ${year} 年</div>
        <div class="pick-card-sub">${files.length} 個科目可用</div>
      </div>
      <div class="pick-card-arrow">→</div>`;
    btn.addEventListener('click', () => showPickYearSubject(year));
    container.appendChild(btn);
  });
}

function showPickYearSubject(year) {
  state.selectedYear = year;
  showScreen('screen-pick-year-subject');
  $('year-subject-title').textContent = `民國 ${year} 年 — 選擇科目`;

  const container = $('year-subject-list');
  container.innerHTML = '';

  // Which subjects are available for this year?
  const availableFiles = state.manifest.filter(f => parseFileName(f).year === year);
  const availableCodes = new Set(availableFiles.map(f => parseFileName(f).subjectCode));

  SUBJECTS.forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'pick-card';
    const available = availableCodes.has(s.code);
    if (!available) btn.disabled = true;

    btn.innerHTML = `
      <div class="pick-card-icon">${s.icon}</div>
      <div class="pick-card-body">
        <div class="pick-card-title">${s.name}</div>
        <div class="pick-card-sub">${s.full}</div>
      </div>
      <div class="pick-card-arrow">${available ? '→' : '—'}</div>`;

    if (available) {
      btn.addEventListener('click', () => startByYearSubject(year, s.code));
    }
    container.appendChild(btn);
  });
}

async function startByYearSubject(year, subjectCode) {
  state.quizOrigin = 'year-subject';
  showScreen('screen-loading');

  try {
    const filename = `${year}_${subjectCode}.json`;
    await fetchFiles([filename]);

    let pool = [];
    (state.bankData[filename] || []).forEach(q => {
      if (q.choices && q.choices.length > 0 && q.correct_choice_ids && q.correct_choice_ids.length > 0) {
        pool.push(q);
      }
    });

    if (pool.length === 0) {
      alert('此題庫無可用題目。');
      showScreen('screen-pick-year-subject');
      return;
    }

    // Shuffle the question order (but keep all questions for a single year+subject)
    pool = shuffle(pool);
    prepareAndStartQuiz(pool);

  } catch (e) {
    console.error(e);
    alert('載入失敗：' + e.message);
    showScreen('screen-pick-year-subject');
  }
}

// ===========================
// SHARED: Fetch, Prepare, Quiz
// ===========================
async function fetchFiles(files) {
  const toFetch = files.filter(f => !state.bankData[f]);
  if (toFetch.length === 0) return;

  const results = await Promise.allSettled(
    toFetch.map(async f => {
      const res = await fetch(`bank/${f}`);
      if (!res.ok) throw new Error(`Failed: ${f}`);
      const data = await res.json();
      return { file: f, data: Array.isArray(data) ? data : [] };
    })
  );
  results.forEach(r => {
    if (r.status === 'fulfilled') state.bankData[r.value.file] = r.value.data;
  });
}

function prepareAndStartQuiz(pool) {
  // Shuffle choices for each question
  state.questions = pool.map(q => {
    const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
    const shuffledChoices = shuffle(q.choices).map((c, i) => ({
      choice_id: c.choice_id,
      text: c.text,
      label: labels[i] || String(i + 1),
    }));
    return { ...q, _choices: shuffledChoices };
  });

  state.currentIndex = 0;
  state.score = 0;
  state.answered = false;
  state.results = [];
  state.multiSelected = new Set();

  showQuestion(0);
}

// ===========================
// QUIZ
// ===========================
function showQuestion(index) {
  showScreen('screen-quiz');
  state.currentIndex = index;
  state.answered = false;
  state.multiSelected = new Set();

  const q = state.questions[index];
  const total = state.questions.length;

  // Progress
  $('progress-text').textContent = `${index + 1} / ${total}`;
  $('progress-fill').style.width = `${((index + 1) / total) * 100}%`;

  // Meta
  $('question-meta').textContent = `民國 ${q.year} 年 第 ${q.question_no} 題 — ${SUBJECT_SHORT[q.subject_code] || q.subject_code}`;

  // Type badge
  const isMultiple = q.question_type === 'multiple';
  const badge = $('question-type-badge');
  if (isMultiple) badge.classList.remove('hidden');
  else badge.classList.add('hidden');

  // Stem
  $('question-stem').textContent = q.stem;

  // Choices
  const container = $('choices-container');
  container.innerHTML = '';

  const oldSubmit = document.querySelector('.btn-submit-multi');
  if (oldSubmit) oldSubmit.remove();

  q._choices.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.dataset.choiceId = c.choice_id;
    btn.innerHTML = `<span class="choice-label">${c.label}</span><span class="choice-text">${escapeHtml(c.text)}</span>`;

    if (isMultiple) {
      btn.addEventListener('click', () => handleMultiSelect(btn, c.choice_id));
    } else {
      btn.addEventListener('click', () => handleAnswer([c.choice_id]));
    }

    container.appendChild(btn);
  });

  if (isMultiple) {
    const submitBtn = document.createElement('button');
    submitBtn.className = 'btn btn-primary btn-lg btn-submit-multi';
    submitBtn.textContent = '確認作答';
    submitBtn.addEventListener('click', () => {
      if (state.multiSelected.size === 0) return;
      handleAnswer([...state.multiSelected]);
    });
    container.after(submitBtn);
  }

  // Hide feedback & next
  $('feedback-area').classList.add('hidden');
  $('feedback-area').innerHTML = '';
  $('btn-next').classList.add('hidden');

  // Note section: reset to collapsed state
  setupNoteForQuestion(q.question_id);
}

function handleMultiSelect(btn, choiceId) {
  if (state.answered) return;
  if (state.multiSelected.has(choiceId)) {
    state.multiSelected.delete(choiceId);
    btn.classList.remove('selected');
  } else {
    state.multiSelected.add(choiceId);
    btn.classList.add('selected');
  }
}

function handleAnswer(selectedIds) {
  if (state.answered) return;
  state.answered = true;

  const q = state.questions[state.currentIndex];
  const correctIds = q.correct_choice_ids || [];

  // Grade
  const isCorrect =
    selectedIds.length === correctIds.length &&
    selectedIds.every(id => correctIds.includes(id));

  if (isCorrect) state.score++;

  state.results.push({
    questionId: q.question_id,
    correct: isCorrect,
    subjectCode: q.subject_code,
  });

  // Style choices
  const buttons = $('choices-container').querySelectorAll('.choice-btn');
  buttons.forEach(btn => {
    const cid = btn.dataset.choiceId;
    const isThisCorrect = correctIds.includes(cid);
    const isThisSelected = selectedIds.includes(cid);

    if (isThisCorrect) btn.classList.add('correct');
    else if (isThisSelected) btn.classList.add('wrong');
    else btn.classList.add('dimmed');
  });

  const submitBtn = document.querySelector('.btn-submit-multi');
  if (submitBtn) submitBtn.remove();

  // Correct choice labels for display
  const correctLabels = q._choices
    .filter(c => correctIds.includes(c.choice_id))
    .map(c => c.label);

  // Feedback
  const feedbackEl = $('feedback-area');
  feedbackEl.classList.remove('hidden');

  // Disputed question notice
  const disputedHtml = q.disputed
    ? `<div class="disputed-notice">${escapeHtml(q.answer_note || '本題在當年考試中為送分題。')}</div>`
    : '';

  if (isCorrect) {
    feedbackEl.innerHTML = '<div class="feedback-correct">正確！</div>' + disputedHtml;
    launchConfetti();
  } else {
    const explanation = q.explanation ||
      `正確答案為 ${correctLabels.join(', ')}。請回到題幹與選項逐句對照關鍵要件。`;
    feedbackEl.innerHTML = `
      <div class="feedback-wrong">答錯了，沒關係再接再厲！</div>
      <div class="explanation-box">
        <h4>正確答案：${correctLabels.join(', ')}</h4>
        <p>${escapeHtml(explanation)}</p>
      </div>` + disputedHtml;
    showSadCat();
  }

  // Next button
  const nextBtn = $('btn-next');
  nextBtn.classList.remove('hidden');
  nextBtn.textContent = state.currentIndex < state.questions.length - 1 ? '下一題 →' : '查看結果';

  // Auto-open note if it has saved content
  const savedNote = loadNote(q.question_id);
  if (savedNote) {
    openNote();
  }
}

function nextQuestion() {
  if (state.currentIndex < state.questions.length - 1) {
    showQuestion(state.currentIndex + 1);
  } else {
    showResults();
  }
}

// ===========================
// RESULTS
// ===========================
function showResults() {
  showScreen('screen-result');

  const total = state.questions.length;
  const correct = state.score;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  $('result-score').textContent = correct;
  $('result-accuracy').textContent = accuracy + '%';
  $('result-total').textContent = total;

  // Breakdown by subject code
  const bySubject = {};
  state.results.forEach(r => {
    if (!bySubject[r.subjectCode]) bySubject[r.subjectCode] = { total: 0, correct: 0 };
    bySubject[r.subjectCode].total++;
    if (r.correct) bySubject[r.subjectCode].correct++;
  });

  const breakdownEl = $('result-breakdown');
  const codes = Object.keys(bySubject).sort();

  if (codes.length > 1) {
    let html = '<h3>各科正確率</h3>';
    codes.forEach(code => {
      const s = bySubject[code];
      const pct = Math.round((s.correct / s.total) * 100);
      const label = SUBJECT_SHORT[code] || code;
      html += `
        <div class="breakdown-row">
          <span class="breakdown-label">${label}</span>
          <div class="breakdown-bar-wrap"><div class="breakdown-bar" style="width:${pct}%"></div></div>
          <span class="breakdown-value">${s.correct}/${s.total} (${pct}%)</span>
        </div>`;
    });
    breakdownEl.innerHTML = html;
  } else {
    breakdownEl.innerHTML = '';
  }
}

// ===========================
// NOTES
// ===========================
function setupNoteForQuestion(questionId) {
  const textarea = $('note-textarea');
  const indicator = $('note-indicator');
  const toggleBtn = $('btn-note-toggle');
  const body = $('note-body');
  const status = $('note-status');

  // Load saved note
  const saved = loadNote(questionId);
  textarea.value = saved;

  // Always start collapsed
  body.classList.add('hidden');
  toggleBtn.classList.remove('open');

  // Show indicator dot if note has content
  if (saved) {
    indicator.classList.remove('hidden');
  } else {
    indicator.classList.add('hidden');
  }

  // Clear status
  status.textContent = '';
}

function toggleNote() {
  const body = $('note-body');
  const toggleBtn = $('btn-note-toggle');
  if (body.classList.contains('hidden')) {
    openNote();
  } else {
    body.classList.add('hidden');
    toggleBtn.classList.remove('open');
  }
}

function openNote() {
  const body = $('note-body');
  const toggleBtn = $('btn-note-toggle');
  body.classList.remove('hidden');
  toggleBtn.classList.add('open');
}

function onNoteSave() {
  const q = state.questions[state.currentIndex];
  if (!q) return;
  const text = $('note-textarea').value;
  saveNote(q.question_id, text);

  // Update indicator
  const indicator = $('note-indicator');
  if (text.trim()) {
    indicator.classList.remove('hidden');
  } else {
    indicator.classList.add('hidden');
  }

  // Flash status
  const status = $('note-status');
  status.textContent = '已儲存';
  setTimeout(() => { status.textContent = ''; }, 2000);
}

function onNoteClear() {
  const q = state.questions[state.currentIndex];
  if (!q) return;

  $('note-textarea').value = '';
  deleteNote(q.question_id);
  $('note-indicator').classList.add('hidden');

  const status = $('note-status');
  status.textContent = '已清除';
  setTimeout(() => { status.textContent = ''; }, 2000);
}

// ===========================
// EXIT & GO HOME
// ===========================
function exitQuiz() {
  if (!confirm('確定要結束測驗嗎？')) return;

  // Go back to the screen that started the quiz
  if (state.quizOrigin === 'subject') {
    showScreen('screen-pick-subject');
  } else if (state.quizOrigin === 'year-subject') {
    showPickYearSubject(state.selectedYear);
  } else {
    showScreen('screen-home');
  }

  state.questions = [];
  state.currentIndex = 0;
  state.score = 0;
  state.answered = false;
  state.results = [];
  state.multiSelected = new Set();
}

function goHome() {
  state.questions = [];
  state.currentIndex = 0;
  state.score = 0;
  state.answered = false;
  state.results = [];
  state.multiSelected = new Set();
  state.quizOrigin = null;
  showScreen('screen-home');
}

// --- Start ---
document.addEventListener('DOMContentLoaded', init);
