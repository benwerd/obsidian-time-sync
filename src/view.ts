import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import type TimeSyncPlugin from "./main";
import { dateStr, formatClock, formatHours, roundUpMinutes } from "./core/time";
import { sanitizeProjectName } from "./core/markdown";
import { InvoiceModal } from "./modals";

/** Registered Obsidian view type identifier for the Time Sync panel. */
export const VIEW_TYPE_TIME_SYNC = "time-sync-view";

/**
 * Sidebar panel showing the project picker, Start/Stop button, live clock, and
 * the list of projects with uninvoiced time. One instance is created per leaf
 * (e.g. per split pane), so instance-scoped state (like `datalistId`) must not
 * collide across instances.
 */
export class TrackerView extends ItemView {
  private projectInput!: HTMLInputElement;
  private clockEl: HTMLElement | null = null;
  /** Bumped on every `render()` call; a render only touches the DOM if it's still the newest one when its async data arrives. */
  private renderGeneration = 0;
  private static instanceCounter = 0;
  /** Per-instance id for this view's `<datalist>`, avoiding DOM id collisions when multiple views are open (e.g. split panes). */
  private datalistId = `time-sync-projects-${TrackerView.instanceCounter++}`;

  /** Instantiated by the view factory passed to `registerView` in main.ts, once per leaf. */
  constructor(leaf: WorkspaceLeaf, private plugin: TimeSyncPlugin) {
    super(leaf);
  }

  /** ItemView hook: registers this view under `VIEW_TYPE_TIME_SYNC`. */
  getViewType() {
    return VIEW_TYPE_TIME_SYNC;
  }

  /** ItemView hook: the tab/leaf title shown in Obsidian's UI. */
  getDisplayText() {
    return "Time Sync";
  }

  /** ItemView hook: the Lucide icon shown for this view's tab/leaf. */
  getIcon() {
    return "clock";
  }

  /** Starts the view's single lifetime clock interval (ticks the visible timer every second while a timer is active) and does the first render. */
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

  /** ItemView hook: no teardown needed — the clock interval is released automatically via `registerInterval`. */
  async onClose() {}

  /**
   * Re-fetches project/uninvoiced data and rebuilds the panel DOM.
   *
   * Reentrancy-safe: renders can overlap (e.g. triggered by a data change while
   * a previous render's data is still in flight). Each call captures a generation
   * number before awaiting; if a newer call has started by the time the data
   * arrives, this call bails out before touching the DOM, so only the DOM built
   * by the most recently invoked render ever survives.
   */
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
      placeholder: "Type or select your project name",
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
        // Disable immediately to prevent a double-click opening two modals for the same row;
        // re-enabled via the modal's dismiss callback if the user cancels.
        invoiceBtn.disabled = true;
        // Preview-only: the actual invoice rounding is applied again (to the then-current
        // total) inside VaultStore.markInvoice when the modal is submitted.
        const billed = roundUpMinutes(row.minutes, this.plugin.settings.invoiceRounding);
        new InvoiceModal(
          this.app,
          row.name,
          row.minutes,
          billed,
          async (note) => {
            const minutes = await this.plugin.store.markInvoice(row.name, dateStr(new Date()), note.trim());
            new Notice(`Saved a ${formatHours(minutes)} invoice for ${row.name}.`);
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
