// Global State
let THEORY_DATA = { chapters: [], shortcuts: [] };
let MCQS_DATA = [];
let currentUser = null;
let currentLang = 'hi';
let captchas = { login: '', reg: '' };
let selectedRegAvatar = '';
let activeChapterId = null;

// CBT Exam State
let examQuestions = [];
let currentQIndex = 0;
let userAnswers = {};
let markedReview = {};
let examTimerInterval = null;
let secondsLeft = 1200;

const AVATARS = [
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%232563eb'/><circle cx='50' cy='38' r='18' fill='%23fde68a'/><path d='M20 90 Q50 60 80 90' fill='%23ffffff'/></svg>",
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23059669'/><circle cx='50' cy='38' r='18' fill='%23fed7aa'/><path d='M20 90 Q50 60 80 90' fill='%23fef3c7'/></svg>",
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%237c3aed'/><circle cx='50' cy='38' r='18' fill='%23fbcfe8'/><path d='M20 90 Q50 60 80 90' fill='%23e0e7ff'/></svg>",
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23d97706'/><circle cx='50' cy='38' r='18' fill='%23fef08a'/><path d='M20 90 Q50 60 80 90' fill='%231e293b'/></svg>"
];

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// App Entry: 2-Second Kaushalji Animation -> Then Login/Registration or Active Session
document.addEventListener('DOMContentLoaded', async () => {
  initAvatarPicker();
  generateCaptcha('login');
  generateCaptcha('reg');

  const dataPromise = loadExternalData();

  // Exact 2-second splash animation timer
  setTimeout(async () => {
    await dataPromise;
    const splash = document.getElementById('splashScreen');
    splash.classList.add('splash-exit');
    setTimeout(() => {
      splash.classList.add('hidden');
      checkExistingSession();
    }, 320);
  }, 2000);
});

async function loadExternalData() {
  try {
    const [tRes, mRes] = await Promise.all([
      fetch('./theory.json'),
      fetch('./mcqs.json')
    ]);
    THEORY_DATA = await tRes.json();
    MCQS_DATA = await mRes.json();
  } catch (e) {
    console.error('JSON fetch error. Run via local HTTP server.', e);
  }
}

// --- CAPTCHA ENGINE ---
function generateCaptcha(type) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  captchas[type] = code;

  const canvas = document.getElementById(type === 'login' ? 'loginCaptchaCanvas' : 'regCaptchaCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 6; i++) {
    ctx.strokeStyle = `rgba(96, 165, 250, ${Math.random() * 0.6 + 0.2})`;
    ctx.beginPath();
    ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
    ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
    ctx.stroke();
  }

  ctx.font = 'bold 22px monospace';
  ctx.fillStyle = '#38bdf8';
  for (let i = 0; i < code.length; i++) {
    ctx.save();
    ctx.translate(18 + i * 24, 30);
    ctx.rotate((Math.random() - 0.5) * 0.35);
    ctx.fillText(code[i], 0, 0);
    ctx.restore();
  }
}

function speakCaptcha(type) {
  if (!('speechSynthesis' in window)) return;
  const utter = new SpeechSynthesisUtterance(captchas[type].split('').join(' '));
  utter.rate = 0.8;
  speechSynthesis.speak(utter);
}

// --- AVATAR & PHOTO COMPRESSION ---
function initAvatarPicker() {
  selectedRegAvatar = AVATARS[0];
  document.getElementById('regPreviewImg').src = selectedRegAvatar;
  document.getElementById('avatarSelector').innerHTML = AVATARS.map((src, idx) => `
    <img src="${src}" onclick="selectPresetAvatar(${idx})" class="w-7 h-7 rounded-full cursor-pointer border border-slate-600 hover:border-blue-400">
  `).join('');
}

function selectPresetAvatar(idx) {
  selectedRegAvatar = AVATARS[idx];
  document.getElementById('regPreviewImg').src = selectedRegAvatar;
}

function handlePhotoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(event) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      canvas.width = 140;
      canvas.height = 140;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, 140, 140);
      selectedRegAvatar = canvas.toDataURL('image/jpeg', 0.72);
      document.getElementById('regPreviewImg').src = selectedRegAvatar;
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

