import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import type TimeSyncPlugin from "./main";
import { dateStr, formatClock, formatHours, roundUpMinutes } from "./core/time";
import { sanitizeProjectName } from "./core/markdown";
import { ConfirmModal } from "./modals";

export const VIEW_TYPE_TIME_SYNC = "time-sync-view";

export class TrackerView extends ItemView {
  private projectInput!: HTMLInputElement;
  private clockEl: HTMLElement | null = null;
  private renderGeneration = 0;
  private static instanceCounter = 0;
  private datalistId = `time-sync-projects-${TrackerView.instanceCounter++}`;

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
    this.registerInterval(
      window.setInterval(() => {
        const timer = this.plugin.activeTimer;
        if (timer && this.clockEl) {
          this.clockEl.setText(formatClock(Date.now() - timer.startedAt));
        }
      }, 1000)
    );
    await this.render();
  }

  async onClose() {}

  async render() {
    const generation = ++this.renderGeneration;
    const projects = await this.plugin.store.listProjects();
    const rows = await this.plugin.store.listUninvoiced();
    if (generation !== this.renderGeneration) return;

    const timer = this.plugin.activeTimer;
    const el = this.contentEl;
    el.empty();
    el.addClass("time-sync-view");

    const picker = el.createDiv({ cls: "time-sync-picker" });
    this.projectInput = picker.createEl("input", {
      type: "text",
      placeholder: "Project name…",
    });
    this.projectInput.setAttr("list", this.datalistId);
    const datalist = picker.createEl("datalist");
    datalist.id = this.datalistId;
    for (const name of projects) {
      datalist.createEl("option", { value: name });
    }
    if (timer) {
      this.projectInput.value = timer.project;
      this.projectInput.disabled = true;
    }

    this.clockEl = el.createDiv({
      cls: "time-sync-clock",
      text: timer ? formatClock(Date.now() - timer.startedAt) : "0:00:00",
    });
    const button = el.createEl("button", {
      cls: "mod-cta time-sync-button",
      text: timer ? "Stop" : "Start",
    });
    button.onclick = () => {
      if (this.plugin.activeTimer) {
        this.plugin.stopTimer();
      } else {
        const name = this.projectInput.value.trim();
        if (!sanitizeProjectName(name)) {
          new Notice("Enter a valid project name first.");
          return;
        }
        void this.plugin.startTimer(name);
      }
    };

    const billable = rows.filter((row) => row.minutes > 0);
    if (billable.length === 0) {
      el.createEl("p", {
        cls: "time-sync-empty",
        text:
          rows.length === 0
            ? "You haven't saved any invoices yet. Track some time and each project's billable hours will appear here."
            : "Nothing waiting to be invoiced — you're all caught up. New sessions will appear here.",
      });
      return;
    }
    el.createEl("h4", { text: "Uninvoiced" });
    const list = el.createDiv({ cls: "time-sync-uninvoiced" });
    for (const row of billable) {
      const item = list.createDiv({ cls: "time-sync-project-row" });
      item.createSpan({ text: `${row.name}: ${formatHours(row.minutes)}` });
      const invoiceBtn = item.createEl("button", { text: "Invoice" });
      invoiceBtn.onclick = () => {
        invoiceBtn.disabled = true;
        const billed = roundUpMinutes(row.minutes, this.plugin.settings.invoiceRounding);
        const rounded =
          billed !== row.minutes ? ` (rounded up from ${formatHours(row.minutes)})` : "";
        new ConfirmModal(
          this.app,
          `Save an invoice point for ${row.name}?`,
          `This records ${formatHours(billed)}${rounded} as invoiced, adding a dated line to the Invoices list in ${row.name}'s project note.\n` +
            `${row.name}'s uninvoiced total then resets to zero, so new sessions count toward your next invoice.`,
          "Save invoice point",
          async () => {
            const minutes = await this.plugin.store.markInvoice(row.name, dateStr(new Date()));
            new Notice(`Invoiced ${formatHours(minutes)} for ${row.name}.`);
            await this.render();
          },
          () => {
            invoiceBtn.disabled = false;
          }
        ).open();
      };
    }
  }
}
