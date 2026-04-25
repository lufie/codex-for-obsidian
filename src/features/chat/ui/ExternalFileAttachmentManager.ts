import type { App } from 'obsidian';
import { Notice, setIcon } from 'obsidian';
import * as path from 'path';

import { t } from '../../../i18n/i18n';
import { encodeInlineReferenceToken, extractInlineReferenceTokens } from '../../../utils/inlineReferences';
import { getVaultPath, normalizePathForVault } from '../../../utils/path';

/** Maximum size for attached files (10 MB). */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Supported file extensions for preview icons. */
const FILE_TYPE_ICONS: Record<string, string> = {
  // Documents
  '.pdf': 'file-text',
  '.doc': 'file-text',
  '.docx': 'file-text',
  '.txt': 'file-text',
  '.md': 'file-text',
  // Spreadsheets
  '.xls': 'table',
  '.xlsx': 'table',
  '.csv': 'table',
  // Code
  '.js': 'file-code',
  '.ts': 'file-code',
  '.py': 'file-code',
  '.json': 'file-code',
  '.html': 'file-code',
  '.css': 'file-code',
  // Images (already handled by ImageContextManager, but listed for completeness)
  '.jpg': 'image',
  '.jpeg': 'image',
  '.png': 'image',
  '.gif': 'image',
  '.webp': 'image',
  // Archives
  '.zip': 'archive',
  '.tar': 'archive',
  '.gz': 'archive',
  // Default
  'default': 'file',
};

export interface ExternalFileAttachment {
  /** Absolute filesystem path. */
  path: string;
  /** Display name (filename). */
  name: string;
  /** File size in bytes. */
  size: number;
  /** True when the attachment is a directory reference. */
  isDirectory: boolean;
}

export interface ExternalFileAttachmentCallbacks {
  onAttachmentsChanged: () => void;
  onInlineReferenceInserted?: (filePath: string) => void;
  onInlineReferenceRemoved?: (filePath: string) => void;
  onInlineReferencesCleared?: () => void;
}

export class ExternalFileAttachmentManager {
  private callbacks: ExternalFileAttachmentCallbacks;
  private containerEl: HTMLElement;
  private inputEl: HTMLTextAreaElement;
  private chipsContainerEl: HTMLElement;
  private pinnedChipsEl: HTMLElement | null = null;
  private dropOverlayEl: HTMLElement | null = null;
  private attachedFiles: Map<string, ExternalFileAttachment> = new Map();
  private vaultPath: string | null = null;
  private draggedAttachmentPath: string | null = null;

  private app: App | null = null;

  constructor(
    containerEl: HTMLElement,
    inputEl: HTMLTextAreaElement,
    chipsContainerEl: HTMLElement,
    callbacks: ExternalFileAttachmentCallbacks,
    app?: App,
    pinnedChipsEl?: HTMLElement,
    messagesWrapperEl?: HTMLElement,
  ) {
    this.containerEl = containerEl;
    this.inputEl = inputEl;
    this.chipsContainerEl = chipsContainerEl;
    this.callbacks = callbacks;
    this.app = app ?? null;
    this.vaultPath = app ? getVaultPath(app) : null;
    this.pinnedChipsEl = pinnedChipsEl ?? null;

    this.setupDragAndDrop(messagesWrapperEl);
    this.renderAll();
  }

  // ============================================
  // Public API
  // ============================================

  /** Cleans up all event listeners and DOM elements. */
  destroy(): void {
    if (this._dropZone) {
      this._dropZone.removeEventListener('dragenter', this.handleDragEnter as unknown as EventListener, true);
      this._dropZone.removeEventListener('dragover', this.handleDragOver as unknown as EventListener, true);
      this._dropZone.removeEventListener('dragleave', this.handleDragLeave as unknown as EventListener, true);
      this._dropZone.removeEventListener('drop', this.handleDrop as unknown as EventListener, true);
    }
    
    this.dropOverlayEl?.remove();
    this.chipsContainerEl.empty();
    this.attachedFiles.clear();
  }

  /** Returns all currently attached file paths. */
  getAttachedPaths(): string[] {
    return Array.from(this.attachedFiles.keys());
  }

  /** Replaces the current attachment order with the provided paths. */
  async setAttachedPaths(paths: string[]): Promise<void> {
    const nextAttachments = new Map<string, ExternalFileAttachment>();

    for (const filePath of paths) {
      const attachment = await this.createAttachment(filePath);
      if (!attachment) {
        continue;
      }

      nextAttachments.set(filePath, attachment);
    }

    this.attachedFiles = nextAttachments;
    this.renderAll();
    this.callbacks.onAttachmentsChanged();
  }

