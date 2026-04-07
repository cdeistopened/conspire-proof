FROM node:22-slim

# Install build deps for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build the web frontend
RUN npm run build

# Create data directory for SQLite
RUN mkdir -p /app/data

ENV PORT=4000
ENV DATABASE_PATH=/app/data/proof-share.db
ENV PROOF_CORS_ALLOW_ORIGINS=*

EXPOSE 4000

CMD ["npx", "tsx", "server/index.ts"]
