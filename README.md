# HyperFrames Studio

HyperFrames Studio is a self-hosted workbench for turning scripts, documents, or article links into HyperFrames video projects. It uses user-configured model providers directly from the app: no Claude CLI, Codex CLI, or external coding agent is required at runtime.

## 中文说明

### 功能

- 前台 `/`：输入脚本、文档文本或公众号链接，创建异步视频制作任务。
- 后台 `/admin`：配置文本模型、TTS、图片来源、渲染参数和访问密码相关环境变量。
- 模型规划：调用 OpenAI-compatible 或 Anthropic-compatible 文本接口，生成结构化 storyboard。
- 场景素材：可使用 OpenAI-compatible 图片接口、Pexels，或纯排版背景。
- 旁白音频：支持 MiMo TTS，以及 OpenAI-compatible `/audio/speech` 风格接口。
- 本地渲染：后端直接使用 `@hyperframes/core` 和 `@hyperframes/producer` 合成并渲染 MP4。
- 长中文排版：生成模板会按场景文本密度自动调整字号、行高和字幕空间，避免文字裁切。

### 技术栈

- Web: React 19, Vite, TypeScript
- API: Hono, Node.js, TypeScript
- Validation: Zod
- Rendering: HyperFrames Producer, Chromium, FFmpeg
- Tooling: pnpm workspace, Biome, Vitest, Docker Compose

### 本地开发

```bash
pnpm install
pnpm dev
```

默认地址：

- 前台：http://localhost:5188
- 后台：http://localhost:5188/admin
- API：http://localhost:8787/health

### Docker Compose

```bash
cp .env.example .env
# Edit .env before exposing the service.
docker compose up --build
```

默认地址：

- 前台：http://localhost:8980
- 后台：http://localhost:8980/admin
- API：http://localhost:8787/health

Docker 会创建 `studio-data` volume，用于保存后台配置、任务记录和生成产物。

### 环境变量

`.env.example` 提供最小配置：

- `PORT`：API 端口，默认 `8787`
- `SETTINGS_PATH`：配置文件位置，Docker 中默认为 `/data/settings.json`
- `USER_PASSWORD`：前台访问密码
- `ADMIN_PASSWORD`：后台访问密码
- `AUTH_SECRET`：访问令牌签名密钥，生产环境必须修改
- `HF_RENDER_WORKERS`：渲染 worker 数
- `HF_IMAGE_CONCURRENCY`：场景图片并发数
- `HF_TTS_CONCURRENCY`：旁白音频并发数
- `HF_RENDER_TIMEOUT_MS`：单次渲染超时

### 后台模型配置

文本模型：

- `Provider`: `openai-compatible`、`anthropic-compatible` 或 `custom`
- `Base URL`
- `API Key`
- `Model`
- `Temperature`

TTS：

- `mimo`：调用 `${baseUrl}/chat/completions`，请求体包含 `audio`
- `openai` / `custom` / `minimax`：调用 `${baseUrl}/audio/speech`
- 可配置 `model`、`voice`、`format`、`speed`

图片：

- `none`：只用模板背景
- `openai`：调用 `${imageBaseUrl}/images/generations`
- `pexels`：下载 Pexels 背景图

### 制作流程

1. 读取来源内容并保存 `source.md`
2. 调用配置的文本模型生成 `storyboard.json`
3. 生成或下载场景背景图
4. 按配置生成旁白音频
5. 合成 HyperFrames `index.html`
6. 使用 HyperFrames Producer 渲染 `renders/output.mp4`
7. 在前台展示视频、HTML、storyboard、source 和素材产物

### 常用命令

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

### 安全说明

- 不要提交 `.env`、`data/`、生成项目、任务记录或渲染产物。
- 生产环境必须修改 `USER_PASSWORD`、`ADMIN_PASSWORD` 和 `AUTH_SECRET`。
- 后端不会把模型 API Key 下发给前台。
- 产物接口会拒绝 dotfile 路径，避免下载 `.env` 等敏感文件。
- 渲染会启动 Chromium 和 FFmpeg，建议在低权限容器内运行并对任务创建做限流。

