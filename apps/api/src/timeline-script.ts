import { formatSeconds, roundSeconds } from "./time-format.js";

const TIMELINE_RUNTIME = String.raw`
        function createHyperframesTimeline(totalDuration) {
          const actions = [];
          let currentTime = 0;
          let playing = false;
          let playbackRate = 1;

          const clamp01 = (value) => Math.max(0, Math.min(1, value));
          const easeOut = (value) => 1 - Math.pow(1 - value, 3);
          const targetsFor = (selector) => Array.from(document.querySelectorAll(selector));
          const numeric = (value, fallback) => {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : fallback;
          };
          const tweenDuration = (props) => Math.max(0, numeric(props.duration, 0));

          const mixedProps = (from, to, progress) => {
            const eased = easeOut(clamp01(progress));
            return {
              opacity:
                "opacity" in from || "opacity" in to
                  ? numeric(from.opacity, 1) + (numeric(to.opacity, 1) - numeric(from.opacity, 1)) * eased
                  : undefined,
              x: numeric(from.x, 0) + (numeric(to.x, 0) - numeric(from.x, 0)) * eased,
              y: numeric(from.y, 0) + (numeric(to.y, 0) - numeric(from.y, 0)) * eased,
            };
          };

          const applyProps = (element, props) => {
            if (props.opacity !== undefined) element.style.opacity = String(props.opacity);
            if (props.x !== undefined || props.y !== undefined) {
              element.style.transform = "translate3d(" + numeric(props.x, 0) + "px, " + numeric(props.y, 0) + "px, 0)";
            }
          };

          const applyAt = (time) => {
            currentTime = Math.max(0, Math.min(totalDuration, numeric(time, 0)));
            for (const scene of document.querySelectorAll(".scene")) {
              scene.style.opacity = "0";
            }
            for (const action of actions) {
              if (action.kind === "set") {
                if (currentTime >= action.at) {
                  for (const target of targetsFor(action.selector)) applyProps(target, action.props);
                }
                continue;
              }
              const elapsed = currentTime - action.at;
              const props =
                elapsed <= 0
                  ? mixedProps(action.from, action.to, 0)
                  : elapsed >= action.duration
                    ? mixedProps(action.from, action.to, 1)
                    : mixedProps(action.from, action.to, elapsed / action.duration);
              for (const target of targetsFor(action.selector)) applyProps(target, props);
            }
          };

          const timeline = {
            set(selector, props, at) {
              actions.push({ kind: "set", selector, props, at: numeric(at, 0), duration: 0 });
              applyAt(currentTime);
              return timeline;
            },
            fromTo(selector, from, to, at) {
              actions.push({
                kind: "fromTo",
                selector,
                from,
                to,
                at: numeric(at, 0),
                duration: tweenDuration(to),
              });
              applyAt(currentTime);
              return timeline;
            },
            pause() {
              playing = false;
              return timeline;
            },
            play() {
              playing = true;
              return timeline;
            },
            seek(value) {
              applyAt(value);
              return timeline;
            },
            totalTime(value) {
              if (value !== undefined) applyAt(value);
              return timeline;
            },
            time() {
              return currentTime;
            },
            duration() {
              return totalDuration;
            },
            timeScale(value) {
              if (value !== undefined) playbackRate = numeric(value, 1);
              return playbackRate;
            },
            getChildren() {
              return actions.map((action) => ({
                startTime: () => action.at,
                duration: () => action.duration,
                targets: () => targetsFor(action.selector),
              }));
            },
          };

          applyAt(0);
          return timeline;
        }`;

export function createTimelineScript(sceneDurations: readonly number[]): string {
  const totalDuration = roundSeconds(sceneDurations.reduce((sum, duration) => sum + duration, 0));
  return [
    TIMELINE_RUNTIME,
    `        const tl = createHyperframesTimeline(${totalDuration});`,
    ...sceneDurations.map((duration, index) =>
      sceneTimeline(index, startForScene(sceneDurations, index), duration),
    ),
    "        window.__timelines = window.__timelines || {};",
    "        window.__timelines.main = tl;",
  ].join("\n");
}

function sceneTimeline(index: number, start: number, duration: number): string {
  const sceneNumber = String(index + 1).padStart(2, "0");
  const end = roundSeconds(start + duration);
  return [
    `        tl.set("#scene-${sceneNumber}", { opacity: 1 }, ${formatSeconds(start)});`,
    `        tl.fromTo("#scene-${sceneNumber} .kicker", { y: 28, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45 }, ${formatSeconds(start + 0.18)});`,
    `        tl.fromTo("#scene-${sceneNumber} .headline", { y: 46, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 }, ${formatSeconds(start + 0.32)});`,
    `        tl.fromTo("#scene-${sceneNumber} .body", { y: 34, opacity: 0 }, { y: 0, opacity: 1, duration: 0.58 }, ${formatSeconds(start + 0.58)});`,
    `        tl.fromTo("#scene-${sceneNumber} .caption", { x: -26, opacity: 0 }, { x: 0, opacity: 1, duration: 0.55 }, ${formatSeconds(start + 0.86)});`,
    `        tl.set("#scene-${sceneNumber}", { opacity: 0 }, ${formatSeconds(end)});`,
  ].join("\n");
}

function startForScene(sceneDurations: readonly number[], index: number): number {
  return roundSeconds(sceneDurations.slice(0, index).reduce((sum, duration) => sum + duration, 0));
}