// --- LOCALSTORAGE AUTH ---
function getUsersDB() {
  return JSON.parse(localStorage.getItem('ccc_users_db') || '{}');
}

function saveUsersDB(db) {
  localStorage.setItem('ccc_users_db', JSON.stringify(db));
}

function switchAuthTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('loginForm').classList.toggle('hidden', !isLogin);
  document.getElementById('regForm').classList.toggle('hidden', isLogin);
  document.getElementById('tabLoginBtn').className = isLogin
    ? 'flex-1 py-2.5 rounded-lg text-sm font-bold bg-blue-600 text-white transition'
    : 'flex-1 py-2.5 rounded-lg text-sm font-bold text-slate-400 hover:text-white transition';
  document.getElementById('tabRegBtn').className = !isLogin
    ? 'flex-1 py-2.5 rounded-lg text-sm font-bold bg-emerald-600 text-white transition'
    : 'flex-1 py-2.5 rounded-lg text-sm font-bold text-slate-400 hover:text-white transition';
  generateCaptcha(isLogin ? 'login' : 'reg');
}

function checkUsernameLive() {
  const u = document.getElementById('regUser').value.trim().toLowerCase();
  const msg = document.getElementById('userAvailMsg');
  if (!u) { msg.textContent = ''; return; }
  const db = getUsersDB();
  if (db[u]) {
    msg.textContent = '✗ Username already taken';
    msg.className = 'text-[11px] font-medium text-rose-400';
  } else {
    msg.textContent = '✓ Username available';
    msg.className = 'text-[11px] font-medium text-emerald-400';
  }
}

function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const username = document.getElementById('regUser').value.trim().toLowerCase();
  const password = document.getElementById('regPass').value;
  const capInput = document.getElementById('regCaptchaInput').value.trim().toUpperCase();
  const err = document.getElementById('regErr');

  if (capInput !== captchas.reg) {
    err.textContent = 'Invalid Captcha! Please try again.';
    err.classList.remove('hidden');
    generateCaptcha('reg');
    return;
  }
  const db = getUsersDB();
  if (db[username]) {
    err.textContent = 'Username already exists!';
    err.classList.remove('hidden');
    return;
  }

  db[username] = {
    name,
    username,
    password,
    avatar: selectedRegAvatar,
    completedChapters: [],
    quizHistory: [],
    xp: 100
  };
  saveUsersDB(db);
  localStorage.setItem('ccc_active_user', username);
  err.classList.add('hidden');
  bootPortal(db[username]);
}

function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUser').value.trim().toLowerCase();
  const password = document.getElementById('loginPass').value;
  const capInput = document.getElementById('loginCaptchaInput').value.trim().toUpperCase();
  const err = document.getElementById('loginErr');

  if (capInput !== captchas.login) {
    err.textContent = 'Incorrect Security Captcha!';
    err.classList.remove('hidden');
    generateCaptcha('login');
    return;
  }
  const db = getUsersDB();
  if (!db[username] || db[username].password !== password) {
    err.textContent = 'Invalid Username or Password!';
    err.classList.remove('hidden');
    generateCaptcha('login');
    return;
  }
  err.classList.add('hidden');
  localStorage.setItem('ccc_active_user', username);
  bootPortal(db[username]);
}

function loginDemoUser() {
  const db = getUsersDB();
  if (!db['student_demo']) {
    db['student_demo'] = {
      name: 'Kaushalji Demo Student',
      username: 'student_demo',
      password: '123',
      avatar: AVATARS[0],
      completedChapters: [1, 2],
      quizHistory: [{ date: 'Today', mode: '25 Random MCQs', score: 21, total: 25, percent: 84, grade: 'A' }],
      xp: 350
    };
    saveUsersDB(db);
  }
  localStorage.setItem('ccc_active_user', 'student_demo');
  bootPortal(db['student_demo']);
}

function checkExistingSession() {
  const active = localStorage.getItem('ccc_active_user');
  const db = getUsersDB();
  if (active && db[active]) {
    bootPortal(db[active]);
  } else {
    document.getElementById('authView').classList.remove('hidden');
  }
}

