import { App, PluginSettingTab, Setting } from "obsidian";
import { RoundingMode } from "./core/types";
import type TimeSyncPlugin from "./main";

/** Persisted plugin configuration. */
export interface TimeSyncSettings {
  baseFolder: string;
  /** Rounding applied to a session's raw minutes at stop time to produce billed minutes. */
  rounding: RoundingMode;
  /** Rounding applied to a project's accumulated uninvoiced minutes when an invoice is saved. */
  invoiceRounding: RoundingMode;
}

/** Default settings used until the user overrides them (or on first install). */
export const DEFAULT_SETTINGS: TimeSyncSettings = {
  baseFolder: "Time Tracking",
  rounding: "none",
  invoiceRounding: "none",
};

/** Obsidian settings tab for configuring the base vault folder and the two independent rounding modes. */
export class TimeSyncSettingTab extends PluginSettingTab {
  /** Keeps a reference to the owning plugin so each control can mutate `plugin.settings` and persist immediately. */
  constructor(app: App, private plugin: TimeSyncPlugin) {
    super(app, plugin);
  }

  /** Renders the settings UI into `containerEl`, replacing any previous contents. */
  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Base folder")
      .setDesc("Vault folder where project files and daily logs are stored.")
      .addText((t) =>
        t.setValue(this.plugin.settings.baseFolder).onChange(async (v) => {
          this.plugin.settings.baseFolder = v.trim() || DEFAULT_SETTINGS.baseFolder;
          await this.plugin.persist();
        })
      );

    new Setting(containerEl)
      .setName("Round billed time up to")
      .setDesc("Applied per session when you stop the timer. Raw times are always recorded exactly.")
      .addDropdown((d) =>
        d
          .addOption("none", "No rounding")
          .addOption("6", "6 minutes")
          .addOption("15", "15 minutes")
          .addOption("30", "30 minutes")
          .addOption("60", "1 hour")
          .setValue(this.plugin.settings.rounding)
          .onChange(async (v) => {
            this.plugin.settings.rounding = v as RoundingMode;
            await this.plugin.persist();
          })
      );

    new Setting(containerEl)
      .setName("Round invoice totals up to")
      .setDesc("Applied to a project's uninvoiced total when you save an invoice. Lets you log sessions unrounded but round up invoices.")
      .addDropdown((d) =>
        d
          .addOption("none", "No rounding")
          .addOption("6", "6 minutes")
          .addOption("15", "15 minutes")
          .addOption("30", "30 minutes")
          .addOption("60", "1 hour")
          .setValue(this.plugin.settings.invoiceRounding)
          .onChange(async (v) => {
            this.plugin.settings.invoiceRounding = v as RoundingMode;
            await this.plugin.persist();
          })
      );
  }
}
