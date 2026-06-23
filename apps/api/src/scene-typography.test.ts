import { describe, expect, it } from "vitest";
import { sceneTypography } from "./scene-typography.js";

describe("sceneTypography", () => {
  it("Given dense Chinese landscape text When calculating typography Then it reserves readable room for narration", () => {
    const typography = sceneTypography({
      format: "landscape",
      headline: "哈勃看到宇宙正在膨胀",
      body: "1920年代，天文学家哈勃用当时世界上最大的望远镜观测远处星系。他注意到几乎所有星系都在远离我们，而且越远的星系退行得越快。",
      narration:
        "这不是星系在一个固定空间里飞走，而是空间本身在伸展。就像面团发酵时，葡萄干之间的距离都会变大，每个观察者都会觉得其他地方正在远离自己。",
      includeVoiceover: true,
    });

    expect(typography.headlineSize).toBeLessThanOrEqual(60);
    expect(typography.bodySize).toBeLessThanOrEqual(28);
    expect(typography.captionSize).toBeLessThanOrEqual(22);
    expect(typography.copyGap).toBeLessThanOrEqual(22);
  });

  it("Given short portrait text When calculating typography Then it keeps the larger editorial scale", () => {
    const typography = sceneTypography({
      format: "portrait",
      headline: "第一幕",
      body: "一句关键解释。",
      narration: "第一幕旁白。",
      includeVoiceover: true,
    });

    expect(typography.headlineSize).toBe(84);
    expect(typography.bodySize).toBe(42);
    expect(typography.captionSize).toBe(30);
  });
});