  /** Retains only attachments that still exist in the inline composer. */
  retainAttachedPaths(paths: string[]): void {
    const retained = new Map<string, ExternalFileAttachment>();
    for (const filePath of paths) {
      const attachment = this.attachedFiles.get(filePath);
      if (attachment) {
        retained.set(filePath, attachment);
      }
    }

    this.attachedFiles = retained;
    this.renderAll();
    this.callbacks.onAttachmentsChanged();
  }

  /** Returns whether any files are attached. */
  hasAttachments(): boolean {
    return this.attachedFiles.size > 0;
  }

  /** Clears all attached files. */
  clearAttachments(): void {
    if (this.attachedFiles.size > 0) {
      this.removeInlineReferenceTokens(Array.from(this.attachedFiles.keys()));
    }
    this.attachedFiles.clear();
    this.renderAll();
    this.callbacks.onAttachmentsChanged();
    this.callbacks.onInlineReferencesCleared?.();
  }

  // ============================================
  // Drag & Drop
  // ============================================

  private setupDragAndDrop(messagesWrapperEl?: HTMLElement): void {
    // Drop zone must be tab-scoped; otherwise multiple tabs in the same view will all
    // receive the same drop events (capture phase) and leak attachments across tabs.
    const dropZone = (this.containerEl.closest('.claudian-tab-content') as HTMLElement | null)
      ?? (this.containerEl.closest('.view-content') as HTMLElement | null)
      ?? this.containerEl;
    if (dropZone) {
      this.setupDropOnElement(dropZone);
    }
  }

  private setupDropOnElement(dropZone: HTMLElement): void {
    // Check if dropZone has createDiv (it might not in test environments where it's a raw HTMLElement mock)
    if (typeof dropZone.createDiv !== 'function') {
      return;
    }

    // Drop overlay covers the entire drop zone
    this.dropOverlayEl = dropZone.createDiv({ cls: 'claudian-external-file-drop-overlay' });
    const dropContent = this.dropOverlayEl.createDiv({ cls: 'claudian-drop-content' });
    const dropIcon = dropContent.createDiv({ cls: 'claudian-drop-icon' });
    dropIcon.innerHTML = `
      <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
      </svg>
    `;
    dropContent.createSpan({ text: t('chat.externalFile.dropHint') });

    // Keep a reference to the drop zone for dragleave boundary checks
    this._dropZone = dropZone;

    // Use capture phase to ensure we catch it before Obsidian's default handlers
    dropZone.addEventListener('dragenter', this.handleDragEnter as unknown as EventListener, true);
    dropZone.addEventListener('dragover', this.handleDragOver as unknown as EventListener, true);
    dropZone.addEventListener('dragleave', this.handleDragLeave as unknown as EventListener, true);
    dropZone.addEventListener('drop', this.handleDrop as unknown as EventListener, true);
  }

  private _dropZone: HTMLElement | null = null;

  private handleDragEnter = (e: DragEvent): void => {
    // Show overlay for both OS file drags (Files type) and Obsidian file tree drags (text/plain or internal drag manager)
    // @ts-expect-error Obsidian internal API
    const dragData = this.app?.dragManager?.draggable?.data;
    const isObsidianDrag = !!dragData && (dragData.type === 'file' || dragData.type === 'files');
    const hasFiles = e.dataTransfer?.types.includes('Files') ?? false;
    const hasText = e.dataTransfer?.types.includes('text/plain') ?? false;
    
    if (hasFiles || hasText || isObsidianDrag) {
      e.preventDefault();
      e.stopPropagation();
      this.dropOverlayEl?.addClass('visible');
    }
  }

  private handleDragOver = (e: DragEvent): void => {
    // Check if we should handle this drag over
    // @ts-expect-error Obsidian internal API
    const dragData = this.app?.dragManager?.draggable?.data;
    const isObsidianDrag = !!dragData && (dragData.type === 'file' || dragData.type === 'files');
    const hasFiles = e.dataTransfer?.types.includes('Files') ?? false;
    const hasText = e.dataTransfer?.types.includes('text/plain') ?? false;

    if (!hasFiles && !hasText && !isObsidianDrag) {
      return; // Not a file drag we care about
    }

    e.preventDefault();
    e.stopPropagation();

    // Must set dropEffect to allow dropping in some browsers/environments
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }

  private handleDragLeave = (e: DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();

    const dropZone = this._dropZone;
    if (!dropZone) {
      this.dropOverlayEl?.removeClass('visible');
      return;
    }

    const rect = dropZone.getBoundingClientRect();
    if (
      e.clientX <= rect.left ||
      e.clientX >= rect.right ||
      e.clientY <= rect.top ||
      e.clientY >= rect.bottom
    ) {
      this.dropOverlayEl?.removeClass('visible');
    }
  }

