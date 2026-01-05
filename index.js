import { Telegraf, session, Markup } from 'telegraf';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import dotenv from 'dotenv';
import { existsSync, mkdirSync, appendFileSync, readFileSync, writeFileSync } from 'fs';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { join } from 'path';
dotenv.config();
// Owner (admin) Telegram user ID – set in .env as BOT_OWNER_ID
const OWNER_ID = Number(process.env.BOT_OWNER_ID) || 0;
function isAdmin(ctx) { return ctx.from && ctx.from.id === OWNER_ID; }

// Helper function to get archive file content for a user or all users
function getArchiveFile(userId = null) {
  if (userId) {
    const userFile = `data/${userId}.txt`;
    if (existsSync(userFile)) {
      return { path: userFile, caption: '📁 Твой архив дневника' };
    }
    return null;
  } else { // Admin request for all clients
    const files = Object.keys(db.data.users || {});
    if (files.length === 0) {
      return null;
    }
    const combinedPath = `data/_all_clients_archive.txt`;
    const parts = files.map(id => {
      const path = `data/${id}.txt`;
      if (existsSync(path)) {
        const header = `=== Пользователь ${id} ===\n`;
        const content = readFileSync(path, 'utf-8');
        return header + content + '\n';
      }
      return '';
    }).join('\n');
    writeFileSync(combinedPath, parts);
    return { path: combinedPath, caption: '📁 Архив всех клиентов' };
  }
}

// --- NAVIGATION & SCREENS ---
const IMG_HOME = '/Users/nikita/.gemini/antigravity/brain/706e83db-359e-4487-89e5-6254bbb902fd/gym_splash_dark_1767630361537.png';
const IMG_ARCHIVE = '/Users/nikita/.gemini/antigravity/brain/706e83db-359e-4487-89e5-6254bbb902fd/training_archive_mockup_1767630030365.png';

function getRecentEntries(userId) {
  const userFile = `data/${userId}.txt`;
  if (!existsSync(userFile)) return [];
  const content = readFileSync(userFile, 'utf-8');
  return content.split('\n').filter(l => l.includes('|')).reverse().slice(0, 10);
}

async function showHomeScreen(ctx, isEdit = false) {
  const caption = '🏋️‍♂️ *Добро пожаловать в Training Diary*\n\nГлавное меню:';
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('👤 Профиль', 'profile_screen')],
    [Markup.button.callback('📂 Архив тренировок', 'archive_screen')]
  ]);

  if (isEdit) {
    try {
      await ctx.editMessageMedia({ type: 'photo', media: { source: IMG_HOME }, caption, parse_mode: 'Markdown' }, keyboard);
    } catch (e) {
      await ctx.editMessageCaption(caption, { parse_mode: 'Markdown', ...keyboard });
    }
  } else {
    await ctx.replyWithPhoto({ source: IMG_HOME }, { caption, parse_mode: 'Markdown', ...keyboard });
  }
}

async function showArchiveScreen(ctx, isEdit = false) {
  const entries = getRecentEntries(ctx.from.id);
  let text = '📂 *Архив тренировок*\n\n';
  if (entries.length === 0) text += '_Пока нет записей._';
  else {
    entries.forEach(l => {
      const parts = l.split('|');
      if (parts.length >= 2) {
        const date = parts[0].trim();
        const exercise = parts[1].trim();
        text += `📅 ${date} — ${exercise}\n`;
      }
    });
  }

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('➕ Создать тренировку', 'add_entry')],
    [Markup.button.callback('📥 Скачать полный архив', 'export_file')],
    [Markup.button.callback('🔙 Назад', 'back_home')]
  ]);

  if (isEdit) {
    await ctx.editMessageMedia({ type: 'photo', media: { source: IMG_ARCHIVE }, caption: text, parse_mode: 'Markdown' }, keyboard);
  } else {
    await ctx.replyWithPhoto({ source: IMG_ARCHIVE }, { caption: text, parse_mode: 'Markdown', ...keyboard });
  }
}