function logoutUser() {
  clearInterval(examTimerInterval);
  localStorage.removeItem('ccc_active_user');
  currentUser = null;
  document.getElementById('appView').classList.add('hidden');
  document.getElementById('authView').classList.remove('hidden');
  generateCaptcha('login');
}

function syncCurrentUser() {
  if (!currentUser) return;
  const db = getUsersDB();
  db[currentUser.username] = currentUser;
  saveUsersDB(db);
}

// --- PORTAL NAVIGATION & RENDERING ---
function bootPortal(user) {
  currentUser = user;
  document.getElementById('authView').classList.add('hidden');
  document.getElementById('appView').classList.remove('hidden');

  document.getElementById('headerAvatar').src = user.avatar;
  document.getElementById('headerUsername').textContent = user.username;
  document.getElementById('dashAvatar').src = user.avatar;
  document.getElementById('dashName').textContent = user.name;
  document.getElementById('cbtUserImg').src = user.avatar;
  document.getElementById('cbtUserName').textContent = user.name;

  updateDashboard();
  renderTheory();
  renderShortcuts();
  switchPage('home');
}

function switchPage(page) {
  ['home', 'theory', 'shortcuts', 'quiz'].forEach(p => {
    document.getElementById(`page-${p}`).classList.add('hidden');
    const btn = document.getElementById(`nav-${p}`);
    if (btn) btn.className = 'nav-btn px-3 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:text-white';
  });
  document.getElementById(`page-${page}`).classList.remove('hidden');
  const activeBtn = document.getElementById(`nav-${page}`);
  if (activeBtn) activeBtn.className = 'nav-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white';

  // Highlight active primary div below header
  const dTheory = document.getElementById('mainDivTheory');
  const dMcqs = document.getElementById('mainDivMcqs');
  dTheory.classList.toggle('ring-2', page === 'theory');
  dTheory.classList.toggle('ring-blue-400', page === 'theory');
  dMcqs.classList.toggle('ring-2', page === 'quiz');
  dMcqs.classList.toggle('ring-emerald-400', page === 'quiz');

  if (page === 'home') updateDashboard();
}

function openMcqCountSelector() {
  clearInterval(examTimerInterval);
  switchPage('quiz');
  document.getElementById('quizArena').classList.add('hidden');
  document.getElementById('quizResult').classList.add('hidden');
  document.getElementById('quizLobby').classList.remove('hidden');
}

function toggleLang() {
  currentLang = currentLang === 'hi' ? 'en' : 'hi';
  document.getElementById('langToggleBtn').textContent = currentLang === 'hi' ? 'हिं / EN' : 'EN Only';
  renderTheory();
  if (!document.getElementById('quizArena').classList.contains('hidden')) {
    renderCBTQuestion();
  }
}

