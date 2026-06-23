import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { DEFAULT_SETTINGS, type StudioSettings, StudioSettingsSchema } from "./domain.js";

export class SettingsStore {
  readonly #path: string;

  constructor(path: string) {
    this.#path = path;
  }

  async read(): Promise<StudioSettings> {
    try {
      const raw = await readFile(this.#path, "utf8");
      const parsed = JSON.parse(raw);
      return StudioSettingsSchema.parse(parsed);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw error;
      }
      return DEFAULT_SETTINGS;
    }
  }

  async write(settings: StudioSettings): Promise<StudioSettings> {
    const parsed = StudioSettingsSchema.parse(settings);
    await mkdir(dirname(this.#path), { recursive: true });
    await writeFile(this.#path, JSON.stringify(parsed, null, 2), "utf8");
    return parsed;
  }
}
