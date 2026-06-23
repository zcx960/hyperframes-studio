import ky from "ky";
import { parseHTML } from "linkedom";
import type { WorkflowDraftRequest } from "../domain.js";

const MAX_SOURCE_CHARS = 16_000;

export class SourceLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceLoadError";
  }
}

export async function loadSourceText(request: WorkflowDraftRequest): Promise<string> {
  if (request.sourceType !== "wechat-url") {
    return limitText(request.source);
  }

  let url: URL;
  try {
    url = new URL(request.source);
  } catch {
    throw new SourceLoadError("公众号链接不是有效 URL。");
  }

  const html = await ky
    .get(url, {
      timeout: 30_000,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 HyperFramesStudio/1.0",
      },
    })
    .text();

  return limitText(extractReadableText(html));
}

function extractReadableText(html: string): string {
  const { document } = parseHTML(html);
  for (const selector of ["script", "style", "noscript", "svg"]) {
    for (const node of document.querySelectorAll(selector)) {
      node.remove();
    }
  }
  const title = document.querySelector("title")?.textContent?.trim() ?? "";
  const article =
    document.querySelector("#js_content")?.textContent ??
    document.querySelector("article")?.textContent ??
    document.body?.textContent ??
    "";
  return normalizeWhitespace([title, article].filter(Boolean).join("\n\n"));
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function limitText(text: string): string {
  const clean = normalizeWhitespace(text);
  return clean.length > MAX_SOURCE_CHARS ? clean.slice(0, MAX_SOURCE_CHARS) : clean;
}
