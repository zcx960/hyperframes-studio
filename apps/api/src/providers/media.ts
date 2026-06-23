import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import ky from "ky";
import { z } from "zod";
import type { StudioSettings, WorkflowDraftRequest } from "../domain.js";
import { MediaProviderError, imageConcurrency, mapConcurrent, withRetry } from "./media-runtime.js";
import type { Storyboard } from "./model.js";

const OpenAiImageResponseSchema = z.object({
  data: z
    .array(
      z.object({
        b64_json: z.string().optional(),
        url: z.string().url().optional(),
      }),
    )
    .min(1),
});

const PexelsSearchResponseSchema = z.object({
  photos: z
    .array(
      z.object({
        url: z.string().url(),
        photographer: z.string().min(1),
        photographer_url: z.string().url(),
        src: z.object({
          original: z.string().url(),
          large2x: z.string().url(),
          portrait: z.string().url(),
          landscape: z.string().url(),
        }),
      }),
    )
    .min(1),
});

export type SceneAsset = {
  readonly sceneIndex: number;
  readonly path: string;
  readonly alt: string;
  readonly attribution?: string;
};

export interface SceneAssetInput {
  readonly storyboard: Storyboard;
  readonly request: WorkflowDraftRequest;
  readonly settings: StudioSettings;
  readonly projectDir: string;
  readonly onProgress?: (message: string) => Promise<void> | void;
}

export async function prepareSceneAssets(input: SceneAssetInput): Promise<readonly SceneAsset[]> {
  const provider = input.settings.media.imageProvider;
  if (provider === "none") {
    return [];
  }

  if (provider === "openai") {
    return generateOpenAiImages(input);
  }

  return fetchPexelsImages(input);
}

async function generateOpenAiImages(input: SceneAssetInput): Promise<readonly SceneAsset[]> {
  const apiKey = input.settings.media.imageApiKey.trim();
  const model = input.settings.media.imageModel.trim();
  if (!apiKey || !model) {
    await input.onProgress?.("未配置图像生成 API Key 或 Model，使用纯排版背景");
    return [];
  }

  await mkdir(join(input.projectDir, "assets"), { recursive: true });
  const size = imageSizeFor(input.request.format);
  return mapConcurrent(
    input.storyboard.scenes,
    imageConcurrency(input.storyboard.scenes.length),
    async (scene, index) => {
      const sceneNumber = String(index + 1).padStart(2, "0");
      await input.onProgress?.(`生成背景图 ${sceneNumber}/${input.storyboard.scenes.length}`);
      const response = await withRetry(
        () =>
          ky
            .post(joinUrl(input.settings.media.imageBaseUrl, "images/generations"), {
              timeout: 180_000,
              headers: { Authorization: `Bearer ${apiKey}` },
              json: {
                model,
                prompt: buildImagePrompt(input, scene, index),
                n: 1,
                size,
                quality: "medium",
                background: "opaque",
                output_format: "png",
              },
            })
            .json(),
        `背景图 ${sceneNumber}`,
        input.onProgress,
      );
      const parsed = OpenAiImageResponseSchema.parse(response);
      const image = parsed.data[0];
      if (!image) {
        throw new MediaProviderError("图像生成接口没有返回图片数据。");
      }
      const relativePath = `assets/scene-${sceneNumber}.png`;
      await writeImageFile(join(input.projectDir, relativePath), image);
      return {
        sceneIndex: index,
        path: relativePath,
        alt: scene.visual,
      };
    },
  );
}

