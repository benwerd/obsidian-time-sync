import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import type TimeSyncPlugin from "./main";
import { dateStr, formatClock, formatHours, roundUpMinutes } from "./core/time";
import { ConfirmModal } from "./modals";

export const VIEW_TYPE_TIME_SYNC = "time-sync-view";

export class TrackerView extends ItemView {
  private projectInput!: HTMLInputElement;
  private clockEl!: HTMLElement;
  private clockInterval: number | null = null;

  constructor(leaf: WorkspaceLeaf, private plugin: TimeSyncPlugin) {
    super(leaf);
  }

  getViewType() {
    return VIEW_TYPE_TIME_SYNC;
  }

  getDisplayText() {
    return "Time Sync";
  }

  getIcon() {
    return "clock";
  }

  async onOpen() {
    await this.render();
  }

  async onClose() {
    this.stopClock();
  }

  async render() {
    const el = this.contentEl;
    el.empty();
    el.addClass("time-sync-view");
    const timer = this.plugin.activeTimer;

    const picker = el.createDiv({ cls: "time-sync-picker" });
    this.projectInput = picker.createEl("input", {
      type: "text",
      placeholder: "Project name…",
    });
    this.projectInput.setAttr("list", "time-sync-projects");
    const datalist = picker.createEl("datalist");
    datalist.id = "time-sync-projects";
    for (const name of await this.plugin.store.listProjects()) {
      datalist.createEl("option", { value: name });
    }
    if (timer) {
      this.projectInput.value = timer.project;
      this.projectInput.disabled = true;
    }

    this.clockEl = el.createDiv({ cls: "time-sync-clock", text: "0:00:00" });
    const button = el.createEl("button", {
      cls: "mod-cta time-sync-button",
      text: timer ? "Stop" : "Start",
    });
    button.onclick = () => {
      if (this.plugin.activeTimer) {
        this.plugin.stopTimer();
      } else {
        const name = this.projectInput.value.trim();
        if (!name) {
          new Notice("Enter a project name first.");
          return;
        }
        void this.plugin.startTimer(name);
      }
    };
    if (timer) this.startClock();
    else this.stopClock();

    el.createEl("h4", { text: "Uninvoiced" });
    const list = el.createDiv({ cls: "time-sync-uninvoiced" });
    const rows = await this.plugin.store.listUninvoiced();
    if (rows.length === 0) list.createEl("p", { text: "No projects yet." });
    for (const row of rows) {
      const item = list.createDiv({ cls: "time-sync-project-row" });
      item.createSpan({ text: `${row.name}: ${formatHours(row.minutes)}` });
      const invoiceBtn = item.createEl("button", { text: "Invoice" });
      invoiceBtn.onclick = () => {
        const billed = roundUpMinutes(row.minutes, this.plugin.settings.invoiceRounding);
        new ConfirmModal(
          this.app,
          `Mark invoice point for "${row.name}" at ${formatHours(billed)}` +
            (billed !== row.minutes ? ` (rounded up from ${formatHours(row.minutes)})` : "") +
            `? This resets its uninvoiced time.`,
          async () => {
            const minutes = await this.plugin.store.markInvoice(row.name, dateStr(new Date()));
            new Notice(`Invoiced ${formatHours(minutes)} for ${row.name}.`);
            await this.render();
          }
        ).open();
      };
    }
  }

  private startClock() {
    this.stopClock();
    const tick = () => {
      const timer = this.plugin.activeTimer;
      if (timer) this.clockEl.setText(formatClock(Date.now() - timer.startedAt));
    };
    tick();
    this.clockInterval = window.setInterval(tick, 1000);
    this.registerInterval(this.clockInterval);
  }

  private stopClock() {
    if (this.clockInterval !== null) {
      window.clearInterval(this.clockInterval);
      this.clockInterval = null;
    }
  }
}
