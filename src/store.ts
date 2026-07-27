import { App, Notice, TFile, TFolder, normalizePath } from "obsidian";
import { Session } from "./core/types";
import {
  appendDailySession,
  appendInvoice,
  createDailyFile,
  createProjectFile,
  parseFrontmatter,
  sanitizeProjectName,
  setFrontmatterFields,
} from "./core/markdown";
import { dateStr, roundUpMinutes } from "./core/time";
import { TimeSyncSettings } from "./settings";

/**
 * Reads and writes a project's vault files: the project note (frontmatter totals
 * plus the Invoices table) and its per-day daily logs (the actual session records).
 * All paths are derived from the configured base folder and the sanitized project name.
 */
export class VaultStore {
  /** @param getSettings - a getter (not a snapshot) so the store always sees the plugin's current settings. */
  constructor(private app: App, private getSettings: () => TimeSyncSettings) {}

  /** Vault path of the folder containing every project's subfolder. */
  private projectsFolder(): string {
    return normalizePath(`${this.getSettings().baseFolder}/Projects`);
  }

  /** Vault path of a single project's folder (containing its note and Daily subfolder). */
  private projectFolder(name: string): string {
    return normalizePath(`${this.projectsFolder()}/${sanitizeProjectName(name)}`);
  }

  /** Vault path of a project's note file. */
  private projectPath(name: string): string {
    return normalizePath(`${this.projectFolder(name)}/${sanitizeProjectName(name)}.md`);
  }

  /** Lists known project names by reading the subfolders of the Projects folder (alphabetical). */
  async listProjects(): Promise<string[]> {
    const folder = this.app.vault.getAbstractFileByPath(this.projectsFolder());
    if (!(folder instanceof TFolder)) return [];
    return folder.children
      .filter((f): f is TFolder => f instanceof TFolder)
      .map((f) => f.name)
      .sort();
  }

  /** Creates every path segment of `path` that doesn't already exist, ignoring "already exists" races. */
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

  /** Returns the project's note file, creating it (and its folder) with a fresh frontmatter block if it doesn't exist yet. */
  private async getOrCreateProjectFile(name: string): Promise<TFile> {
    const path = this.projectPath(name);
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) return existing;
    await this.ensureFolder(this.projectFolder(name));
    return this.app.vault.create(path, createProjectFile(sanitizeProjectName(name), dateStr(new Date())));
  }

  /** Reads `uninvoiced_minutes` from a project note's frontmatter, falling back to 0 (with a warning Notice) if it's missing or not a number. */
  private readUninvoiced(content: string): number {
    const value = Number(parseFrontmatter(content)["uninvoiced_minutes"]);
    if (Number.isNaN(value)) {
      new Notice("Time Sync: invalid uninvoiced_minutes in project file; treating as 0.");
      return 0;
    }
    return value;
  }

  /**
   * Records a completed session: adds its (already-rounded) billed minutes to the
   * project note's uninvoiced total, then appends the full session detail to the
   * day's daily log. The daily log is the session record; the project note only
   * ever sees the rolled-up sum.
   */
  async recordSession(name: string, session: Session): Promise<void> {
    const file = await this.getOrCreateProjectFile(name);
    await this.app.vault.process(file, (content) => {
      const uninvoiced = this.readUninvoiced(content);
      return setFrontmatterFields(content, {
        uninvoiced_minutes: uninvoiced + session.billedMinutes,
      });
    });
    await this.appendDailyLog(name, session);
  }

  /** Appends `session` to the project's daily log for `session.date`, creating that day's log file if needed. */
  private async appendDailyLog(name: string, session: Session): Promise<void> {
    const folder = normalizePath(`${this.projectFolder(name)}/Daily`);
    await this.ensureFolder(folder);
    const path = normalizePath(`${folder}/${session.date}.md`);
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      await this.app.vault.process(existing, (content) => appendDailySession(content, session));
    } else {
      await this.app.vault.create(path, createDailyFile(session.date, session));
    }
  }

  /** Returns a project's current uninvoiced minutes, or 0 if the project note doesn't exist. */
  async getUninvoicedMinutes(name: string): Promise<number> {
    const file = this.app.vault.getAbstractFileByPath(this.projectPath(name));
    if (!(file instanceof TFile)) return 0;
    return this.readUninvoiced(await this.app.vault.read(file));
  }

  /** Returns every project's name paired with its current uninvoiced minutes. */
  async listUninvoiced(): Promise<{ name: string; minutes: number }[]> {
    const names = await this.listProjects();
    return Promise.all(
      names.map(async (name) => ({ name, minutes: await this.getUninvoicedMinutes(name) }))
    );
  }

  /**
   * Saves an invoice for the project's current uninvoiced total and resets that
   * total to zero. Invoice rounding is applied here, to the accumulated (already
   * session-rounded) total — never to raw session time. Returns the invoiced minutes.
   */
  async markInvoice(name: string, date: string, note: string): Promise<number> {
    const file = await this.getOrCreateProjectFile(name);
    let invoiced = 0;
    await this.app.vault.process(file, (content) => {
      const total = this.readUninvoiced(content);
      invoiced = roundUpMinutes(total, this.getSettings().invoiceRounding);
      return setFrontmatterFields(
        appendInvoice(content, { date, invoicedMinutes: invoiced, sessionsTotalMinutes: total, note }),
        { uninvoiced_minutes: 0, last_invoice: date }
      );
    });
    return invoiced;
  }
}
