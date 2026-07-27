import { App, Modal, SuggestModal } from "obsidian";
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
    contentEl.createEl("label", { text: "What did you do?", cls: "time-sync-stop-label" });
    const textarea = contentEl.createEl("textarea", {
      cls: "time-sync-stop-note",
      attr: { placeholder: "Optional session note", rows: "4" },
    });
    textarea.addEventListener("input", () => (this.note = textarea.value));
    const buttons = contentEl.createDiv({ cls: "modal-button-container" });
    const save = buttons.createEl("button", { text: "Save & stop", cls: "mod-cta" });
    save.onclick = () => {
      this.close();
      this.onSubmit(this.note);
    };
    const cancel = buttons.createEl("button", { text: "Cancel (keep running)" });
    cancel.onclick = () => this.close();
    textarea.focus();
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
    const buttons = this.contentEl.createDiv({ cls: "modal-button-container" });
    const confirm = buttons.createEl("button", { text: "Confirm", cls: "mod-cta" });
    confirm.onclick = () => {
      this.close();
      this.onConfirm();
    };
    const cancel = buttons.createEl("button", { text: "Cancel" });
    cancel.onclick = () => this.close();
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
