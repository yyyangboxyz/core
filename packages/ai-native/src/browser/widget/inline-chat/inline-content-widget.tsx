import React from 'react';

import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { IAIInlineChatService } from '@opensumi/ide-core-browser';
import { Emitter, Event } from '@opensumi/ide-core-common';
import {
  BaseInlineContentWidget,
  ShowAIContentOptions,
} from '@opensumi/ide-monaco/lib/browser/ai-native/content-widget';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { AIInlineChatContentWidget } from '../../../common/index';
import { AINativeContextKey } from '../../contextkey/ai-native.contextkey.service';

import { AIInlineChatController } from './inline-chat-controller';
import { AIInlineChatService, EInlineChatStatus } from './inline-chat.service';

import type { ICodeEditor as IMonacoCodeEditor } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';

@Injectable({ multiple: true })
export class AIInlineContentWidget extends BaseInlineContentWidget {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(IAIInlineChatService)
  private aiInlineChatService: AIInlineChatService;

  private readonly aiNativeContextKey: AINativeContextKey;

  private originTop = 0;

  private readonly _onClickActions = new Emitter<string>();
  public readonly onClickActions: Event<string> = this._onClickActions.event;

  constructor(protected readonly editor: IMonacoCodeEditor) {
    super(editor);

    this.aiNativeContextKey = this.injector.get(AINativeContextKey, [(this.editor as any)._contextKeyService]);
    this.addDispose(
      this.editor.onDidLayoutChange(() => {
        if (this.isOutOfArea()) {
          this.dispose();
        }
      }),
    );
  }

  override dispose(): void {
    this.aiInlineChatService.launchChatStatus(EInlineChatStatus.READY);
    super.dispose();
  }

  public renderView(): React.ReactNode {
    return <AIInlineChatController onClickActions={this._onClickActions} onClose={() => this.dispose()} />;
  }

  override async show(options?: ShowAIContentOptions | undefined): Promise<void> {
    super.show(options);
    this.aiNativeContextKey.inlineChatIsVisible.set(true);
  }

  override getDomNode(): HTMLElement {
    const domNode = super.getDomNode();
    domNode.style.padding = '6px';
    domNode.style.zIndex = '999';
    domNode.style.paddingRight = '50px';
    return domNode;
  }

  override async hide(options?: ShowAIContentOptions | undefined): Promise<void> {
    this.aiNativeContextKey.inlineChatIsVisible.set(false);
    super.hide();
  }

  /**
   * 如果编辑器区域宽度小于 270px，则不显示
   * 不包括左侧 content width 和右侧的 minimap width
   */
  private isOutOfArea(): boolean {
    const visibleWidth = 270;
    const contentLeftWith = this.editor.getOption(monaco.editor.EditorOption.layoutInfo).contentLeft;
    const minimapWith = this.editor.getOption(monaco.editor.EditorOption.layoutInfo).minimap.minimapWidth;
    if (this.editor.getLayoutInfo().width - contentLeftWith - minimapWith < visibleWidth) {
      return true;
    }
    return false;
  }

  public setOptions(options: ShowAIContentOptions): void {
    this.options = options;
  }

  public offsetTop(top: number): void {
    if (this.originTop === 0) {
      this.originTop = this.domNode.style.top ? parseInt(this.domNode.style.top, 10) : 0;
    }

    this.domNode.style.top = `${this.originTop + top}px`;
  }

  id(): string {
    return AIInlineChatContentWidget;
  }

  override getPosition(): monaco.editor.IContentWidgetPosition | null {
    const position = super.getPosition();

    if (position) {
      return position;
    }

    if (!this.options) {
      return null;
    }

    const { selection } = this.options;
    return selection ? this.computerPosition(selection) : null;
  }

  private safeGetLineLastNonWhitespaceColumn(line: number) {
    const model = this.editor.getModel();
    return model!.getLineLastNonWhitespaceColumn(Math.min(Math.max(1, line), model!.getLineCount()));
  }

  private toAbovePosition(lineNumber: number, column: number): monaco.editor.IContentWidgetPosition {
    return {
      position: new monaco.Position(lineNumber, column),
      preference: [
        monaco.editor.ContentWidgetPositionPreference.ABOVE,
        monaco.editor.ContentWidgetPositionPreference.BELOW,
      ],
    };
  }

  private toBelowPosition(lineNumber: number, column: number): monaco.editor.IContentWidgetPosition {
    return {
      position: new monaco.Position(lineNumber, column),
      preference: [
        monaco.editor.ContentWidgetPositionPreference.BELOW,
        monaco.editor.ContentWidgetPositionPreference.ABOVE,
      ],
    };
  }