function updateDashboard() {
  if (!currentUser) return;
  const chDone = currentUser.completedChapters.length;
  const totalCh = THEORY_DATA.chapters.length || 9;
  const pctSyllabus = Math.round((chDone / totalCh) * 100);

  document.getElementById('dashMeta').textContent = `@${currentUser.username} • Total XP: ${currentUser.xp}`;
  document.getElementById('kpiSyllabus').textContent = `${chDone} / ${totalCh} Ch`;
  document.getElementById('barSyllabus').style.width = `${pctSyllabus}%`;

  const hist = currentUser.quizHistory || [];
  document.getElementById('kpiTests').textContent = hist.length;

  if (hist.length > 0) {
    const avg = Math.round(hist.reduce((a, b) => a + b.percent, 0) / hist.length);
    const best = Math.max(...hist.map(h => h.percent));
    document.getElementById('kpiAvgScore').textContent = `Avg Accuracy: ${avg}%`;
    document.getElementById('kpiGrade').textContent = calculateNIELITGrade(best);
    document.getElementById('kpiReady').textContent = `${Math.min(100, Math.round((pctSyllabus * 0.5) + (avg * 0.5)))}%`;

    document.getElementById('historyContainer').innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="text-slate-400 border-b border-slate-800">
            <tr><th class="py-2">Date</th><th>Test Mode</th><th>Score</th><th>Percentage</th><th>NIELIT Grade</th></tr>
          </thead>
          <tbody class="divide-y divide-slate-800/70">
            ${hist.slice().reverse().map(h => `
              <tr>
                <td class="py-2.5 text-slate-400">${h.date}</td>
                <td class="font-semibold">${h.mode}</td>
                <td>${h.score} / ${h.total}</td>
                <td class="font-bold text-blue-400">${h.percent}%</td>
                <td><span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">${h.grade}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else {
    document.getElementById('kpiGrade').textContent = '--';
    document.getElementById('kpiReady').textContent = `${Math.round(pctSyllabus * 0.5)}%`;
  }
}

// --- THEORY MODULE ---
function renderTheory() {
  const query = (document.getElementById('theorySearch').value || '').toLowerCase();
  const grid = document.getElementById('theoryGrid');
  const chapters = THEORY_DATA.chapters || [];

  const filtered = chapters.filter(c =>
    c.title_en.toLowerCase().includes(query) ||
    c.title_hi.toLowerCase().includes(query) ||
    c.summary_hi.toLowerCase().includes(query) ||
    c.summary_en.toLowerCase().includes(query)
  );

  grid.innerHTML = filtered.map(ch => {
    const isDone = currentUser && currentUser.completedChapters.includes(ch.id);
    const title = currentLang === 'hi' ? ch.title_hi : ch.title_en;
    const summary = currentLang === 'hi' ? ch.summary_hi : ch.summary_en;
    return `
      <div onclick="openChapterModal(${ch.id})" class="cursor-pointer bg-slate-900 hover:bg-slate-800/90 border ${isDone ? 'border-emerald-600/50' : 'border-slate-800'} rounded-2xl p-5 transition flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="px-2.5 py-0.5 rounded-md bg-blue-600/20 text-blue-400 text-xs font-bold">${ch.code}</span>
            ${isDone ? '<span class="text-xs font-bold text-emerald-400">✓ Completed</span>' : '<span class="text-xs text-slate-500">Read Notes →</span>'}
          </div>
          <h3 class="font-bold text-base mb-2">${title}</h3>
          <p class="text-xs text-slate-400 line-clamp-3 leading-relaxed">${summary}</p>
        </div>
        <div class="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-amber-400 font-medium">
          💡 ${currentLang === 'hi' ? ch.trap_hi : ch.trap_en}
        </div>
      </div>
    `;
  }).join('');
}

function openChapterModal(id) {
  const ch = THEORY_DATA.chapters.find(c => c.id === id);
  if (!ch) return;
  activeChapterId = id;
  document.getElementById('modalChCode').textContent = ch.code;
  document.getElementById('modalChTitle').textContent = currentLang === 'hi' ? ch.title_hi : ch.title_en;

  const isDone = currentUser.completedChapters.includes(id);
  const btn = document.getElementById('markReadBtn');
  btn.textContent = isDone ? '✓ Completed' : '✓ Mark as Completed (+50 XP)';

  document.getElementById('modalChBody').innerHTML = `
    <p class="p-3.5 rounded-xl bg-blue-950/40 border border-blue-800/40 text-slate-200">
      ${currentLang === 'hi' ? ch.summary_hi : ch.summary_en}
    </p>
    <div class="space-y-3">
      ${ch.points.map(pt => `
        <div class="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/70">
          <div class="font-bold text-blue-400 mb-1">📌 ${pt.h}</div>
          <div class="text-slate-300 text-xs leading-relaxed">${currentLang === 'hi' ? pt.b_hi : pt.b_en}</div>
        </div>
      `).join('')}
    </div>
    <div class="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
      ⚠️ ${currentLang === 'hi' ? ch.trap_hi : ch.trap_en}
    </div>
  `;
  document.getElementById('chapterModal').classList.remove('hidden');
}

function closeChapterModal() {
  speechSynthesis.cancel();
  document.getElementById('chapterModal').classList.add('hidden');
}

function speakChapter() {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const text = document.getElementById('modalChBody').innerText;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = currentLang === 'hi' ? 'hi-IN' : 'en-US';
  speechSynthesis.speak(utter);
}

function toggleChapterRead() {
  if (!activeChapterId || !currentUser) return;
  if (!currentUser.completedChapters.includes(activeChapterId)) {
    currentUser.completedChapters.push(activeChapterId);
    currentUser.xp += 50;
    syncCurrentUser();
    document.getElementById('markReadBtn').textContent = '✓ Completed';
    renderTheory();
    updateDashboard();
  }
}

// --- SHORTCUTS FLASHCARDS ---
function renderShortcuts() {
  const filter = document.getElementById('shortcutFilter').value;
  const list = (THEORY_DATA.shortcuts || []).filter(s => filter === 'ALL' || s.cat === filter);
  document.getElementById('shortcutsGrid').innerHTML = list.map(item => `
    <div class="flashcard" onclick="this.classList.toggle('flipped')">
      <div class="flashcard-inner">
        <div class="flashcard-front bg-slate-900 border border-slate-800 hover:border-blue-500/60">
          <span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-600/20 text-blue-400 mb-2">${item.cat}</span>
          <div class="text-base font-extrabold text-white">${item.key}</div>
          <div class="text-[10px] text-slate-500 mt-2">Tap to flip ↻</div>
        </div>
        <div class="flashcard-back bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg">
          <div class="text-xs font-bold leading-snug">${item.desc}</div>
        </div>
      </div>
    </div>
  `).join('');
}

// --- RANDOM 25 / 50 / 75 / 100 CBT EXAM ENGINE ---
function fisherYatesShuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function startRandomCBT(count) {
  switchPage('quiz');
  if (!MCQS_DATA || MCQS_DATA.length === 0) return;

  // Shuffle questions randomly using Fisher-Yates
  const shuffled = fisherYatesShuffle(MCQS_DATA);
  examQuestions = shuffled.slice(0, Math.min(count, shuffled.length));

  currentQIndex = 0;
  userAnswers = {};
  markedReview = {};
  // Proportional NIELIT timer (e.g. 25->20m, 50->45m, 75->65m, 100->90m)
  const timeMap = { 25: 20 * 60, 50: 45 * 60, 75: 65 * 60, 100: 90 * 60 };
  secondsLeft = timeMap[count] || examQuestions.length * 50;

  document.getElementById('quizLobby').classList.add('hidden');
  document.getElementById('quizResult').classList.add('hidden');
  document.getElementById('quizArena').classList.remove('hidden');

  startExamTimer();
  renderCBTQuestion();
}

function startExamTimer() {
  clearInterval(examTimerInterval);
  examTimerInterval = setInterval(() => {
    secondsLeft--;
    if (secondsLeft <= 0) {
      clearInterval(examTimerInterval);
      submitCBTExam();
      return;
    }
    const m = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
    const s = String(secondsLeft % 60).padStart(2, '0');
    document.getElementById('examTimer').textContent = `${m}:${s}`;
  }, 1000);
}

function renderCBTQuestion() {
  const q = examQuestions[currentQIndex];
  document.getElementById('qBadge').textContent = `Question ${currentQIndex + 1} of ${examQuestions.length} • Chapter ${q.ch}`;
  document.getElementById('qText').innerHTML = currentLang === 'hi'
    ? `${q.q_hi}<div class="text-xs font-normal text-slate-400 mt-1">${q.q_en}</div>`
    : q.q_en;

  document.getElementById('qOptions').innerHTML = q.opts.map((opt, idx) => {
    const selected = userAnswers[currentQIndex] === idx;
    return `
      <button onclick="selectOption(${idx})" class="w-full text-left p-3.5 rounded-xl border ${selected ? 'bg-blue-600/25 border-blue-500 text-white font-bold' : 'bg-slate-800/70 border-slate-700 hover:border-slate-500 text-slate-200'} text-sm transition flex items-center gap-3">
        <span class="w-7 h-7 rounded-lg ${selected ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'} flex items-center justify-center text-xs font-bold">${String.fromCharCode(65 + idx)}</span>
        <span>${opt}</span>
      </button>
    `;
  }).join('');

  renderPalette();
}

function selectOption(idx) {
  userAnswers[currentQIndex] = idx;
  renderCBTQuestion();
}

function clearResponse() {
  delete userAnswers[currentQIndex];
  renderCBTQuestion();
}

function toggleMarkReview() {
  markedReview[currentQIndex] = !markedReview[currentQIndex];
  renderPalette();
}

function nextQuestion() {
  if (currentQIndex < examQuestions.length - 1) {
    currentQIndex++;
    renderCBTQuestion();
  }
}

function prevQuestion() {
  if (currentQIndex > 0) {
    currentQIndex--;
    renderCBTQuestion();
  }
}

function jumpToQuestion(idx) {
  currentQIndex = idx;
  renderCBTQuestion();
}

function renderPalette() {
  document.getElementById('questionPalette').innerHTML = examQuestions.map((_, idx) => {
    let cls = 'bg-slate-800 text-slate-300';
    if (markedReview[idx]) cls = 'bg-purple-600 text-white';
    else if (userAnswers[idx] !== undefined) cls = 'bg-emerald-600 text-white';
    if (idx === currentQIndex) cls += ' ring-2 ring-blue-400';

    return `<button onclick="jumpToQuestion(${idx})" class="py-2 rounded-lg text-xs font-bold ${cls}">${idx + 1}</button>`;
  }).join('');
}

function calculateNIELITGrade(pct) {
  if (pct >= 85) return 'S';
  if (pct >= 75) return 'A';
  if (pct >= 65) return 'B';
  if (pct >= 55) return 'C';
  if (pct >= 50) return 'D';
  return 'F (Fail)';
}

function submitCBTExam() {
  clearInterval(examTimerInterval);
  let correct = 0;
  examQuestions.forEach((q, idx) => {
    if (userAnswers[idx] === q.ans) correct++;
  });

  const total = examQuestions.length;
  const percent = Math.round((correct / total) * 100);
  const grade = calculateNIELITGrade(percent);
  const passed = percent >= 50;

  currentUser.quizHistory.push({
    date: new Date().toLocaleDateString(),
    mode: `${total} Random MCQs`,
    score: correct,
    total,
    percent,
    grade
  });
  currentUser.xp += correct * 15;
  syncCurrentUser();

  document.getElementById('quizArena').classList.add('hidden');
  document.getElementById('quizResult').classList.remove('hidden');

  const badge = document.getElementById('resBadge');
  badge.textContent = passed ? 'PASSED • KAUSHALJI CCC CERTIFIED' : 'NEEDS MORE PRACTICE';
  badge.className = passed
    ? 'inline-block px-4 py-1.5 rounded-full text-xs font-extrabold bg-emerald-500/20 text-emerald-400'
    : 'inline-block px-4 py-1.5 rounded-full text-xs font-extrabold bg-rose-500/20 text-rose-400';

  document.getElementById('resTitle').textContent = passed
    ? `Congratulations, ${currentUser.name}!`
    : `Keep Practicing, ${currentUser.name}!`;
  document.getElementById('resScore').textContent = `${correct} / ${total}`;
  document.getElementById('resPercent').textContent = `${percent}%`;
  document.getElementById('resGrade').textContent = grade;

  document.getElementById('reviewList').innerHTML = examQuestions.map((q, idx) => {
    const uAns = userAnswers[idx];
    const isRight = uAns === q.ans;
    return `
      <div class="p-4 rounded-xl bg-slate-800/70 border ${isRight ? 'border-emerald-600/40' : 'border-rose-600/40'} text-xs space-y-1.5">
        <div class="font-bold text-sm text-white">Q${idx + 1}. ${q.q_hi}</div>
        <div class="text-slate-400">${q.q_en}</div>
        <div class="pt-1">
          <span class="${isRight ? 'text-emerald-400' : 'text-rose-400'} font-bold">
            Your Answer: ${uAns !== undefined ? q.opts[uAns] : 'Not Answered'}
          </span> |
          <span class="text-emerald-400 font-bold">Correct: ${q.opts[q.ans]}</span>
        </div>
        <div class="text-amber-300/90 pt-1">💡 ${q.exp_hi}</div>
      </div>
    `;
  }).join('');
}