async function showProfileScreen(ctx, isEdit = false) {
  const user = getUser(ctx);
  const userFile = `data/${ctx.from.id}.txt`;
  let count = 0;
  if (existsSync(userFile)) {
    count = readFileSync(userFile, 'utf-8').split('\n').filter(l => l.includes('|')).length;
  }

  const text = `👤 *Профиль*\n\nИмя: ${user.name || 'Не указано'}\nВсего тренировок: ${count}`;
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('📊 Подробная статистика', 'stats')],
    [Markup.button.callback('🔙 Назад', 'back_home')]
  ]);

  if (isEdit) {
    await ctx.editMessageMedia({ type: 'photo', media: { source: IMG_HOME }, caption: text, parse_mode: 'Markdown' }, keyboard);
  } else {
    await ctx.replyWithPhoto({ source: IMG_HOME }, { caption: text, parse_mode: 'Markdown', ...keyboard });
  }
}

// Ensure data directory exists for lowdb
if (!existsSync('data')) {
  mkdirSync('data', { recursive: true });
}

const bot = new Telegraf(process.env.BOT_TOKEN);
// Enable session middleware for step tracking
bot.use(session());

// ---------- DB ----------
const adapter = new JSONFile('data/db.json');
const db = new Low(adapter, { users: {} });
await db.read();

function getUser(ctx) {
  const id = ctx.from.id.toString();
  if (!db.data.users[id]) db.data.users[id] = { name: null };
  return db.data.users[id];
}

bot.start(async (ctx) => {
  const user = getUser(ctx);
  const webAppUrl = process.env.WEBAPP_URL || 'https://google.com';

  await ctx.reply('🏋️‍♂️ Добро пожаловать! Нажми кнопку ниже, чтобы открыть Дневник.',
    Markup.keyboard([
      [Markup.button.webApp('📱 Открыть Дневник', webAppUrl)]
    ]).resize()
  );

  await showHomeScreen(ctx);
});

// showSplash & showMainMenu replaced by navigation system


bot.on('text', async (ctx) => {
  const user = getUser(ctx);
  const session = ctx.session || {};

  if (session.step === 'await_name') {
    user.name = ctx.message.text.trim();
    await ctx.reply(`Отлично, ${user.name}!`);
    // Ensure per‑user file exists
    const userFile = `data/${ctx.from.id}.txt`;
    if (!existsSync(userFile)) {
      appendFileSync(userFile, `Тренировочный дневник пользователя ${user.name}\n\n`);
    }
    // Show home screen
    await showHomeScreen(ctx);
    ctx.session = {};
    return;
  }

  if (session.step === 'await_exercise') {
    ctx.session.exercise = ctx.message.text.trim();
    await ctx.reply('Сколько повторений?');
    session.step = 'await_reps';
    return;
  }

  if (session.step === 'await_reps') {
    const reps = Number(ctx.message.text.trim());
    if (isNaN(reps)) {
      await ctx.reply('Введите число повторений.');
      return;
    }
    ctx.session.reps = reps;
    await ctx.reply('Сколько подходов?');
    session.step = 'await_sets';
    return;
  }

  if (session.step === 'await_sets') {
    const sets = Number(ctx.message.text.trim());
    if (isNaN(sets)) {
      await ctx.reply('Введите число подходов.');
      return;
    }
    const entry = { exercise: ctx.session.exercise, reps: ctx.session.reps, sets, date: new Date().toISOString() };
    // Append entry to the user's text file
    const line = `${entry.date.split('T')[0]} | ${entry.exercise} | ${entry.reps}×${entry.sets}\n`;
    const userFile = `data/${ctx.from.id}.txt`;
    appendFileSync(userFile, line);
    await ctx.reply('✅ Запись добавлена в дневник!');
    // Return to Archive Screen (as new message since keyboard was scrolled)
    await showArchiveScreen(ctx, false);
    ctx.session = {};
    return;
  }

  if (session.step === 'await_edit_number') {
    const num = Number(ctx.message.text.trim());
    const userFile = `data/${ctx.from.id}.txt`;
    const content = readFileSync(userFile, 'utf-8');
    const lines = content.split('\n');
    const entryLines = lines.filter(l => l.includes('|'));
    if (isNaN(num) || num < 1 || num > entryLines.length) {
      await ctx.reply('Неверный номер. Попробуйте снова.');
      return;
    }
    ctx.session = { step: 'await_new_entry', editIndex: num - 1 };
    await ctx.reply('Отправьте новую строку записи в том же формате: `дата | упражнение | повторения×подходы`');
    return;
  }
  if (session.step === 'await_new_entry') {
    const newLine = ctx.message.text.trim();
    const userFile = `data/${ctx.from.id}.txt`;
    const content = readFileSync(userFile, 'utf-8');
    const lines = content.split('\n');
    // Find the actual index of the entry line in the file (skip possible empty lines)
    let entryIdx = -1;
    let count = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('|')) {
        if (count === session.editIndex) { entryIdx = i; break; }
        count++;
      }
    }
    if (entryIdx !== -1) {
      lines[entryIdx] = newLine;
      writeFileSync(userFile, lines.join('\n'));
      await ctx.reply('✅ Запись отредактирована.');
    } else {
      await ctx.reply('Ошибка при редактировании.');
    }
    ctx.session = {};
    return;
  }
  if (session.step === 'await_delete_number') {
    const num = Number(ctx.message.text.trim());
    const userFile = `data/${ctx.from.id}.txt`;
    const content = readFileSync(userFile, 'utf-8');
    const lines = content.split('\n');
    const entryLines = lines.filter(l => l.includes('|'));
    if (isNaN(num) || num < 1 || num > entryLines.length) {
      await ctx.reply('Неверный номер. Попробуйте снова.');
      return;
    }
    // Remove the selected entry line
    let removed = 0;
    const newLines = lines.filter(l => {
      if (l.includes('|') && removed < num) {
        removed++;
        return !(removed === num);
      }
      return true;
    });
    writeFileSync(userFile, newLines.join('\n'));
    await ctx.reply('✅ Запись удалена.');
    ctx.session = {};
    return;
  }

  await ctx.reply('Не понял. Напиши /start, чтобы начать заново.');
});