  private recheckPosition(lineNumber: number, column: number): monaco.editor.IContentWidgetPosition {
    const preNonWhitespaceColumn = this.safeGetLineLastNonWhitespaceColumn(lineNumber - 1);
    const curNonWhitespaceColumn = this.safeGetLineLastNonWhitespaceColumn(lineNumber);
    const nextNonWhitespaceColumn = this.safeGetLineLastNonWhitespaceColumn(lineNumber + 1);

    let newPreference = [monaco.editor.ContentWidgetPositionPreference.ABOVE];
    let newLineNumber = lineNumber;
    let newColumn = column;

    if (curNonWhitespaceColumn >= nextNonWhitespaceColumn) {
      newPreference = [monaco.editor.ContentWidgetPositionPreference.BELOW];
    } else if (curNonWhitespaceColumn >= preNonWhitespaceColumn) {
      newPreference = [monaco.editor.ContentWidgetPositionPreference.ABOVE];
    } else {
      newColumn = Math.min(preNonWhitespaceColumn, nextNonWhitespaceColumn);

      if (preNonWhitespaceColumn >= nextNonWhitespaceColumn) {
        newPreference = [monaco.editor.ContentWidgetPositionPreference.BELOW];
        newLineNumber = lineNumber - 1;
      } else {
        newPreference = [monaco.editor.ContentWidgetPositionPreference.ABOVE];
        newLineNumber = lineNumber + 1;
      }
    }

    if (lineNumber === 1 || lineNumber === 2) {
      newPreference = [monaco.editor.ContentWidgetPositionPreference.BELOW];
    }

    return {
      position: new monaco.Position(newLineNumber, newColumn),
      preference: newPreference,
    };
  }

  private isProtrudeAbove(line: number) {
    const currentLastNonWhitespace = this.safeGetLineLastNonWhitespaceColumn(line);
    return (
      currentLastNonWhitespace >= this.safeGetLineLastNonWhitespaceColumn(line - 1) &&
      currentLastNonWhitespace >= this.safeGetLineLastNonWhitespaceColumn(line - 2)
    );
  }

  private isProtrudeBelow(line: number) {
    const currentLastNonWhitespace = this.safeGetLineLastNonWhitespaceColumn(line);
    return (
      currentLastNonWhitespace >= this.safeGetLineLastNonWhitespaceColumn(line + 1) &&
      currentLastNonWhitespace >= this.safeGetLineLastNonWhitespaceColumn(line + 2)
    );
  }

  /**
   * 动态计算要显示的位置
   * 1. 以选区里的光标作为顶点
   * 2. 靠近光标处周围没有字符的空白区域作为要显示的区域
   * 3. 显示的区域方向在右侧，左侧不考虑
   */
  private computerPosition(selection: monaco.Selection): monaco.editor.IContentWidgetPosition | null {
    const startPosition = selection.getStartPosition();
    const endPosition = selection.getEndPosition();
    const model = this.editor.getModel();

    if (!model) {
      return null;
    }

    const cursorPosition = selection.getPosition();
    const getCursorLastNonWhitespaceColumn = this.safeGetLineLastNonWhitespaceColumn(cursorPosition.lineNumber);

    let targetLine: number | null = null;
    let direction: 'above' | 'below' | null = null;

    if (startPosition.lineNumber === endPosition.lineNumber) {
      return this.recheckPosition(cursorPosition.lineNumber, cursorPosition.column);
    }

    if (cursorPosition.equals(startPosition)) {
      const getMaxLastWhitespaceColumn = Math.max(
        this.safeGetLineLastNonWhitespaceColumn(cursorPosition.lineNumber - 1),
        this.safeGetLineLastNonWhitespaceColumn(cursorPosition.lineNumber - 2),
      );

      if (getMaxLastWhitespaceColumn < getCursorLastNonWhitespaceColumn + 10) {
        return this.toAbovePosition(cursorPosition.lineNumber, getMaxLastWhitespaceColumn + 1);
      }

      for (let i = startPosition.lineNumber; i <= endPosition.lineNumber; i++) {
        if (this.isProtrudeAbove(i)) {
          targetLine = i;
          direction = 'above';
          break;
        }
        if (this.isProtrudeBelow(i)) {
          targetLine = i;
          direction = 'below';
          break;
        }
      }
    } else if (cursorPosition.equals(endPosition)) {
      const getMaxLastWhitespaceColumn = Math.max(
        this.safeGetLineLastNonWhitespaceColumn(cursorPosition.lineNumber + 1),
        this.safeGetLineLastNonWhitespaceColumn(cursorPosition.lineNumber + 2),
      );

      if (getMaxLastWhitespaceColumn < getCursorLastNonWhitespaceColumn + 10) {
        return this.toBelowPosition(cursorPosition.lineNumber, getMaxLastWhitespaceColumn + 1);
      }

      for (let i = endPosition.lineNumber; i >= startPosition.lineNumber; i--) {
        if (this.isProtrudeBelow(i)) {
          targetLine = i;
          direction = 'below';
          break;
        }
        if (this.isProtrudeAbove(i)) {
          targetLine = i;
          direction = 'above';
          break;
        }
      }
    }

    if (targetLine && direction) {
      const column = this.safeGetLineLastNonWhitespaceColumn(targetLine) + 1;

      if (direction === 'below') {
        return this.toBelowPosition(targetLine, column);
      }
      return this.toAbovePosition(targetLine, column);
    }

    return this.recheckPosition(
      cursorPosition.lineNumber,
      this.safeGetLineLastNonWhitespaceColumn(cursorPosition.lineNumber),
    );
  }
}
