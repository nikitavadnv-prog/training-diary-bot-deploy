# Training Diary Bot

A Telegram bot that lets users log training sessions (exercise, reps, sets) and view a simple diary. Built with **Telegraf**, **lowdb**, and **dotenv**.

## Files
- `package.json` – project metadata and dependencies.
- `.env.example` – placeholder for the bot token.
- `index.js` – bot implementation.
- `README.md` – this file.

## Setup
1. Copy `.env.example` to `.env` and put your BotFather token:
   ```
   BOT_TOKEN=YOUR_TOKEN_HERE
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the bot:
   ```bash
   npm start
   ```

## Usage
- `/start` – start interaction, provide your name.
- Follow prompts to log an exercise.
- `/diary` – view the last 10 entries.

## Deploy
You can deploy to any Node.js host (e.g., BotHost.ru) by setting the `BOT_TOKEN` environment variable.