// /diary command kept for backward compatibility
bot.command('diary', async (ctx) => {
  const userFile = `data/${ctx.from.id}.txt`;
  if (!existsSync(userFile)) {
    await ctx.reply('Дневник пуст.');
    return;
  }
  const content = readFileSync(userFile, 'utf-8').trim();
  const lines = content.split('\n').filter(l => l.includes('|')).reverse();
  if (lines.length === 0) {
    await ctx.reply('Дневник пуст.');
    return;
  }
  const formatted = lines.map(l => {
    const [date, exercise, repsSets] = l.split('|').map(s => s.trim());
    return `${date} – ${exercise}: ${repsSets}`;
  }).join('\n');
  await ctx.reply(`📔 Твой дневник:\n${formatted}`);
});

// ---------- Additional Commands ----------

// /help – list available commands
bot.command('help', async (ctx) => {
  const baseHelp = `📖 Доступные команды:\n` +
    `/start – начать диалог и задать имя\n` +
    `/menu – открыть главное меню\n` +
    `/diary – посмотреть дневник\n` +
    `/stats – статистика тренировок\n` +
    `/export – экспорт дневника\n` +
    `/archive – иллюстрация архива\n` +
    `/help – эта справка`;
  // Add admin‑only commands
  if (isAdmin(ctx)) {
    const adminHelp = `\n🛠️ Команды для админа:\n` +
      `/clients – список всех клиентов\n` +
      `/admin_archive – полный архив всех записей`;
    await ctx.reply(baseHelp + adminHelp);
    return;
  }
  await ctx.reply(baseHelp);
});

// /menu – show home screen
bot.command('menu', async (ctx) => {
  await showHomeScreen(ctx);
});

// --- Actions ---

bot.action('add_entry', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('Введите название упражнения:');
  ctx.session = { step: 'await_exercise' };
});

bot.action('back_home', async (ctx) => {
  await ctx.answerCbQuery();
  await showHomeScreen(ctx, true);
});

bot.action('profile_screen', async (ctx) => {
  await ctx.answerCbQuery();
  await showProfileScreen(ctx, true);
});

bot.action('archive_screen', async (ctx) => {
  await ctx.answerCbQuery();
  await showArchiveScreen(ctx, true);
});

bot.action('export_file', async (ctx) => {
  await ctx.answerCbQuery();
  const archive = getArchiveFile(ctx.from.id);
  if (!archive) {
    await ctx.reply('Дневник пуст.');
    return;
  }
  await ctx.replyWithDocument({ source: archive.path }, { caption: archive.caption });
});

// Legacy action handlers redirection
bot.action('profile', async (ctx) => { // Backcompat
  await ctx.answerCbQuery();
  await showProfileScreen(ctx, true);
});

bot.action('archive_splash', async (ctx) => { // Backcompat
  await ctx.answerCbQuery();
  await showArchiveScreen(ctx, true);
});

