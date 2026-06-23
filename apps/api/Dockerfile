FROM node:22-bookworm-slim AS build

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --filter @hyperframes-studio/api --frozen-lockfile=false

COPY apps/api apps/api
RUN pnpm --filter @hyperframes-studio/api build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PRODUCER_HEADLESS_SHELL_PATH=/usr/bin/chromium
RUN corepack enable

# Render dependencies: ffmpeg, CJK fonts, Chromium, and Chrome shared libs.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg chromium fonts-noto-cjk fonts-liberation ca-certificates wget \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libpango-1.0-0 libcairo2 libasound2 libatspi2.0-0 libgtk-3-0 \
  && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --filter @hyperframes-studio/api --prod --frozen-lockfile=false

COPY --from=build /app/apps/api/dist apps/api/dist

EXPOSE 8787
CMD ["node", "apps/api/dist/server.js"]
