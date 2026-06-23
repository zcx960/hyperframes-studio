import { describe, expect, it } from "vitest";
import { composeHyperframesHtml } from "./composer.js";
import type { WorkflowDraftRequest } from "./domain.js";
import type { Storyboard } from "./providers/model.js";
import { assertCompositionValid } from "./render.js";

const REQUEST: WorkflowDraftRequest = {
  title: "测试短视频",
  sourceType: "script",
  source: "用于测试的脚本",
  style: "news-flash",
  format: "portrait",
  sceneCount: 2,
  includeVoiceover: false,
};

const STORYBOARD: Storyboard = {
  title: "测试短视频",
  summary: "测试摘要",
  scenes: [
    {
      headline: "第一幕",
      body: "第一幕正文",
      narration: "第一幕旁白",
      visual: "城市夜景",
      emphasis: "起",
    },
    {
      headline: "第二幕",
      body: "第二幕正文",
      narration: "第二幕旁白",
      visual: "办公桌面",
      emphasis: "承",
    },
  ],
};

describe("composeHyperframesHtml", () => {
  it("Given generated scene assets When composing HTML Then it keeps rendering self-contained", () => {
    const html = composeHyperframesHtml(
      STORYBOARD,
      REQUEST,
      [{ sceneIndex: 0, path: "assets/scene-01.png", alt: "城市夜景" }],
      [
        {
          sceneIndex: 0,
          path: "assets/voice-01.mp3",
          narration: "第一幕旁白",
          durationSeconds: 3,
        },
      ],
    );

    expect(html).toContain('class="scene-bg" src="assets/scene-01.png"');
    expect(html).toContain(
      '<audio id="voice-01" data-start="0" data-duration="5" data-track-index="1" src="assets/voice-01.mp3"',
    );
    expect(html).toContain("window.__timelines.main");
    expect(html).not.toMatch(/<script\s+[^>]*src=/i);
    expect(html).not.toContain("cdnjs.cloudflare.com");
    expect(html).not.toContain("cdn.jsdelivr.net");
    expect(html).not.toContain("requestAnimationFrame");
  });

  it("Given a long voiceover When composing HTML Then the scene lasts until narration finishes", () => {
    const [firstScene, secondScene] = STORYBOARD.scenes;
    if (!firstScene || !secondScene) {
      throw new Error("Expected two storyboard scenes.");
    }
    const storyboard: Storyboard = {
      ...STORYBOARD,
      scenes: [{ ...firstScene, visual: "DO_NOT_RENDER_VISUAL_PROMPT" }, secondScene],
    };

    const html = composeHyperframesHtml(
      storyboard,
      { ...REQUEST, includeVoiceover: true },
      [],
      [
        {
          sceneIndex: 0,
          path: "assets/voice-01.mp3",
          narration: "第一幕旁白",
          durationSeconds: 10.4,
        },
      ],
    );

    expect(html).toContain('id="stage" data-composition-id="main"');
    expect(html).toContain('data-duration="19.2" data-fps="30"');
    expect(html).toContain(
      '<section id="scene-01" class="scene clip" data-start="0" data-duration="11.199"',
    );
    expect(html).toContain(
      '<section id="scene-02" class="scene clip" data-start="11.2" data-duration="8"',
    );
    expect(html).toContain(
      '<audio id="voice-01" data-start="0" data-duration="11.2" data-track-index="1"',
    );
    expect(html).not.toContain('class="visual"');
    expect(html).not.toContain("DO_NOT_RENDER_VISUAL_PROMPT");
  });

  it("Given many fractional scene durations When composing HTML Then clips do not overlap in lint", async () => {
    const scenes = Array.from({ length: 20 }, (_, index) => ({
      headline: `第 ${index + 1} 幕`,
      body: "测试正文",
      narration: "测试旁白",
      visual: "测试画面",
      emphasis: String(index + 1).padStart(2, "0"),
    }));
    const html = composeHyperframesHtml(
      { ...STORYBOARD, scenes },
      { ...REQUEST, sceneCount: 20, includeVoiceover: true },
      [],
      scenes.map((_scene, index) => ({
        sceneIndex: index,
        path: `assets/voice-${String(index + 1).padStart(2, "0")}.mp3`,
        narration: "测试旁白",
        durationSeconds: 7.4,
      })),
    );

    expect(html).not.toMatch(/data-(?:start|duration)="\d+\.\d{4,}"/);
    expect(html).toContain('data-start="49.2" data-duration="8.199"');
    await expect(assertCompositionValid(html)).resolves.toBeUndefined();
  });

  it("Given dense Chinese narration When composing landscape HTML Then text is not line-clamped or container-clipped", async () => {
    const denseStoryboard: Storyboard = {
      ...STORYBOARD,
      scenes: [
        {
          headline: "哈勃看到宇宙正在膨胀",
          body: "1920年代，天文学家哈勃用当时世界上最大的望远镜观测远处星系。他注意到几乎所有星系都在远离我们，而且越远的星系退行得越快。",
          narration:
            "这不是星系在一个固定空间里飞走，而是空间本身在伸展。就像面团发酵时，葡萄干之间的距离都会变大，每个观察者都会觉得其他地方正在远离自己。",
          visual: "深空星系与观测台",
          emphasis: "观测",
        },
      ],
    };

    const html = composeHyperframesHtml(
      denseStoryboard,
      { ...REQUEST, format: "landscape", sceneCount: 1, includeVoiceover: true },
      [],
      [
        {
          sceneIndex: 0,
          path: "assets/voice-01.mp3",
          narration: denseStoryboard.scenes[0]?.narration ?? "",
          durationSeconds: 12.2,
        },
      ],
    );

    expect(html).toContain("--body-size: 28px");
    expect(html).toContain("--caption-size: 22px");
    expect(html).toContain("overflow: visible;");
    expect(html).not.toContain("-webkit-line-clamp");
    await expect(assertCompositionValid(html)).resolves.toBeUndefined();
  });
});