bot.action('view_diary', async (ctx) => {
  await ctx.answerCbQuery();
  // reuse diary logic
  const userFile = `data/${ctx.from.id}.txt`;
  if (!existsSync(userFile)) {
    await ctx.reply('Дневник пуст.');
    return;
  }
  const content = readFileSync(userFile, 'utf-8').trim();
  const lines = content.split('\\n').filter(l => l.includes('|')).reverse();
  if (lines.length === 0) {
    await ctx.reply('Дневник пуст.');
    return;
  }
  const formatted = lines.map(l => {
    const [date, exercise, repsSets] = l.split('|').map(s => s.trim());
    return `${date} – ${exercise}: ${repsSets}`;
  }).join('\\n');
  await ctx.reply(`📔 Твой дневник:\\n${formatted}`);
});

bot.action('stats', async (ctx) => {
  await ctx.answerCbQuery();
  const userFile = `data/${ctx.from.id}.txt`;
  if (!existsSync(userFile)) {
    await ctx.reply('Дневник пуст.');
    return;
  }
  const content = readFileSync(userFile, 'utf-8');
  const entryCount = content.split('\\n').filter(l => l.includes('|')).length;
  await ctx.reply(`📊 У вас ${entryCount} записей в дневнике.`);
});

// Edit entry flow
// Admin command: list all client IDs and names
bot.command('clients', async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.reply('Недоступно.');
    return;
  }
  const users = db.data.users || {};
  const list = Object.entries(users).map(([id, data]) => `ID: ${id} – ${data.name || 'без имени'}`).join('\n');
  await ctx.reply(list || 'Нет клиентов.');
});

// Admin command: download combined archive (same as admin part of archive_splash)
bot.command('admin_archive', async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.reply('Недоступно.');
    return;
  }
  const files = Object.keys(db.data.users || {});
  if (files.length === 0) {
    await ctx.reply('Нет записей у клиентов.');
    return;
  }
  const combinedPath = `data/_all_clients_archive.txt`;
  const parts = files.map(id => {
    const path = `data/${id}.txt`;
    if (existsSync(path)) {
      const header = `=== Пользователь ${id} ===\n`;
      const content = readFileSync(path, 'utf-8');
      return header + content + '\n';
    }
    return '';
  }).join('\n');
  writeFileSync(combinedPath, parts);
  await ctx.replyWithDocument({ source: combinedPath }, { caption: '📁 Архив всех клиентов' });
});

bot.command('delete', async (ctx) => {
  const userFile = `data/${ctx.from.id}.txt`;
  if (!existsSync(userFile)) {
    await ctx.reply('Дневник пуст.');
    return;
  }
  const content = readFileSync(userFile, 'utf-8');
  const lines = content.split('\\n').filter(l => l.includes('|'));
  if (lines.length === 0) {
    await ctx.reply('Дневник пуст.');
    return;
  }
  const enumerated = lines.map((l, i) => `${i + 1}. ${l}`).join('\n');
  await ctx.reply(`Выберите номер записи для удаления:\n${enumerated}`);
  ctx.session = { step: 'await_delete_number' };
});

bot.action('edit_entry', async (ctx) => {
  await ctx.answerCbQuery();
  const userFile = `data/${ctx.from.id}.txt`;
  if (!existsSync(userFile)) {
    await ctx.reply('Дневник пуст.');
    return;
  }
  const content = readFileSync(userFile, 'utf-8');
  const lines = content.split('\\n').filter(l => l.includes('|'));
  if (lines.length === 0) {
    await ctx.reply('Дневник пуст.');
    return;
  }
  const enumerated = lines.map((l, i) => `${i + 1}. ${l}`).join('\n');
  await ctx.reply(`Выберите номер записи для редактирования:\n${enumerated}`);
  ctx.session = { step: 'await_edit_number' };
});

bot.action('delete_entry', async (ctx) => {
  await ctx.answerCbQuery();
  const userFile = `data/${ctx.from.id}.txt`;
  if (!existsSync(userFile)) {
    await ctx.reply('Дневник пуст.');
    return;
  }
  const content = readFileSync(userFile, 'utf-8');
  const lines = content.split('\\n').filter(l => l.includes('|'));
  if (lines.length === 0) {
    await ctx.reply('Дневник пуст.');
    return;
  }
  const enumerated = lines.map((l, i) => `${i + 1}. ${l}`).join('\n');
  await ctx.reply(`Выберите номер записи для удаления:\n${enumerated}`);
  ctx.session = { step: 'await_delete_number' };
});