  private handleDrop = async (e: DragEvent): Promise<void> => {
    try {
      let dragData = null;
      try {
        // @ts-expect-error Obsidian internal API
        dragData = this.app?.dragManager?.draggable?.data;
      } catch {
        dragData = null;
      }

      const isObsidianDrag = !!dragData && (dragData.type === 'file' || dragData.type === 'files');
      const hasFiles = e.dataTransfer?.types.includes('Files') ?? false;
      const hasText = e.dataTransfer?.types.includes('text/plain') ?? false;

      if (!hasFiles && !hasText && !isObsidianDrag) {
        return; // Not a file drop we care about
      }

      e.preventDefault();
      e.stopPropagation();
      this.dropOverlayEl?.removeClass('visible');

      // Priority 1: Obsidian file tree drag — uses obsidian's internal drag payload
      if (dragData && dragData.type === 'file' && dragData.file) {
        const absolutePath = path.join(this.vaultPath!, dragData.file.path);
        const added = await this.addFileFromPath(absolutePath);
        if (added || this.attachedFiles.has(absolutePath)) {
          this.insertInlineReference(absolutePath);
          this.renderAll();
          this.callbacks.onAttachmentsChanged();
        }
        return;
      } else if (dragData && dragData.type === 'files' && dragData.files) {
        let addedCount = 0;
        for (const file of dragData.files) {
          const absolutePath = path.join(this.vaultPath!, file.path);
          const added = await this.addFileFromPath(absolutePath);
          if (added || this.attachedFiles.has(absolutePath)) {
            this.insertInlineReference(absolutePath);
            addedCount++;
          }
        }
        if (addedCount > 0) {
          this.renderAll();
          this.callbacks.onAttachmentsChanged();
        }
        return;
      }

      // Priority 1.5: Obsidian file tree drag — uses text/plain with vault-relative paths
      const plainText = e.dataTransfer?.getData('text/plain');
      if (plainText) {
        const processed = this.processVaultDrop(plainText);
        if (processed.vaultLinks.length > 0) {
          let addedCount = 0;
          for (const link of processed.vaultLinks) {
            const absolutePath = path.join(this.vaultPath!, link.vaultPath);
            const added = await this.addFileFromPath(absolutePath);
            if (added || this.attachedFiles.has(absolutePath)) {
              this.insertInlineReference(absolutePath);
              addedCount++;
            }
          }
          if (addedCount > 0) {
            this.renderAll();
            this.callbacks.onAttachmentsChanged();
          }
          return;
        }
      }

      // Priority 2: Standard file drag from OS file explorer
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) {
        return;
      }

      let addedCount = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Electron File objects expose a non-standard `path` property
        const filePath = (file as File & { path?: string }).path ?? file.name;
        const added = await this.addFileFromPath(filePath, file.size);
        if (added || this.attachedFiles.has(filePath)) {
          this.insertInlineReference(filePath);
          addedCount++;
        }
      }

