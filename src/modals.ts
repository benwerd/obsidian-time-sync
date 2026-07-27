import { App, Modal, Setting, SuggestModal } from "obsidian";
import { formatDuration } from "./core/time";

/** Shown on Stop. Cancel leaves the timer running. */
export class StopModal extends Modal {
  private note = "";

  constructor(
    app: App,
    private project: string,
    private rawMinutes: number,
    private billedMinutes: number,
    private onSubmit: (note: string) => void,
    private onDismiss?: () => void
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: `Stop timer — ${this.project}` });
    contentEl.createEl("p", {
      text: `Raw: ${formatDuration(this.rawMinutes)} · Billed: ${formatDuration(this.billedMinutes)}`,
    });
    new Setting(contentEl).setName("What did you do?").addTextArea((t) => {
      t.setPlaceholder("Optional session note");
      t.onChange((v) => (this.note = v));
      t.inputEl.rows = 4;
    });
    new Setting(contentEl)
      .addButton((b) =>
        b.setButtonText("Save & stop").setCta().onClick(() => {
          this.close();
          this.onSubmit(this.note);
        })
      )
      .addButton((b) => b.setButtonText("Cancel (keep running)").onClick(() => this.close()));
  }

  onClose() {
    this.contentEl.empty();
    this.onDismiss?.();
  }
}

export class ConfirmModal extends Modal {
  constructor(
    app: App,
    private message: string,
    private onConfirm: () => void,
    private onDismiss?: () => void
  ) {
    super(app);
  }

  onOpen() {
    this.contentEl.createEl("p", { text: this.message });
    new Setting(this.contentEl)
      .addButton((b) =>
        b.setButtonText("Confirm").setCta().onClick(() => {
          this.close();
          this.onConfirm();
        })
      )
      .addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()));
  }

  onClose() {
    this.contentEl.empty();
    this.onDismiss?.();
  }
}

/** Project picker for the "Start timer" command. Typing a new name offers to create it. */
export class StartTimerModal extends SuggestModal<string> {
  constructor(app: App, private projects: string[], private onChoose: (name: string) => void) {
    super(app);
    this.setPlaceholder("Project name (type to create a new one)");
  }

  getSuggestions(query: string): string[] {
    const q = query.trim().toLowerCase();
    const matches = this.projects.filter((p) => p.toLowerCase().includes(q));
    if (q && !this.projects.some((p) => p.toLowerCase() === q)) {
      matches.push(query.trim());
    }
    return matches;
  }

  renderSuggestion(value: string, el: HTMLElement) {
    el.setText(this.projects.includes(value) ? value : `Create "${value}"`);
  }

  onChooseSuggestion(value: string) {
    this.onChoose(value);
  }
}
