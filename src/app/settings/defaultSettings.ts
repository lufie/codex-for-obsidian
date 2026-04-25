import { getDefaultHiddenProviderCommands } from '../../core/providers/commands/hiddenCommands';
import { type ClaudianSettings } from '../../core/types/settings';
import { DEFAULT_CODEX_PROVIDER_SETTINGS } from '../../providers/codex/settings';

export const DEFAULT_CLAUDIAN_SETTINGS: ClaudianSettings = {
  userName: '',

  permissionMode: 'yolo',

  model: 'gpt-5.4',
  thinkingBudget: 'off',
  effortLevel: 'medium',
  serviceTier: 'default',
  enableAutoTitleGeneration: true,
  titleGenerationModel: '',

  excludedTags: [],
  mediaFolder: '',
  systemPrompt: '',
  persistentExternalContextPaths: [],

  sharedEnvironmentVariables: '',
  envSnippets: [],
  customContextLimits: {},

  keyboardNavigation: {
    scrollUpKey: 'w',
    scrollDownKey: 's',
    focusInputKey: 'i',
  },

  locale: 'zh-CN',

  providerConfigs: {
    codex: { ...DEFAULT_CODEX_PROVIDER_SETTINGS },
  },

  settingsProvider: 'codex',
  savedProviderModel: { codex: 'gpt-5.4' },
  savedProviderEffort: { codex: 'medium' },
  savedProviderServiceTier: {},
  savedProviderThinkingBudget: {},

  lastCustomModel: '',

  maxTabs: 3,
  tabBarPosition: 'input',
  enableAutoScroll: true,
  openInMainTab: false,

  hiddenProviderCommands: getDefaultHiddenProviderCommands(),
};