### 当前边界

- 队列是单进程内存队列，适合单副本部署。
- 多副本部署需要接入外部队列和共享存储。
- 生成质量依赖你配置的文本、图片和 TTS 模型。

## English

### Features

- User workbench at `/` for creating video-generation jobs from scripts, document text, or article links.
- Admin console at `/admin` for model, TTS, image, and render settings.
- Storyboard planning through OpenAI-compatible or Anthropic-compatible text APIs.
- Scene backgrounds from OpenAI-compatible image APIs, Pexels, or pure template visuals.
- Voiceover generation through MiMo TTS or OpenAI-compatible `/audio/speech` APIs.
- Local MP4 rendering with `@hyperframes/core` and `@hyperframes/producer`.
- Adaptive Chinese typography for dense body text and captions, avoiding clipped text in generated videos.

### Stack

- Web: React 19, Vite, TypeScript
- API: Hono, Node.js, TypeScript
- Validation: Zod
- Rendering: HyperFrames Producer, Chromium, FFmpeg
- Tooling: pnpm workspace, Biome, Vitest, Docker Compose

### Local Development

```bash
pnpm install
pnpm dev
```

Default URLs:

- Workbench: http://localhost:5188
- Admin: http://localhost:5188/admin
- API health: http://localhost:8787/health

### Docker Compose

```bash
cp .env.example .env
# Edit .env before exposing the service.
docker compose up --build
```

Default URLs:

- Workbench: http://localhost:8980
- Admin: http://localhost:8980/admin
- API health: http://localhost:8787/health

Docker creates a `studio-data` volume for settings, job records, and generated artifacts.

### Environment Variables

See `.env.example`:

- `PORT`: API port, default `8787`
- `SETTINGS_PATH`: settings file path, `/data/settings.json` in Docker
- `USER_PASSWORD`: workbench access password
- `ADMIN_PASSWORD`: admin access password
- `AUTH_SECRET`: token-signing secret; change it in production
- `HF_RENDER_WORKERS`: render worker count
- `HF_IMAGE_CONCURRENCY`: concurrent scene image jobs
- `HF_TTS_CONCURRENCY`: concurrent TTS jobs
- `HF_RENDER_TIMEOUT_MS`: render timeout

### Admin Model Settings

Text model:

- `Provider`: `openai-compatible`, `anthropic-compatible`, or `custom`
- `Base URL`
- `API Key`
- `Model`
- `Temperature`

TTS:

- `mimo`: calls `${baseUrl}/chat/completions` with an `audio` payload
- `openai` / `custom` / `minimax`: calls `${baseUrl}/audio/speech`
- Configurable `model`, `voice`, `format`, and `speed`

Images:

- `none`: template-only visuals
- `openai`: calls `${imageBaseUrl}/images/generations`
- `pexels`: downloads Pexels backgrounds

### Pipeline

1. Read source content and save `source.md`
2. Generate `storyboard.json` with the configured text model
3. Generate or download scene background images
4. Generate voiceover audio when enabled
5. Compose HyperFrames `index.html`
6. Render `renders/output.mp4` with HyperFrames Producer
7. Return video, HTML, storyboard, source, and asset artifacts to the workbench

### Commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

### Security Notes

- Do not commit `.env`, `data/`, generated projects, job records, or render artifacts.
- Change `USER_PASSWORD`, `ADMIN_PASSWORD`, and `AUTH_SECRET` before production use.
- Model API keys are stored server-side and are not sent to the user workbench.
- Artifact downloads reject dotfiles to prevent exposing `.env` and similar secrets.
- Rendering starts Chromium and FFmpeg. Run the API in a low-privilege container and rate-limit job creation in production.

### Current Limits

- The job queue is an in-process single-instance queue.
- Multi-replica deployments need an external queue and shared artifact storage.
- Output quality depends on the configured text, image, and TTS providers.

## License

No license has been added yet. Add one before accepting external contributions.
