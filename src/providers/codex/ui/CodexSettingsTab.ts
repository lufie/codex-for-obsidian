import * as fs from 'fs';
import { Setting } from 'obsidian';

import type { ProviderSettingsTabRenderer } from '../../../core/providers/types';
import { renderEnvironmentSettingsSection } from '../../../features/settings/ui/EnvironmentSettingsSection';
import { t } from '../../../i18n/i18n';
import { getHostnameKey, parseEnvironmentVariables } from '../../../utils/env';
import { expandHomePath } from '../../../utils/path';
import { isWindowsStyleCliReference } from '../runtime/CodexBinaryLocator';
import { getCodexProviderSettings, updateCodexProviderSettings } from '../settings';

function createAdvancedSettingsSection(
  title: string,
  description: string,
): { detailsEl: HTMLDetailsElement; contentEl: HTMLElement } {
  const detailsEl = document.createElement('details');
  detailsEl.addClass('claudian-sp-advanced-section');
  detailsEl.createEl('summary', {
    text: title,
    cls: 'claudian-sp-advanced-summary',
  });
  detailsEl.createEl('p', {
    text: description,
    cls: 'setting-item-description',
  });
  const contentEl = detailsEl.createDiv({ cls: 'claudian-settings-advanced-content' });
  return { detailsEl, contentEl };
}

