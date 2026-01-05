import './style.css';

const API_BASE = '/api'; // Relative path since served by same express app

const tg = window.Telegram.WebApp;
tg.expand();

// Theme params
document.body.style.backgroundColor = tg.themeParams.bg_color || '#0f172a';
document.body.style.color = tg.themeParams.text_color || '#f8fafc';

// Mock user if not in Telegram (for dev)
const user = tg.initDataUnsafe?.user || { id: '12345', first_name: 'Dev User' };

// --- Router ---
const app = document.getElementById('app');

function navigate(view, params = {}) {
  app.innerHTML = ''; // Clear
  window.scrollTo(0, 0);

  if (view === 'home') renderHome();
  else if (view === 'archive') renderArchive();
  else if (view === 'create') renderCreate();

  if (view === 'home') {
    tg.BackButton.hide();
  } else {
    tg.BackButton.show();
    tg.BackButton.onClick(() => navigate('home'));
  }
}

// --- Views ---

async function renderHome() {
  const container = document.createElement('div');
  container.className = 'screen';

  // Fetch stats
  let stats = { count: 0 };
  try {
    const res = await fetch(`${API_BASE}/user/${user.id}`);
    if (res.ok) stats = await res.json();
  } catch (e) {
    console.error(e);
  }

  container.innerHTML = `
    <div class="home-header">
      <img src="/home_bg.png" class="home-image" alt="Training Diary" onerror="this.src='https://via.placeholder.com/600x300?text=Gym+Image'">
      <h1>Привет, ${user.first_name}!</h1>
      <p style="color: var(--text-secondary)">Твой прогресс</p>
    </div>

    <div class="stats-grid">
      <div class="stat-item">
        <span class="stat-val">${stats.count || 0}</span>
        <span class="stat-label">Тренировок</span>
      </div>
      <div class="stat-item">
        <span class="stat-val">${new Date().getFullYear()}</span>
        <span class="stat-label">Сезон</span>
      </div>
    </div>

    <button id="btn-archive" class="btn btn-primary" style="margin-bottom: 12px">
      📂 Архив тренировок
    </button>
    
    <button id="btn-profile" class="btn btn-secondary">
      👤 Профиль
    </button>
  `;

  app.appendChild(container);

  document.getElementById('btn-archive').onclick = () => navigate('archive');
  document.getElementById('btn-profile').onclick = () => tg.showAlert('Функция профиля скоро будет доступна!');
}

async function renderArchive() {
  const container = document.createElement('div');
  container.className = 'screen';

  container.innerHTML = `
    <div class="top-nav">
      <h2>Архив</h2>
    </div>
    <div id="loading" style="text-align:center; padding: 20px;">Загрузка...</div>
    <div id="archive-list" class="archive-list"></div>
    <div class="floating-action" id="fab-add">+</div>
  `;

  app.appendChild(container);

  document.getElementById('fab-add').onclick = () => navigate('create');

  try {
    const res = await fetch(`${API_BASE}/archive/${user.id}`);
    if (!res.ok) throw new Error('Failed to load');
    const data = await res.json();

    const list = document.getElementById('archive-list');
    document.getElementById('loading').remove();

    if (data.length === 0) {
      list.innerHTML = '<p style="text-align:center; color: var(--text-secondary)">Пока нет записей. Создай первую!</p>';
    } else {
      data.forEach(entry => {
        // Entry format: { date, exercise, reps, sets }
        const el = document.createElement('div');
        el.className = 'card entry-card';
        el.innerHTML = `
          <div class="entry-date">${new Date(entry.date).toLocaleDateString()}</div>
          <div class="entry-title">${entry.exercise}</div>
          <div class="entry-details">${entry.reps} повт. × ${entry.sets} подх.</div>
        `;
        list.appendChild(el);
      });
    }
  } catch (e) {
    document.getElementById('loading').innerText = 'Ошибка загрузки.';
  }
}

function renderCreate() {
  const container = document.createElement('div');
  container.className = 'screen';

  container.innerHTML = `
    <div class="top-nav">
      <h2>Новая тренировка</h2>
    </div>
    
    <div class="card">
      <div class="input-group">
        <label>Упражнение</label>
        <input type="text" id="inp-ex" placeholder="Например: Жим лежа" autofocus>
      </div>
      
      <div class="input-group">
        <label>Повторения</label>
        <input type="number" id="inp-reps" placeholder="10">
      </div>

      <div class="input-group">
        <label>Подходы</label>
        <input type="number" id="inp-sets" placeholder="3">
      </div>
    </div>

    <button id="btn-save" class="btn btn-primary">Сохранить</button>
  `;

  app.appendChild(container);

  const btnSave = document.getElementById('btn-save');
  btnSave.onclick = async () => {
    const exercise = document.getElementById('inp-ex').value;
    const reps = document.getElementById('inp-reps').value;
    const sets = document.getElementById('inp-sets').value;

    if (!exercise || !reps || !sets) {
      tg.showAlert('Заполните все поля!');
      return;
    }

    btnSave.innerText = 'Сохранение...';
    btnSave.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, exercise, reps, sets })
      });

      if (res.ok) {
        tg.HapticFeedback.notificationOccurred('success');
        navigate('archive');
      } else {
        tg.showAlert('Ошибка сохранения');
        btnSave.disabled = false;
        btnSave.innerText = 'Сохранить';
      }
    } catch (e) {
      tg.showAlert('Ошибка сети');
      btnSave.disabled = false;
      btnSave.innerText = 'Сохранить';
    }
  };
}

// Start
navigate('home');
