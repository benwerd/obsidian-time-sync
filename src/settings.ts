import { App, PluginSettingTab, Setting } from "obsidian";
import { RoundingMode } from "./core/types";
import type TimeSyncPlugin from "./main";

export interface TimeSyncSettings {
  baseFolder: string;
  rounding: RoundingMode;
  invoiceRounding: RoundingMode;
  dailyLog: boolean;
}

export const DEFAULT_SETTINGS: TimeSyncSettings = {
  baseFolder: "Time Tracking",
  rounding: "none",
  invoiceRounding: "none",
  dailyLog: true,
};

export class TimeSyncSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: TimeSyncPlugin) {
    super(app, plugin);
  }

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
      .setDesc("Applied to a project's uninvoiced total when you mark an invoice point. Lets you log sessions unrounded but round up invoices.")
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

    new Setting(containerEl)
      .setName("Daily logs")
      .setDesc("Also append each session to Projects/<name>/Daily/YYYY-MM-DD.md.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.dailyLog).onChange(async (v) => {
          this.plugin.settings.dailyLog = v;
          await this.plugin.persist();
        })
      );
  }
}
