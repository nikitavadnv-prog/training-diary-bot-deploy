import { Telegraf } from 'telegraf';
import { Low, JSONFile } from 'lowdb';
import dotenv from 'dotenv';

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// ---------- DB ----------
const adapter = new JSONFile('data/db.json');
const db = new Low(adapter);
await db.read();
db.data ||= { users: {} };

function getUser(ctx) {
  const id = ctx.from.id.toString();
  if (!db.data.users[id]) db.data.users[id] = { name: null, logs: [] };
  return db.data.users[id];
}

bot.start(async (ctx) => {
  const user = getUser(ctx);
  await ctx.reply('Привет! Пришли своё имя.');
  ctx.session = { step: 'await_name' };
});

bot.on('text', async (ctx) => {
  const user = getUser(ctx);
  const session = ctx.session || {};

  if (session.step === 'await_name') {
    user.name = ctx.message.text.trim();
    await ctx.reply(`Отлично, ${user.name}! Теперь пришли название упражнения.`);
    ctx.session = { step: 'await_exercise' };
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
    const entry = {exercise: ctx.session.exercise, reps: ctx.session.reps, sets, date: new Date().toISOString()};
    user.logs.push(entry);
    await db.write();
    await ctx.reply('✅ Запись добавлена в дневник!');
    ctx.session = {};
    return;
  }

  await ctx.reply('Не понял. Напиши /start, чтобы начать заново.');
});

bot.command('diary', async (ctx) => {
  const user = getUser(ctx);
  if (!user.logs.length) {
    await ctx.reply('Дневник пуст.');
    return;
  }
  const lines = user.logs.slice(-10).reverse().map(l => `${l.date.split('T')[0]} – ${l.exercise}: ${l.reps}×${l.sets}`).join('\n');
  await ctx.reply(`📔 Твой дневник:\n${lines}`);
});

bot.launch();
console.log('Bot is running...');