async function fetchPexelsImages(input: SceneAssetInput): Promise<readonly SceneAsset[]> {
  const apiKey = input.settings.media.pexelsApiKey?.trim() ?? "";
  if (!apiKey) {
    await input.onProgress?.("未配置 Pexels API Key，使用纯排版背景");
    return [];
  }

  await mkdir(join(input.projectDir, "assets"), { recursive: true });
  return mapConcurrent(
    input.storyboard.scenes,
    imageConcurrency(input.storyboard.scenes.length),
    async (scene, index) => {
      const sceneNumber = String(index + 1).padStart(2, "0");
      await input.onProgress?.(`下载图库背景 ${sceneNumber}/${input.storyboard.scenes.length}`);
      const data = await withRetry(
        () =>
          ky
            .get("https://api.pexels.com/v1/search", {
              timeout: 60_000,
              headers: { Authorization: apiKey },
              searchParams: {
                query: `${input.request.title} ${scene.visual}`,
                orientation: input.request.format,
                locale: "zh-CN",
                per_page: "1",
                page: String(index + 1),
              },
            })
            .json(),
        `图库背景 ${sceneNumber}`,
        input.onProgress,
      );
      const parsed = PexelsSearchResponseSchema.parse(data);
      const photo = parsed.photos[0];
      if (!photo) {
        throw new MediaProviderError("Pexels 没有返回可用图片。");
      }
      const imageUrl = pexelsImageUrl(photo.src, input.request.format);
      const relativePath = `assets/scene-${sceneNumber}${extensionForUrl(imageUrl)}`;
      await withRetry(
        () => downloadFile(imageUrl, join(input.projectDir, relativePath)),
        `图库图片 ${sceneNumber}`,
        input.onProgress,
      );
      return {
        sceneIndex: index,
        path: relativePath,
        alt: scene.visual,
        attribution: `Photo by ${photo.photographer} on Pexels`,
      };
    },
  );
}

function buildImagePrompt(
  input: SceneAssetInput,
  scene: Storyboard["scenes"][number],
  index: number,
): string {
  return [
    "Create a high-quality photographic background image for a Chinese short-form video scene.",
    `Scene number: ${index + 1}`,
    `Visual direction: ${scene.visual}`,
    `Mood/style: ${input.request.style}`,
    `Aspect ratio: ${input.request.format}`,
    "The prompt text is private production context; do not render any words from it into the image.",
    "Absolute visual rule: the image itself must contain zero text.",
    "Do not render any readable or unreadable letters, Chinese characters, numbers, captions, subtitles, signs, labels, logos, UI words, posters, book covers, watermarks, or typographic marks.",
    "If the visual direction mentions screens, interfaces, data cards, documents, charts, books, signs, or posters, show them only as abstract blurred shapes with no glyph-like strokes.",
    "Use only objects, people, environments, lighting, shapes, textures, screens with abstract glow, and clean negative space.",
    "Leave clean negative space for Chinese typography that will be overlaid later by the video renderer.",
    "Cinematic lighting, rich depth, editorial composition, production-ready.",
  ].join("\n");
}

async function writeImageFile(
  outputPath: string,
  image: z.infer<typeof OpenAiImageResponseSchema>["data"][number],
): Promise<void> {
  if (image.b64_json) {
    await writeFile(outputPath, Buffer.from(image.b64_json, "base64"));
    return;
  }

  if (image.url) {
    await downloadFile(image.url, outputPath);
    return;
  }

  throw new MediaProviderError("图像生成接口没有返回图片数据。");
}

async function downloadFile(url: string, outputPath: string): Promise<void> {
  const data = await ky.get(url, { timeout: 120_000 }).arrayBuffer();
  await writeFile(outputPath, Buffer.from(data));
}

function imageSizeFor(format: WorkflowDraftRequest["format"]): string {
  if (format === "portrait") return "1024x1536";
  if (format === "landscape") return "1536x1024";
  return "1024x1024";
}

function pexelsImageUrl(
  src: z.infer<typeof PexelsSearchResponseSchema>["photos"][number]["src"],
  format: WorkflowDraftRequest["format"],
): string {
  if (format === "portrait") return src.portrait;
  if (format === "landscape") return src.landscape;
  return src.large2x;
}

function extensionForUrl(url: string): string {
  const name = basename(new URL(url).pathname).toLowerCase();
  if (name.endsWith(".png")) return ".png";
  if (name.endsWith(".webp")) return ".webp";
  return ".jpg";
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path}`;
}