      if (addedCount > 0) {
        this.renderAll();
        this.callbacks.onAttachmentsChanged();
      }
    } catch {
      new Notice(t('chat.externalFile.pickerError'));
    }
  }

  /**
   * Processes text dropped from the Obsidian file tree.
   * Returns resolved vault link entries.
   */
  private processVaultDrop(
    text: string,
  ): { vaultLinks: Array<{ vaultPath: string; name: string }> } {
    if (!text || !this.vaultPath) return { vaultLinks: [] };

    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const links: Array<{ vaultPath: string; name: string }> = [];

    for (const line of lines) {
      // Skip lines that look like URLs
      if (line.startsWith('http://') || line.startsWith('https://')) continue;

      const obsidianOpenFile = this.parseObsidianOpenUrlFileParam(line);
      const candidate = obsidianOpenFile ?? line;

      // Try to resolve as vault-relative path
      const normalized = normalizePathForVault(candidate, this.vaultPath);
      if (normalized) {
        const relative = normalized.replace(/\\/g, '/').replace(/\/$/, '');
        const name = relative.split('/').pop() ?? relative;
        links.push({ vaultPath: normalized, name });
      }
    }

    return { vaultLinks: links };
  }

  private parseObsidianOpenUrlFileParam(input: string): string | null {
    const trimmed = input.trim();
    const lowered = trimmed.toLowerCase();

    const openPrefix = 'obsidian://open?';
    const altOpenPrefix = 'open?';

    let query: string;
    if (lowered.startsWith(openPrefix)) {
      query = trimmed.slice(openPrefix.length);
    } else if (lowered.startsWith(altOpenPrefix)) {
      query = trimmed.slice(altOpenPrefix.length);
    } else if (trimmed.includes('vault=') && (trimmed.includes('&file=') || trimmed.includes('file='))) {
      const idx = trimmed.indexOf('?');
      query = idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
    } else {
      return null;
    }

    try {
      const params = new URLSearchParams(query);
      const file = params.get('file') ?? params.get('path');
      if (!file) return null;
      return decodeURIComponent(file);
    } catch {
      return null;
    }
  }

  // ============================================
  // File Picker (Electron dialog)
  // ============================================

  /** Opens native file picker dialog (files + folders). */
  async openFilePicker(): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { remote } = require('electron');
      const result = await remote.dialog.showOpenDialog({
        properties: [
          'openFile',
          'openDirectory',
          'multiSelections',
          'noResolveAliases',
        ],
        title: t('chat.externalFile.pickerTitle'),
        filters: [
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (result.canceled || result.filePaths.length === 0) return;

      let addedCount = 0;
      for (const filePath of result.filePaths) {
        const added = await this.addFileFromPath(filePath);
        if (added || this.attachedFiles.has(filePath)) {
          this.insertInlineReference(filePath);
          addedCount++;
        }
      }

      if (addedCount > 0) {
        this.renderAll();
        this.callbacks.onAttachmentsChanged();
      }
    } catch {
      new Notice(t('chat.externalFile.pickerError'));
    }
  }

  // ============================================
  // File Management
  // ============================================

  private async addFileFromPath(filePath: string, size?: number): Promise<boolean> {
    if (this.attachedFiles.has(filePath)) {
      return false;
    }

    const attachment = await this.createAttachment(filePath, size);
    if (!attachment) {
      return false;
    }

    this.attachedFiles.set(filePath, attachment);

    return true;
  }

  private async createAttachment(filePath: string, size?: number): Promise<ExternalFileAttachment | null> {
    const stats = await this.getFileStats(filePath);
    const isDirectory = stats?.isDirectory() ?? false;
    const fileSize = size ?? stats?.size ?? 0;
    const name = path.basename(filePath);

    if (!isDirectory && fileSize > MAX_FILE_SIZE) {
      new Notice(
        `${t('chat.externalFile.fileTooLarge')}: ${name} (${this.formatSize(MAX_FILE_SIZE)} max)`,
        4000
      );
      return null;
    }

    return {
      path: filePath,
      name,
      size: fileSize,
      isDirectory,
    };
  }

  private async getFileStats(filePath: string): Promise<{ size: number; isDirectory(): boolean } | null> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs');
      return fs.statSync(filePath);
    } catch {
      return null;
    }
  }

  private removeFile(filePath: string): void {
    if (!this.attachedFiles.has(filePath)) return;
    this.attachedFiles.delete(filePath);
    this.removeInlineReferenceTokens([filePath]);
    this.renderAll();
    this.callbacks.onAttachmentsChanged();
    this.callbacks.onInlineReferenceRemoved?.(filePath);
  }

  // ============================================
  // External File Chips
  // ============================================

  private renderAll(): void {
    this.renderExternalChips();
  }

  private renderExternalChips(): void {
    const container = this.chipsContainerEl;
    if (!container) return;

    // Find or create the external files chip area
    let externalChipsEl = container.querySelector('.claudian-external-files-chips') as HTMLElement | null;
    if (!externalChipsEl) {
      externalChipsEl = container.createDiv({ cls: 'claudian-external-files-chips' });
      // Insert at the end of context row
      container.appendChild(externalChipsEl);
    }

    externalChipsEl.empty();

    // Inline composer now renders references inside the input text flow.
    externalChipsEl.style.display = 'none';
  }

  private renderFileChip(parent: HTMLElement, filePath: string, attachment: ExternalFileAttachment): void {
    const chipEl = parent.createDiv({ cls: 'claudian-external-file-chip' });
    chipEl.setAttribute('title', filePath);
    chipEl.draggable = true;
    chipEl.dataset.externalAttachmentPath = filePath;

    chipEl.addEventListener('dragstart', (e) => {
      this.draggedAttachmentPath = filePath;
      chipEl.addClass('is-dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', attachment.name);
      }
    });

    chipEl.addEventListener('dragend', () => {
      this.draggedAttachmentPath = null;
      chipEl.removeClass('is-dragging');
      parent.querySelectorAll('.claudian-external-file-chip').forEach((element) => {
        element.removeClass('is-drop-target-before');
        element.removeClass('is-drop-target-after');
      });
    });

    chipEl.addEventListener('dragover', (e) => {
      if (!this.draggedAttachmentPath || this.draggedAttachmentPath === filePath) {
        return;
      }

      e.preventDefault();

      const rect = chipEl.getBoundingClientRect();
      const isBefore = e.clientX < rect.left + rect.width / 2;
      chipEl.toggleClass('is-drop-target-before', isBefore);
      chipEl.toggleClass('is-drop-target-after', !isBefore);
    });

    chipEl.addEventListener('dragleave', () => {
      chipEl.removeClass('is-drop-target-before');
      chipEl.removeClass('is-drop-target-after');
    });

    chipEl.addEventListener('drop', (e) => {
      const sourcePath = this.draggedAttachmentPath;
      if (!sourcePath || sourcePath === filePath) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const rect = chipEl.getBoundingClientRect();
      const insertBefore = e.clientX < rect.left + rect.width / 2;
      this.moveAttachment(sourcePath, filePath, insertBefore);
    });

    // Dynamic icon based on file extension
    const iconEl = chipEl.createSpan({ cls: 'claudian-external-file-icon' });
    const ext = path.extname(filePath).toLowerCase();
    const iconName = attachment.isDirectory
      ? 'folder'
      : (FILE_TYPE_ICONS[ext] || FILE_TYPE_ICONS['default']);
    setIcon(iconEl, iconName);

    // File name
    const nameEl = chipEl.createSpan({ cls: 'claudian-external-file-name' });
    nameEl.setText(attachment.name);

    // Remove button
    const removeEl = chipEl.createSpan({
      cls: 'claudian-external-file-remove',
      attr: { 'aria-label': t('common.remove') },
    });
    removeEl.setText('\u00D7');

    removeEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.removeFile(filePath);
    });

    // Tooltip with full path on hover
    chipEl.setAttribute('title', filePath);
  }

  private moveAttachment(sourcePath: string, targetPath: string, insertBefore: boolean): void {
    const orderedEntries = Array.from(this.attachedFiles.entries());
    const sourceIndex = orderedEntries.findIndex(([filePath]) => filePath === sourcePath);
    const targetIndex = orderedEntries.findIndex(([filePath]) => filePath === targetPath);

    if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
      return;
    }

    const [sourceEntry] = orderedEntries.splice(sourceIndex, 1);
    const adjustedTargetIndex = orderedEntries.findIndex(([filePath]) => filePath === targetPath);
    const insertIndex = insertBefore ? adjustedTargetIndex : adjustedTargetIndex + 1;
    orderedEntries.splice(insertIndex, 0, sourceEntry);

    this.attachedFiles = new Map(orderedEntries);
    this.renderAll();
    this.callbacks.onAttachmentsChanged();
  }
  
  private insertInlineReference(filePath: string): void {
    const token = encodeInlineReferenceToken(filePath);
    const value = this.inputEl.value;
    const start = this.inputEl.selectionStart ?? value.length;
    const end = this.inputEl.selectionEnd ?? value.length;
    const needsLeadingSpace = start > 0 && !/\s/.test(value[start - 1]);
    const needsTrailingSpace = end < value.length && !/\s/.test(value[end] ?? '');
    const insertion = `${needsLeadingSpace ? ' ' : ''}${token}${needsTrailingSpace ? ' ' : ''}`;

    this.inputEl.value = `${value.slice(0, start)}${insertion}${value.slice(end)}`;
    const nextCursor = start + insertion.length;
    this.inputEl.selectionStart = nextCursor;
    this.inputEl.selectionEnd = nextCursor;
    this.inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    this.inputEl.focus();
    this.callbacks.onInlineReferenceInserted?.(filePath);
  }

  private removeInlineReferenceTokens(filePaths: string[]): void {
    if (!filePaths.length) {
      return;
    }

    const filePathSet = new Set(filePaths);
    let nextValue = '';
    let cursor = 0;
    const references = extractInlineReferenceTokens(this.inputEl.value);

    for (const reference of references) {
      if (reference.start > cursor) {
        nextValue += this.inputEl.value.slice(cursor, reference.start);
      }

      if (!filePathSet.has(reference.path)) {
        nextValue += reference.raw;
      }

      cursor = reference.end;
    }

    nextValue += this.inputEl.value.slice(cursor);
    this.inputEl.value = nextValue.replace(/\s{2,}/g, ' ');
    this.inputEl.dispatchEvent(new Event('input', { bubbles: true }));
  }

  

  // ============================================
  // Utilities
  // ============================================

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
