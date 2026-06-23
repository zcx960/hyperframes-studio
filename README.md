<div align="center">
  <h1>HyperFrames Studio</h1>

  <p>把脚本、文档或文章链接生成带画面、字幕和旁白的 HyperFrames 视频。</p>

  <p>
    <img src="https://img.shields.io/badge/Platform-Self--hosted-2f6fed?style=flat-square" alt="Self-hosted" />
    <img src="https://img.shields.io/badge/React-19-2d9cdb?style=flat-square" alt="React 19" />
    <img src="https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square" alt="TypeScript 5" />
    <img src="https://img.shields.io/badge/API-OpenAI--compatible%20%7C%20Anthropic--compatible-3a7f52?style=flat-square" alt="API support" />
    <img src="https://img.shields.io/badge/Render-HyperFrames-c9a227?style=flat-square" alt="HyperFrames" />
    <img src="https://img.shields.io/badge/License-0BSD-c9a227?style=flat-square" alt="0BSD License" />
  </p>

  <p><a href="./README.en.md">English</a> | <strong>中文</strong></p>
</div>

HyperFrames Studio 是一个自托管的视频生成工作台。你可以在前台输入脚本、长文档或文章链接，后台会调用你自己配置的文本模型生成分镜，再按场景生成背景图、旁白音频和 HyperFrames HTML，最后在本地渲染成 MP4。

它不再依赖 Claude CLI、Codex CLI 或外部代码代理运行。生成逻辑已经放进项目后端，运行时只通过后台配置的模型、图片和 TTS 服务完成制作。

项目适合用来快速把知识稿、产品说明、公众号文章、课程脚本或短视频文案做成可预览、可下载、可继续调试的 HyperFrames 视频项目。

## 项目概览

- 前台工作台：提交脚本、文档文本或文章链接，查看任务进度和生成产物
- 后台控制台：配置文本模型、图片生成、TTS、渲染参数和访问密码
- 内置 Agent 流程：后端直接规划 storyboard，不需要外部 CLI
- 多来源图片：支持 OpenAI-compatible 生图接口、Pexels，或只使用模板背景
- 旁白音频：支持 MiMo TTS，以及 OpenAI-compatible `/audio/speech` 风格接口
- 本地渲染：使用 `@hyperframes/core` 和 `@hyperframes/producer` 生成 MP4
- 中文排版优化：会根据场景文本密度调整字号、行高、字幕区域和停留时间
- 任务产物留档：可查看视频、HTML、storyboard、source 和素材文件

## 功能特性

### 视频生成

- 从纯文本脚本生成结构化分镜
- 自动控制每个场景的画面停留时间，避免旁白还没讲完就切换
- 为图片 prompt 自动加入无文字约束，减少背景图里出现乱码文字
- 支持并发生图、超时重试和限流重试
- 支持旁白音频生成和音频时长驱动的场景 timing
- 生成前会 lint HyperFrames HTML，提前拦截时间轴重叠等问题

### 模型与素材

- 文本模型支持 OpenAI-compatible、Anthropic-compatible 和 custom 配置
- 图片生成支持 OpenAI-compatible `/images/generations`
- 图片素材也可以使用 Pexels，或者完全关闭图片生成
- TTS 支持 MiMo 的 chat-completions audio 形式
- TTS 也支持 OpenAI-compatible `/audio/speech`
- API Key 保存在后端配置里，不会下发到前台

### 管理后台

- 配置模型 Base URL、API Key、模型名和 temperature
- 配置图片模型、图片尺寸、并发数和来源
- 配置 TTS 模型、voice、format、speed 和并发数
- 配置渲染 worker、超时时间和基础访问密码
- 前后台分离，普通用户不需要看到模型密钥

## 界面入口

本地开发默认地址：

- 前台工作台：http://localhost:5188
- 后台控制台：http://localhost:5188/admin
- API 健康检查：http://localhost:8787/health

Docker Compose 默认地址：

- 前台工作台：http://localhost:8980
- 后台控制台：http://localhost:8980/admin
- API 健康检查：http://localhost:8787/health

## 技术栈

- Web：React 19、Vite、TypeScript
- API：Hono、Node.js、TypeScript
- 校验：Zod
- 渲染：HyperFrames Producer、Chromium、FFmpeg
- 测试：Vitest
- 工具链：pnpm workspace、Biome、Docker Compose

## 安装与本地开发

### 前置要求

