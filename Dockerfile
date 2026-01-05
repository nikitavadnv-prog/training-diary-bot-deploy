# Use official Node.js LTS image
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Install app dependencies (only package.json and package-lock if present)
COPY package.json .
RUN npm install --production

# Copy source code
COPY . .

# Expose a dummy port (BotHost may require a web port, even if not used)
EXPOSE 3000

# Set environment variables (they will be overridden by BotHost UI)
ENV NODE_ENV=production

# Start the bot
CMD ["npm", "start"]
