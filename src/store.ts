import { App, Notice, TFile, TFolder, normalizePath } from "obsidian";
import { Session } from "./core/types";
import {
  appendInvoice,
  appendSession,
  createProjectFile,
  dailyLogLine,
  invoiceHoursLabel,
  parseFrontmatter,
  sanitizeProjectName,
  setFrontmatterFields,
} from "./core/markdown";
import { dateStr, roundUpMinutes } from "./core/time";
import { TimeSyncSettings } from "./settings";

export class VaultStore {
  constructor(private app: App, private getSettings: () => TimeSyncSettings) {}

  private projectsFolder(): string {
    return normalizePath(`${this.getSettings().baseFolder}/Projects`);
  }

  private projectPath(name: string): string {
    return normalizePath(`${this.projectsFolder()}/${sanitizeProjectName(name)}.md`);
  }

  async listProjects(): Promise<string[]> {
    const folder = this.app.vault.getAbstractFileByPath(this.projectsFolder());
    if (!(folder instanceof TFolder)) return [];
    return folder.children
      .filter((f): f is TFile => f instanceof TFile && f.extension === "md")
      .map((f) => f.basename)
      .sort();
  }

  private async ensureFolder(path: string): Promise<void> {
    const parts = path.split("/");
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(current)) {
        await this.app.vault.createFolder(current).catch(() => {});
      }
    }
  }

  private async getOrCreateProjectFile(name: string): Promise<TFile> {
    const path = this.projectPath(name);
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) return existing;
    await this.ensureFolder(this.projectsFolder());
    return this.app.vault.create(path, createProjectFile(sanitizeProjectName(name), dateStr(new Date())));
  }

  private readUninvoiced(content: string): number {
    const value = Number(parseFrontmatter(content)["uninvoiced_minutes"]);
    if (Number.isNaN(value)) {
      new Notice("Time Sync: invalid uninvoiced_minutes in project file; treating as 0.");
      return 0;
    }
    return value;
  }

  async recordSession(name: string, session: Session): Promise<void> {
    const file = await this.getOrCreateProjectFile(name);
    await this.app.vault.process(file, (content) => {
      const uninvoiced = this.readUninvoiced(content);
      return setFrontmatterFields(appendSession(content, session), {
        uninvoiced_minutes: uninvoiced + session.billedMinutes,
      });
    });
    if (this.getSettings().dailyLog) {
      await this.appendDailyLog(name, session);
    }
  }

  private async appendDailyLog(name: string, session: Session): Promise<void> {
    const folder = normalizePath(`${this.projectsFolder()}/${sanitizeProjectName(name)}/Daily`);
    await this.ensureFolder(folder);
    const path = normalizePath(`${folder}/${session.date}.md`);
    const line = dailyLogLine(session);
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      await this.app.vault.process(existing, (content) => content.replace(/\n*$/, "\n") + line + "\n");
    } else {
      await this.app.vault.create(path, `# ${session.date}\n\n${line}\n`);
    }
  }

  async getUninvoicedMinutes(name: string): Promise<number> {
    const file = this.app.vault.getAbstractFileByPath(this.projectPath(name));
    if (!(file instanceof TFile)) return 0;
    return this.readUninvoiced(await this.app.vault.read(file));
  }

  async listUninvoiced(): Promise<{ name: string; minutes: number }[]> {
    const names = await this.listProjects();
    return Promise.all(
      names.map(async (name) => ({ name, minutes: await this.getUninvoicedMinutes(name) }))
    );
  }

  /** Records an invoice point (rounded up per the invoice rounding setting) and resets the clock. Returns the invoiced minutes. */
  async markInvoice(name: string, date: string): Promise<number> {
    const file = await this.getOrCreateProjectFile(name);
    let billed = 0;
    await this.app.vault.process(file, (content) => {
      const raw = this.readUninvoiced(content);
      billed = roundUpMinutes(raw, this.getSettings().invoiceRounding);
      return setFrontmatterFields(appendInvoice(content, date, invoiceHoursLabel(raw, billed)), {
        uninvoiced_minutes: 0,
        last_invoice: date,
      });
    });
    return billed;
  }
}
