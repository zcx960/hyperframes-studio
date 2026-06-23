<div align="center">
  <h1>HyperFrames Studio</h1>

  <p>Turn scripts, documents, or article links into HyperFrames videos with visuals, captions, and voiceover.</p>

  <p>
    <img src="https://img.shields.io/badge/Platform-Self--hosted-2f6fed?style=flat-square" alt="Self-hosted" />
    <img src="https://img.shields.io/badge/React-19-2d9cdb?style=flat-square" alt="React 19" />
    <img src="https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square" alt="TypeScript 5" />
    <img src="https://img.shields.io/badge/API-OpenAI--compatible%20%7C%20Anthropic--compatible-3a7f52?style=flat-square" alt="API support" />
    <img src="https://img.shields.io/badge/Render-HyperFrames-c9a227?style=flat-square" alt="HyperFrames" />
  </p>

  <p><strong>English</strong> | <a href="./README.md">中文</a></p>
</div>

HyperFrames Studio is a self-hosted video-generation workbench. Paste a script, long document, or article link into the user workbench, and the backend uses your configured text model to plan a storyboard, create scene backgrounds, generate voiceover audio, compose HyperFrames HTML, and render a local MP4.

It no longer depends on Claude CLI, Codex CLI, or an external coding agent at runtime. The generation workflow lives inside the project backend and talks only to the model, image, and TTS providers configured by the user.

It is designed for turning knowledge scripts, product explainers, article drafts, course material, or short-video copy into inspectable HyperFrames video projects.

## Overview

- User workbench: submit scripts, document text, or article links, then inspect job progress and artifacts
- Admin console: configure text models, image generation, TTS, render settings, and access passwords
- Built-in agent workflow: the backend plans storyboards directly without external CLI tools
- Flexible image sources: OpenAI-compatible image APIs, Pexels, or template-only backgrounds
- Voiceover audio: MiMo TTS and OpenAI-compatible `/audio/speech` style APIs
- Local rendering: MP4 output through `@hyperframes/core` and `@hyperframes/producer`
- Chinese typography tuning: scene density drives font size, line height, caption area, and timing
- Artifact archive: inspect video, HTML, storyboard, source, and generated assets

## Features

### Video Generation

- Generate a structured storyboard from plain text
- Keep each scene on screen long enough for the voiceover to finish
- Add no-text constraints to image prompts to reduce accidental text in backgrounds
- Support concurrent image generation with timeout and rate-limit retries
- Generate voiceover audio and use audio duration to drive scene timing
- Lint HyperFrames HTML before rendering to catch timeline overlaps and asset issues early

### Models and Assets

- Text models: OpenAI-compatible, Anthropic-compatible, and custom providers
- Image generation: OpenAI-compatible `/images/generations`
- Image assets: Pexels, generated images, or no external image source
- TTS: MiMo chat-completions audio mode
- TTS: OpenAI-compatible `/audio/speech`
- API keys stay in backend settings and are never sent to the user workbench

### Admin Console

- Configure model base URL, API key, model name, and temperature
- Configure image model, image size, concurrency, and source
- Configure TTS model, voice, format, speed, and concurrency
- Configure render workers, timeout, and access passwords
- Keep normal users away from provider credentials

## Entry Points

Default local development URLs:

- Workbench: http://localhost:5188
- Admin console: http://localhost:5188/admin
- API health check: http://localhost:8787/health

Default Docker Compose URLs:

- Workbench: http://localhost:8980
- Admin console: http://localhost:8980/admin
- API health check: http://localhost:8787/health

## Tech Stack

- Web: React 19, Vite, TypeScript
- API: Hono, Node.js, TypeScript
- Validation: Zod
- Rendering: HyperFrames Producer, Chromium, FFmpeg
- Testing: Vitest
- Tooling: pnpm workspace, Biome, Docker Compose

## Installation and Local Development

### Prerequisites