- Node.js 20+
- pnpm 10+
- 可用的 Chromium / Chrome 环境
- 如需渲染 MP4，需要 FFmpeg

### 安装依赖

```bash
pnpm install
```

如果 Puppeteer 或 HyperFrames Producer 报找不到 Chrome，可以安装浏览器：

```bash
npx puppeteer browsers install chrome
```

### 开发模式

```bash
pnpm dev
```

### 测试与构建

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Docker Compose

复制环境变量示例：

```bash
cp .env.example .env
```

启动服务：

```bash
docker compose up --build
```

Docker 会创建 `studio-data` volume，用于保存后台配置、任务记录和生成产物。部署到公网前务必修改 `.env` 里的访问密码和签名密钥。

## 配置说明

### 环境变量

`.env.example` 提供最小配置：

- `PORT`：API 端口，默认 `8787`
- `SETTINGS_PATH`：配置文件路径，Docker 中默认为 `/data/settings.json`
- `USER_PASSWORD`：前台访问密码
- `ADMIN_PASSWORD`：后台访问密码
- `AUTH_SECRET`：访问令牌签名密钥，生产环境必须修改
- `HF_RENDER_WORKERS`：渲染 worker 数

### 文本模型

- `Provider`：`openai-compatible`、`anthropic-compatible` 或 `custom`
- `Base URL`：模型服务地址
- `API Key`：模型服务密钥
- `Model`：模型名
- `Temperature`：生成温度

OpenAI-compatible 通常使用 `/chat/completions`。Anthropic-compatible 使用消息接口。自定义服务需要兼容项目后端的请求格式。

### 图片生成

- `none`：不调用图片服务，只使用模板背景
- `openai`：调用 `${imageBaseUrl}/images/generations`
- `pexels`：从 Pexels 下载背景图

为了避免画面和界面文字混在一起，项目会要求背景图不要包含文字、标志、水印、字幕或 UI 字样。最终标题、强调句和字幕由 HyperFrames HTML 统一排版。

### 旁白音频

- `mimo`：调用 `${baseUrl}/chat/completions`，请求体包含 `audio`
- `openai` / `custom` / `minimax`：调用 `${baseUrl}/audio/speech`

可以配置 `model`、`voice`、`format` 和 `speed`。生成成功后，场景时长会尽量跟随旁白音频，减少音画不同步。

## 制作流程

1. 读取来源内容并保存 `source.md`
2. 调用配置的文本模型生成 `storyboard.json`
3. 生成或下载每个场景的背景图
4. 生成旁白音频并读取音频时长
5. 根据文本密度和音频时长计算场景 timing
6. 合成 HyperFrames `index.html`
7. lint 时间轴和素材引用
8. 使用 HyperFrames Producer 渲染 `renders/output.mp4`
9. 在前台展示视频、HTML、storyboard、source 和素材产物

## 项目结构

```text
.
├── apps
│   ├── api        # Hono API、任务队列、模型调用、素材生成和渲染流程
│   └── web        # React 前台工作台和后台控制台
├── data           # 本地运行数据目录，默认不提交
├── docker-compose.yml
├── pnpm-workspace.yaml
└── README.md
```

## 隐私与安全

- 不要提交 `.env`、`data/`、生成项目、任务记录或渲染产物
- 生产环境必须修改 `USER_PASSWORD`、`ADMIN_PASSWORD` 和 `AUTH_SECRET`
- 模型 API Key 只保存在服务端配置里，不会下发给前台页面
- 产物下载接口会拒绝 dotfile 路径，避免泄露 `.env` 等敏感文件
- 渲染会启动 Chromium 和 FFmpeg，建议放在低权限容器中运行
- 公网部署时建议增加反向代理鉴权、HTTPS、限流和日志监控

## 已知限制

- 当前任务队列是单进程内存队列，适合单副本部署
- 多副本部署需要外部队列和共享产物存储
- 生成质量依赖你配置的文本模型、图片模型和 TTS 服务
- 部分 OpenAI-compatible 服务并不完整支持图片或音频 endpoint，需要按服务商文档配置
- 长视频渲染会占用较多 CPU、内存和磁盘空间

## 贡献

欢迎提交 issue 或 pull request。提交前建议先运行：

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## 许可证

本项目基于 [0BSD License](./LICENSE) 开源。这是非常宽松的开源许可，允许出于任何目的使用、复制、修改和分发代码，不要求保留版权声明。
