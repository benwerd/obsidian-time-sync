import { App, Modal, SuggestModal } from "obsidian";
import { formatDuration, formatHours } from "./core/time";

/** Shown on Stop. Cancel leaves the timer running. */
export class StopModal extends Modal {
  private note = "";

  /**
   * @param onSubmit - called with the trimmed note when the user saves; the caller records the session.
   * @param onDismiss - called on close whether or not the user saved, so the caller can re-enable its trigger control.
   */
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

  /** Builds the modal's content: raw/billed duration summary, an optional note field, and Save/Cancel buttons. */
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

  /** Clears the modal's DOM and notifies the caller (used to re-enable the triggering control) regardless of Save or Cancel. */
  onClose() {
    this.contentEl.empty();
    this.onDismiss?.();
  }
}

/** Shown when saving an invoice. Collects an optional note; Cancel changes nothing. */
export class InvoiceModal extends Modal {
  private note = "";

  /**
   * @param onSubmit - called with the trimmed note when the user saves; the caller persists the invoice.
   * @param onDismiss - called on close whether or not the user saved, so the caller can re-enable its trigger control.
   */
  constructor(
    app: App,
    private project: string,
    private sessionsTotalMinutes: number,
    private invoicedMinutes: number,
    private onSubmit: (note: string) => void,
    private onDismiss?: () => void
  ) {
    super(app);
  }

  /** Builds the modal's content: an explanation of what saving an invoice does, the rounded/unrounded totals, a note field, and Save/Cancel buttons. */
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: `Save an invoice for ${this.project}?` });
    contentEl.createEl("p", {
      text: "Time Sync doesn't create the invoice document itself — it saves the totals and context you'll need when you write one.",
    });
    const rounded =
      this.invoicedMinutes !== this.sessionsTotalMinutes
        ? ` (${formatHours(this.sessionsTotalMinutes)} of billed sessions, rounded up per your invoice rounding setting)`
        : "";
    contentEl.createEl("p", {
      text: `This records ${formatHours(this.invoicedMinutes)}${rounded} in ${this.project}'s Invoices table and resets its uninvoiced total to zero, so new sessions count toward your next invoice.`,
    });
    contentEl.createEl("label", { text: "Notes for this invoice", cls: "time-sync-stop-label" });
    const textarea = contentEl.createEl("textarea", {
      cls: "time-sync-stop-note",
      attr: { placeholder: "Optional — invoice number, period covered, where you sent it…", rows: "3" },
    });
    textarea.addEventListener("input", () => (this.note = textarea.value));
    const buttons = contentEl.createDiv({ cls: "modal-button-container" });
    const save = buttons.createEl("button", { text: "Save invoice and reset totals", cls: "mod-cta" });
    save.onclick = () => {
      this.close();
      this.onSubmit(this.note);
    };
    const cancel = buttons.createEl("button", { text: "Cancel" });
    cancel.onclick = () => this.close();
    textarea.focus();
  }

  /** Clears the modal's DOM and notifies the caller (used to re-enable the triggering control) regardless of Save or Cancel. */
  onClose() {
    this.contentEl.empty();
    this.onDismiss?.();
  }
}

/** Project picker for the "Start timer" command. Typing a new name offers to create it. */
export class StartTimerModal extends SuggestModal<string> {
  /** @param onChoose - called with the chosen (or freshly typed) project name; the name is not yet sanitized. */
  constructor(app: App, private projects: string[], private onChoose: (name: string) => void) {
    super(app);
    this.setPlaceholder("Project name (type to create a new one)");
  }

  /** Filters known projects by substring match on `query`; if `query` doesn't match an existing project exactly, appends it as a "create new" suggestion. */
  getSuggestions(query: string): string[] {
    const q = query.trim().toLowerCase();
    const matches = this.projects.filter((p) => p.toLowerCase().includes(q));
    if (q && !this.projects.some((p) => p.toLowerCase() === q)) {
      matches.push(query.trim());
    }
    return matches;
  }

  /** Renders a suggestion, labeling new (not-yet-existing) project names as "Create ..." to distinguish them from existing ones. */
  renderSuggestion(value: string, el: HTMLElement) {
    el.setText(this.projects.includes(value) ? value : `Create "${value}"`);
  }

  /** SuggestModal hook invoked when the user picks (or submits) a suggestion. */
  onChooseSuggestion(value: string) {
    this.onChoose(value);
  }
}
