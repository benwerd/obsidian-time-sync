import { Notice, Plugin } from "obsidian";
import { DEFAULT_SETTINGS, TimeSyncSettingTab, TimeSyncSettings } from "./settings";
import { VaultStore } from "./store";
import { TrackerView, VIEW_TYPE_TIME_SYNC } from "./view";
import { StartTimerModal, StopModal } from "./modals";
import { ActiveTimer, Session } from "./core/types";
import { sanitizeProjectName } from "./core/markdown";
import { dateStr, formatClock, formatDuration, roundUpMinutes, timeStr } from "./core/time";

interface PersistedData {
  settings: TimeSyncSettings;
  activeTimer: ActiveTimer | null;
}

export default class TimeSyncPlugin extends Plugin {
  settings: TimeSyncSettings = { ...DEFAULT_SETTINGS };
  activeTimer: ActiveTimer | null = null;
  store!: VaultStore;
  private statusBar!: HTMLElement;
  private stopModalOpen = false;

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

  async persist() {
    const data: PersistedData = { settings: this.settings, activeTimer: this.activeTimer };
    await this.saveData(data);
  }

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
        if (!submitted) this.stopModalOpen = false;
      }
    ).open();
  }

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

  private refreshView() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_TIME_SYNC)) {
      if (leaf.view instanceof TrackerView) void leaf.view.render();
    }
  }

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