function upsertEnvVar(envText: string, key: string, value: string): string {
  const nextLines = envText
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith(`${key}=`));
  const trimmed = value.trim();
  if (trimmed) {
    nextLines.unshift(`${key}=${trimmed}`);
  }
  return nextLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export const codexSettingsTabRenderer: ProviderSettingsTabRenderer = {
  render(container, context) {
    const settingsBag = context.plugin.settings as unknown as Record<string, unknown>;
    const codexSettings = getCodexProviderSettings(settingsBag);
    const hostnameKey = getHostnameKey();
    let installationMethod = codexSettings.installationMethod;
    const externalAdvancedContainer = context.advancedContainer;
    const advancedSection = externalAdvancedContainer
      ? null
      : createAdvancedSettingsSection(
        t('settings.advancedSection.title'),
        t('settings.advancedSection.codexDesc'),
      );
    const advancedContainer = externalAdvancedContainer ?? advancedSection!.contentEl;

    // --- Setup ---

    new Setting(container).setName(t('settings.sections.basic')).setHeading();

    new Setting(container)
      .setName(t('settings.codex.apiKey.name'))
      .setDesc(t('settings.codex.apiKey.desc'))
      .addText((text) => {
        const currentEnvText = context.plugin.getEnvironmentVariablesForScope('provider:codex');
        let pendingValue = parseEnvironmentVariables(currentEnvText).OPENAI_API_KEY ?? '';

        text
          .setPlaceholder('sk-...')
          .setValue(pendingValue)
          .onChange((value) => {
            pendingValue = value;
          });
        text.inputEl.type = 'password';
        text.inputEl.addEventListener('blur', async () => {
          const latestEnvText = context.plugin.getEnvironmentVariablesForScope('provider:codex');
          const nextEnvText = upsertEnvVar(latestEnvText, 'OPENAI_API_KEY', pendingValue);
          await context.plugin.applyEnvironmentVariables('provider:codex', nextEnvText);
        });
      });

    new Setting(advancedContainer)
      .setName(t('settings.codex.installationMethod.name'))
      .setDesc(t('settings.codex.installationMethod.desc'))
      .addDropdown((dropdown) => {
        dropdown
          .addOption('native-windows', t('settings.codex.installationMethod.nativeWindows'))
          .addOption('wsl', t('settings.codex.installationMethod.wsl'))
          .setValue(installationMethod)
          .onChange(async (value) => {
            installationMethod = value === 'wsl' ? 'wsl' : 'native-windows';
            updateCodexProviderSettings(settingsBag, { installationMethod });
            refreshInstallationMethodUI();
            await context.plugin.saveSettings();
          });
      });

    const getCliPathCopy = (): { desc: string; placeholder: string } => {
      if (installationMethod === 'wsl') {
        return {
          desc: t('settings.codex.cliPath.descWsl'),
          placeholder: t('settings.codex.cliPath.placeholderWsl'),
        };
      }

      return {
        desc: t('settings.codex.cliPath.descNative'),
        placeholder: t('settings.codex.cliPath.placeholderNative'),
      };
    };

    const shouldValidateCliPathAsFile = (): boolean => installationMethod !== 'wsl';

    const cliPathSetting = new Setting(container)
      .setName(t('settings.codex.cliPath.name', { hostname: hostnameKey }))
      .setDesc(t('settings.codex.cliPath.desc'));

    const validationEl = container.createDiv({ cls: 'claudian-cli-path-validation' });
    validationEl.style.color = 'var(--text-error)';
    validationEl.style.fontSize = '0.85em';
    validationEl.style.marginTop = '-0.5em';
    validationEl.style.marginBottom = '0.5em';
    validationEl.style.display = 'none';

    const validatePath = (value: string): string | null => {
      const trimmed = value.trim();
      if (!trimmed) return null;

      if (!shouldValidateCliPathAsFile()) {
        if (isWindowsStyleCliReference(trimmed)) {
          return t('settings.codex.cliPath.validation.wslWindowsPath');
        }
        return null;
      }

      const expandedPath = expandHomePath(trimmed);

      if (!fs.existsSync(expandedPath)) {
        return t('settings.cliPath.validation.notExist');
      }
      const stat = fs.statSync(expandedPath);
      if (!stat.isFile()) {
        return t('settings.cliPath.validation.isDirectory');
      }
      return null;
    };

    const updateCliPathValidation = (value: string, inputEl?: HTMLInputElement): boolean => {
      const error = validatePath(value);
      if (error) {
        validationEl.setText(error);
        validationEl.style.display = 'block';
        if (inputEl) {
          inputEl.style.borderColor = 'var(--text-error)';
        }
        return false;
      }

      validationEl.style.display = 'none';
      if (inputEl) {
        inputEl.style.borderColor = '';
      }
      return true;
    };

    const cliPathsByHost = { ...codexSettings.cliPathsByHost };
    let cliPathInputEl: HTMLInputElement | null = null;
    let wslDistroSettingEl: HTMLElement | null = null;
    let wslDistroInputEl: HTMLInputElement | null = null;

    const refreshInstallationMethodUI = (): void => {
      const cliCopy = getCliPathCopy();
      cliPathSetting.setDesc(cliCopy.desc);
      if (cliPathInputEl) {
        cliPathInputEl.placeholder = cliCopy.placeholder;
        updateCliPathValidation(cliPathInputEl.value, cliPathInputEl);
      }
      if (wslDistroSettingEl) {
        wslDistroSettingEl.style.display = installationMethod === 'wsl' ? '' : 'none';
      }
      if (wslDistroInputEl) {
        wslDistroInputEl.disabled = installationMethod !== 'wsl';
      }
    };

    const persistCliPath = async (value: string): Promise<boolean> => {
      const isValid = updateCliPathValidation(value, cliPathInputEl ?? undefined);
      if (!isValid) {
        return false;
      }

      const trimmed = value.trim();
      if (trimmed) {
        cliPathsByHost[hostnameKey] = trimmed;
      } else {
        delete cliPathsByHost[hostnameKey];
      }

      updateCodexProviderSettings(settingsBag, { cliPathsByHost: { ...cliPathsByHost } });
      await context.plugin.saveSettings();
      const view = context.plugin.getView();
      await view?.getTabManager()?.broadcastToAllTabs(
        (service) => Promise.resolve(service.cleanup())
      );
      return true;
    };

    const currentValue = codexSettings.cliPathsByHost[hostnameKey] || '';

    cliPathSetting.addText((text) => {
      text
        .setPlaceholder(getCliPathCopy().placeholder)
        .setValue(currentValue)
        .onChange(async (value) => {
          await persistCliPath(value);
        });
      text.inputEl.addClass('claudian-settings-cli-path-input');
      text.inputEl.style.width = '100%';
      cliPathInputEl = text.inputEl;

      updateCliPathValidation(currentValue, text.inputEl);
    });

    const wslDistroSetting = new Setting(advancedContainer)
      .setName(t('settings.codex.wslDistro.name'))
      .setDesc(t('settings.codex.wslDistro.desc'));

    wslDistroSettingEl = wslDistroSetting.settingEl;
    wslDistroSetting.addText((text) => {
      text
        .setPlaceholder('Ubuntu')
        .setValue(codexSettings.wslDistroOverride)
        .onChange(async (value) => {
          updateCodexProviderSettings(settingsBag, { wslDistroOverride: value });
          await context.plugin.saveSettings();
        });

      text.inputEl.addClass('claudian-settings-cli-path-input');
      text.inputEl.style.width = '100%';
      text.inputEl.disabled = installationMethod !== 'wsl';
      wslDistroInputEl = text.inputEl;
    });

    refreshInstallationMethodUI();

    // --- Safety ---

    new Setting(container)
      .setName(t('settings.codex.safeMode.name'))
      .setDesc(t('settings.codex.safeMode.desc'))
      .addDropdown((dropdown) => {
        dropdown
          .addOption('workspace-write', t('settings.codex.safeMode.workspaceWrite'))
          .addOption('read-only', t('settings.codex.safeMode.readOnly'))
          .setValue(codexSettings.safeMode)
          .onChange(async (value) => {
            updateCodexProviderSettings(
              settingsBag,
              { safeMode: value as 'workspace-write' | 'read-only' },
            );
            await context.plugin.saveSettings();
          });
      });

    // --- Models ---

    new Setting(container).setName(t('settings.sections.common')).setHeading();

    const SUMMARY_OPTIONS: { value: string; label: string }[] = [
      { value: 'auto', label: t('settings.codex.reasoningSummary.options.auto') },
      { value: 'concise', label: t('settings.codex.reasoningSummary.options.concise') },
      { value: 'detailed', label: t('settings.codex.reasoningSummary.options.detailed') },
      { value: 'none', label: t('settings.codex.reasoningSummary.options.none') },
    ];

    new Setting(container)
      .setName(t('settings.codex.reasoningSummary.name'))
      .setDesc(t('settings.codex.reasoningSummary.desc'))
      .addDropdown((dropdown) => {
        for (const opt of SUMMARY_OPTIONS) {
          dropdown.addOption(opt.value, opt.label);
        }
        dropdown.setValue(codexSettings.reasoningSummary);
        dropdown.onChange(async (value) => {
          updateCodexProviderSettings(
            settingsBag,
            { reasoningSummary: value as 'auto' | 'concise' | 'detailed' | 'none' },
          );
          await context.plugin.saveSettings();
        });
      });

    // --- Environment ---

    renderEnvironmentSettingsSection({
      container: advancedContainer,
      plugin: context.plugin,
      scope: 'provider:codex',
      heading: t('settings.environment'),
      name: t('settings.codex.environment.name'),
      desc: t('settings.codex.environment.desc'),
      placeholder: t('settings.codex.environment.placeholder'),
      renderCustomContextLimits: (target) => context.renderCustomContextLimits(target, 'codex'),
    });

    if (advancedSection) {
      container.appendChild(advancedSection.detailsEl);
    }
  },
};