bot.action('export', async (ctx) => {
  await ctx.answerCbQuery();
  const userFile = `data/${ctx.from.id}.txt`;
  if (!existsSync(userFile)) {
    await ctx.reply('Дневник пуст.');
    return;
  }
  await ctx.replyWithDocument({ source: userFile });
});

bot.action('archive', async (ctx) => {
  await ctx.answerCbQuery();
  const imagePath = '/Users/nikita/.gemini/antigravity/brain/706e83db-359e-4487-89e5-6254bbb902fd/training_archive_mockup_1767630030365.png';
  await ctx.replyWithPhoto({ source: imagePath }, { caption: '🏋️‍♂️ Ваш архив тренировок' });
});

// /stats – количество записей в дневнике (kept for /stats command)
bot.command('stats', async (ctx) => {
  // Admin can see total number of records across all users
  if (isAdmin(ctx)) {
    const allFiles = Object.keys(db.data.users || {});
    let total = 0;
    allFiles.forEach(id => {
      const path = `data/${id}.txt`;
      if (existsSync(path)) {
        const content = readFileSync(path, 'utf-8');
        total += content.split('\\\\n').filter(l => l.includes('|')).length;
      }
    });
    await ctx.reply(`📊 Всего записей у всех клиентов: ${total}`);
    return;
  }
  const userFile = `data/${ctx.from.id}.txt`;
  if (!existsSync(userFile)) {
    await ctx.reply('Дневник пуст.');
    return;
  }
  const content = readFileSync(userFile, 'utf-8');
  const entryCount = content.split('\\n').filter(l => l.includes('|')).length;
  await ctx.reply(`📊 У вас ${entryCount} записей в дневнике.`);
});

// /export – отправить файл дневника как документ (kept for /export command)
bot.command('export', async (ctx) => {
  const userFile = `data/${ctx.from.id}.txt`;
  if (!existsSync(userFile)) {
    await ctx.reply('Дневник пуст.');
    return;
  }
  await ctx.replyWithDocument({ source: userFile });
});

// /archive – отправить красивую иллюстрацию архива тренировок (kept for /archive command)
bot.command('archive', async (ctx) => {
  const imagePath = '/Users/nikita/.gemini/antigravity/brain/706e83db-359e-4487-89e5-6254bbb902fd/training_archive_mockup_1767630030365.png';
  await ctx.replyWithPhoto({ source: imagePath }, { caption: '🏋️‍♂️ Ваш архив тренировок' });
});

bot.launch();
console.log('Bot is running...');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('webapp/dist'));

app.get('/api/user/:id', (req, res) => {
  const id = req.params.id;
  const userFile = `data/${id}.txt`;
  let count = 0;
  if (existsSync(userFile)) {
    count = readFileSync(userFile, 'utf-8').split('\n').filter(l => l.includes('|')).length;
  }
  res.json({ count });
});

app.get('/api/archive/:id', (req, res) => {
  const id = req.params.id;
  const userFile = `data/${id}.txt`;
  if (!existsSync(userFile)) return res.json([]);

  const content = readFileSync(userFile, 'utf-8');
  const lines = content.split('\n').filter(l => l.includes('|')).reverse();
  const data = lines.map(l => {
    const parts = l.split('|');
    if (parts.length < 2) return null;
    const [pDate, pEx, pReps] = parts;
    let reps = '?', sets = '?';
    if (pReps) {
      const rs = pReps.trim().split('×');
      if (rs.length === 2) { reps = rs[0]; sets = rs[1]; }
      else { reps = pReps.trim(); }
    }
    return { date: pDate.trim(), exercise: pEx.trim(), reps, sets };
  }).filter(Boolean);

  res.json(data);
});

app.post('/api/entry', (req, res) => {
  const { userId, exercise, reps, sets } = req.body;
  if (!userId || !exercise) return res.status(400).json({ error: 'Missing data' });
  const userFile = `data/${userId}.txt`;
  if (!existsSync(userFile)) appendFileSync(userFile, `Тренировочный дневник\n\n`);
  const date = new Date().toISOString();
  const line = `${date.split('T')[0]} | ${exercise} | ${reps}×${sets}\n`;
  appendFileSync(userFile, line);
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Web App Server running on port ${PORT}`);
});