- Node.js 20+
- pnpm 10+
- A working Chromium / Chrome environment
- FFmpeg for MP4 rendering

### Install Dependencies

```bash
pnpm install
```

If Puppeteer or HyperFrames Producer cannot find Chrome, install the browser:

```bash
npx puppeteer browsers install chrome
```

### Development

```bash
pnpm dev
```

### Test and Build

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Docker Compose

Copy the example environment file:

```bash
cp .env.example .env
```

Start the services:

```bash
docker compose up --build
```

Docker creates a `studio-data` volume for admin settings, job records, and generated artifacts. Change all access passwords and signing secrets in `.env` before exposing the service.

## Configuration

### Environment Variables

`.env.example` provides the minimal set:

- `PORT`: API port, default `8787`
- `SETTINGS_PATH`: settings file path, `/data/settings.json` in Docker
- `USER_PASSWORD`: workbench access password
- `ADMIN_PASSWORD`: admin console access password
- `AUTH_SECRET`: token signing secret, required to change in production
- `HF_RENDER_WORKERS`: render worker count

### Text Models

- `Provider`: `openai-compatible`, `anthropic-compatible`, or `custom`
- `Base URL`: model service URL
- `API Key`: model service key
- `Model`: model name
- `Temperature`: generation temperature

OpenAI-compatible providers usually use `/chat/completions`. Anthropic-compatible providers use a messages endpoint. Custom providers need to match the backend request contract.

### Image Generation

- `none`: do not call an image service; use template backgrounds only
- `openai`: call `${imageBaseUrl}/images/generations`
- `pexels`: download scene backgrounds from Pexels

To prevent background images from competing with UI text, the project asks image providers to avoid text, logos, watermarks, subtitles, and UI lettering. Final titles, emphasis text, and captions are rendered by HyperFrames HTML.

### Voiceover Audio

- `mimo`: calls `${baseUrl}/chat/completions` with an `audio` payload
- `openai` / `custom` / `minimax`: calls `${baseUrl}/audio/speech`

You can configure `model`, `voice`, `format`, and `speed`. When audio generation succeeds, scene durations follow voiceover duration to reduce audio-video drift.

## Pipeline

1. Read source content and save `source.md`
2. Generate `storyboard.json` through the configured text model
3. Generate or download scene background images
4. Generate voiceover audio and read audio durations
5. Compute scene timing from text density and audio duration
6. Compose HyperFrames `index.html`
7. Lint timeline and asset references
8. Render `renders/output.mp4` with HyperFrames Producer
9. Return video, HTML, storyboard, source, and asset artifacts to the workbench

## Project Structure

```text
.
├── apps
│   ├── api        # Hono API, queue, model calls, asset generation, render pipeline
│   └── web        # React workbench and admin console
├── data           # Local runtime data, ignored by default
├── docker-compose.yml
├── pnpm-workspace.yaml
└── README.md
```

## Privacy and Security

- Do not commit `.env`, `data/`, generated projects, job records, or render outputs
- Change `USER_PASSWORD`, `ADMIN_PASSWORD`, and `AUTH_SECRET` in production
- Model API keys are stored server-side and are not sent to the frontend
- Artifact downloads reject dotfile paths to avoid exposing `.env` and similar secrets
- Rendering launches Chromium and FFmpeg, so run the API in a low-privilege container
- For public deployments, add reverse-proxy auth, HTTPS, rate limits, and logging

## Known Limitations

- The current job queue is an in-process single-instance queue
- Multi-replica deployments need an external queue and shared artifact storage
- Output quality depends on the configured text, image, and TTS providers
- Some OpenAI-compatible services do not fully support image or audio endpoints
- Long video renders can use significant CPU, memory, and disk space

## Contributing

Issues and pull requests are welcome. Before submitting changes, run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## License

No open-source license has been added yet. Add a `LICENSE` file before public reuse, redistribution, or accepting external contributions.
