import { Notice, Plugin } from "obsidian";
import { DEFAULT_SETTINGS, TimeSyncSettingTab, TimeSyncSettings } from "./settings";
import { VaultStore } from "./store";
import { TrackerView, VIEW_TYPE_TIME_SYNC } from "./view";
import { StartTimerModal, StopModal } from "./modals";
import { ActiveTimer, Session } from "./core/types";
import { sanitizeProjectName } from "./core/markdown";
import { dateStr, formatClock, formatDuration, roundUpMinutes, timeStr } from "./core/time";

/** Shape of the plugin's `saveData`/`loadData` payload. */
interface PersistedData {
  settings: TimeSyncSettings;
  activeTimer: ActiveTimer | null;
}

/** Time Sync plugin entry point: wires up the view, status bar, commands, and settings tab, and owns the single active timer. */
export default class TimeSyncPlugin extends Plugin {
  settings: TimeSyncSettings = { ...DEFAULT_SETTINGS };
  activeTimer: ActiveTimer | null = null;
  store!: VaultStore;
  private statusBar!: HTMLElement;
  /**
   * True from the moment Stop is pressed until the session write finishes.
   * Guards `stopTimer` against a rapid second Stop invocation double-recording
   * the same timer while the async write is still in flight.
   */
  private stopModalOpen = false;

  /** Obsidian lifecycle hook: loads persisted settings/timer, registers the view, ribbon icon, status bar, commands, and settings tab. */
  async onload() {
    const data = (await this.loadData()) as Partial<PersistedData> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...(data?.settings ?? {}) };
    this.activeTimer = data?.activeTimer ?? null;
    this.store = new VaultStore(this.app, () => this.settings);

    this.registerView(VIEW_TYPE_TIME_SYNC, (leaf) => new TrackerView(leaf, this));
    this.addRibbonIcon("clock", "Open Time Sync", () => this.activateView());

    this.statusBar = this.addStatusBarItem();
    this.statusBar.addClass("mod-clickable");
    this.statusBar.onClickEvent(() => this.activateView());
    this.registerInterval(window.setInterval(() => this.updateStatusBar(), 1000));
    this.updateStatusBar();

    this.addCommand({
      id: "open-panel",
      name: "Open panel",
      callback: () => this.activateView(),
    });
    this.addCommand({
      id: "start-timer",
      name: "Start timer",
      callback: async () => {
        if (this.activeTimer) {
          new Notice(`Already tracking "${this.activeTimer.project}" — stop it first.`);
          return;
        }
        new StartTimerModal(this.app, await this.store.listProjects(), (name) =>
          this.startTimer(name)
        ).open();
      },
    });
    this.addCommand({
      id: "stop-timer",
      name: "Stop timer",
      checkCallback: (checking) => {
        if (!this.activeTimer) return false;
        if (!checking) this.stopTimer();
        return true;
      },
    });

    this.addSettingTab(new TimeSyncSettingTab(this.app, this));
  }

  /** Writes settings and the active timer to Obsidian's plugin data store. */
  async persist() {
    const data: PersistedData = { settings: this.settings, activeTimer: this.activeTimer };
    await this.saveData(data);
  }

  /**
   * Starts tracking `project`. Sanitizes the name here so that every entry
   * point — the view's input, the command palette's StartTimerModal — ends up
   * agreeing on the same on-disk project identity. Persists immediately so the
   * timer survives an app quit or crash and resumes from this start time.
   */
  async startTimer(project: string) {
    if (this.activeTimer) {
      new Notice(`Already tracking "${this.activeTimer.project}" — stop it first.`);
      return;
    }
    project = sanitizeProjectName(project);
    if (!project) {
      new Notice("Enter a valid project name first.");
      return;
    }
    this.activeTimer = { project, startedAt: Date.now() };
    await this.persist();
    this.updateStatusBar();
    this.refreshView();
  }

  /**
   * Opens the Stop confirmation modal for the active timer. Computes raw and
   * billed minutes up front (billed = raw rounded up per the session rounding
   * setting) so the modal can show both. `stopModalOpen` blocks re-entry until
   * the modal's onSubmit has finished writing the session — see the field's
   * doc comment. Cancelling the modal leaves the timer running untouched.
   */
  stopTimer() {
    const timer = this.activeTimer;
    if (!timer || this.stopModalOpen) return;
    const now = Date.now();
    const rawMinutes = Math.max(1, Math.round((now - timer.startedAt) / 60000));
    const billedMinutes = roundUpMinutes(rawMinutes, this.settings.rounding);
    this.stopModalOpen = true;
    let submitted = false;
    new StopModal(
      this.app,
      timer.project,
      rawMinutes,
      billedMinutes,
      async (note) => {
        submitted = true;
        try {
          const start = new Date(timer.startedAt);
          const end = new Date(now);
          const session: Session = {
            date: dateStr(start),
            start: timeStr(start),
            end: timeStr(end),
            rawMinutes,
            billedMinutes,
            note: note.trim(),
          };
          await this.store.recordSession(timer.project, session);
          this.activeTimer = null;
          await this.persist();
          this.updateStatusBar();
          this.refreshView();
          new Notice(`Logged ${formatDuration(billedMinutes)} to ${timer.project}.`);
        } finally {
          // Guard stays up until the session write finishes, so a rapid second
          // Stop can't record the same timer twice.
          this.stopModalOpen = false;
        }
      },
      () => {
        // onDismiss fires on every close, including after a successful submit (whose
        // finally-block has already cleared the guard) — only clear it here for a
        // plain Cancel, so we don't race a fresh stopTimer() call against the write above.
        if (!submitted) this.stopModalOpen = false;
      }
    ).open();
  }

  /** Reveals the Time Sync view in the right sidebar, reusing an existing leaf if one is already open rather than creating a duplicate. */
  private async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_TIME_SYNC)[0];
    if (!leaf) {
      const right = workspace.getRightLeaf(false);
      if (!right) return;
      leaf = right;
      await leaf.setViewState({ type: VIEW_TYPE_TIME_SYNC, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  /** Re-renders every open Time Sync view (there may be more than one across split panes) after timer state changes. */
  private refreshView() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_TIME_SYNC)) {
      if (leaf.view instanceof TrackerView) void leaf.view.render();
    }
  }

  /** Updates the status bar text to show the running project and elapsed time, or clears it when nothing is tracking. */
  private updateStatusBar() {
    if (this.activeTimer) {
      this.statusBar.setText(
        `▶ ${this.activeTimer.project} ${formatClock(Date.now() - this.activeTimer.startedAt)}`
      );
    } else {
      this.statusBar.setText("");
    }
  }
}
