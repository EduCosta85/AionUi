/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { act, renderHook } from '@testing-library/react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configService } from '@/common/config/configService';
import { useCompositionInput } from '@/renderer/hooks/chat/useCompositionInput';

type KeyDownOptions = {
  isComposing?: boolean;
  key?: string;
  keyCode?: number;
  shiftKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
};

const createKeyEvent = ({
  isComposing = false,
  key = 'Enter',
  keyCode = key === 'Enter' ? 13 : 0,
  shiftKey = false,
  metaKey = false,
  ctrlKey = false,
}: KeyDownOptions = {}): ReactKeyboardEvent => {
  const nativeEvent = new KeyboardEvent('keydown', { key, shiftKey, metaKey, ctrlKey });

  Object.defineProperty(nativeEvent, 'isComposing', { configurable: true, value: isComposing });
  Object.defineProperty(nativeEvent, 'keyCode', { configurable: true, value: keyCode });

  return {
    key,
    nativeEvent,
    preventDefault: vi.fn(),
    shiftKey,
    metaKey,
    ctrlKey,
  } as unknown as ReactKeyboardEvent;
};

describe('useCompositionInput', () => {
  beforeEach(() => {
    configService.setLocal('input.sendKey', 'enter');
  });

  describe('default mode (bare Enter sends)', () => {
    it('sends on bare Enter', () => {
      const { result } = renderHook(() => useCompositionInput());
      const onEnterPress = vi.fn();
      const handler = result.current.createKeyDownHandler(onEnterPress);
      const event = createKeyEvent();

      handler(event);

      expect(onEnterPress).toHaveBeenCalledTimes(1);
      expect(event.preventDefault).toHaveBeenCalledTimes(1);
    });

    it('does not send on Shift+Enter (newline)', () => {
      const { result } = renderHook(() => useCompositionInput());
      const onEnterPress = vi.fn();
      const handler = result.current.createKeyDownHandler(onEnterPress);

      handler(createKeyEvent({ shiftKey: true }));

      expect(onEnterPress).not.toHaveBeenCalled();
    });

    it('does not send on Cmd+Enter (newline in default mode)', () => {
      const { result } = renderHook(() => useCompositionInput());
      const onEnterPress = vi.fn();
      const handler = result.current.createKeyDownHandler(onEnterPress);

      handler(createKeyEvent({ metaKey: true }));

      expect(onEnterPress).not.toHaveBeenCalled();
    });

    it('does not send on Ctrl+Enter (newline in default mode)', () => {
      const { result } = renderHook(() => useCompositionInput());
      const onEnterPress = vi.fn();
      const handler = result.current.createKeyDownHandler(onEnterPress);

      handler(createKeyEvent({ ctrlKey: true }));

      expect(onEnterPress).not.toHaveBeenCalled();
    });

    it('does not send when Enter is pressed during tracked composition', () => {
      const { result } = renderHook(() => useCompositionInput());
      const onEnterPress = vi.fn();
      const handler = result.current.createKeyDownHandler(onEnterPress);

      act(() => {
        result.current.compositionHandlers.onCompositionStartCapture();
      });
      handler(createKeyEvent());

      expect(onEnterPress).not.toHaveBeenCalled();
    });

    it('does not send when the native keyboard event reports composition', () => {
      const { result } = renderHook(() => useCompositionInput());
      const onEnterPress = vi.fn();
      const handler = result.current.createKeyDownHandler(onEnterPress);

      handler(createKeyEvent({ isComposing: true }));

      expect(onEnterPress).not.toHaveBeenCalled();
    });

    it('does not send when compositionend precedes the IME confirmation keydown (keyCode 229)', () => {
      const { result } = renderHook(() => useCompositionInput());
      const onEnterPress = vi.fn();
      const handler = result.current.createKeyDownHandler(onEnterPress);

      act(() => {
        result.current.compositionHandlers.onCompositionStartCapture();
        result.current.compositionHandlers.onCompositionEndCapture();
      });
      handler(createKeyEvent({ isComposing: false, keyCode: 229 }));

      expect(onEnterPress).not.toHaveBeenCalled();
    });

    it('sends once for Enter after composition has ended', () => {
      const { result } = renderHook(() => useCompositionInput());
      const onEnterPress = vi.fn();
      const handler = result.current.createKeyDownHandler(onEnterPress);

      act(() => {
        result.current.compositionHandlers.onCompositionStartCapture();
        result.current.compositionHandlers.onCompositionEndCapture();
      });
      handler(createKeyEvent());

      expect(onEnterPress).toHaveBeenCalledTimes(1);
    });

    it('preserves existing key interception before normal Enter sends', () => {
      const { result } = renderHook(() => useCompositionInput());
      const onEnterPress = vi.fn();
      const onKeyDownIntercept = vi.fn(() => true);
      const handler = result.current.createKeyDownHandler(onEnterPress, onKeyDownIntercept);

      handler(createKeyEvent());

      expect(onKeyDownIntercept).toHaveBeenCalledTimes(1);
      expect(onEnterPress).not.toHaveBeenCalled();
    });
  });

  describe('modifier mode (Cmd/Ctrl+Enter sends)', () => {
    it('sends on Cmd+Enter with sendKeyModifier param', () => {
      const { result } = renderHook(() => useCompositionInput());
      const onEnterPress = vi.fn();
      const handler = result.current.createKeyDownHandler(onEnterPress, undefined, true);
      const event = createKeyEvent({ metaKey: true });

      handler(event);

      expect(onEnterPress).toHaveBeenCalledTimes(1);
      expect(event.preventDefault).toHaveBeenCalledTimes(1);
    });

    it('sends on Ctrl+Enter with sendKeyModifier param', () => {
      const { result } = renderHook(() => useCompositionInput());
      const onEnterPress = vi.fn();
      const handler = result.current.createKeyDownHandler(onEnterPress, undefined, true);

      handler(createKeyEvent({ ctrlKey: true }));

      expect(onEnterPress).toHaveBeenCalledTimes(1);
    });

    it('respects configService input.sendKey === "modifier" when param is omitted', () => {
      configService.setLocal('input.sendKey', 'modifier');
      const { result } = renderHook(() => useCompositionInput());
      const onEnterPress = vi.fn();
      const handler = result.current.createKeyDownHandler(onEnterPress);

      // Bare enter should not send
      handler(createKeyEvent());
      expect(onEnterPress).not.toHaveBeenCalled();

      // Cmd+Enter should send
      handler(createKeyEvent({ metaKey: true }));
      expect(onEnterPress).toHaveBeenCalledTimes(1);
    });

    it('does not send on bare Enter in modifier mode (newline)', () => {
      const { result } = renderHook(() => useCompositionInput());
      const onEnterPress = vi.fn();
      const handler = result.current.createKeyDownHandler(onEnterPress, undefined, true);

      handler(createKeyEvent());

      expect(onEnterPress).not.toHaveBeenCalled();
    });

    it('does not send on Shift+Cmd+Enter in modifier mode', () => {
      const { result } = renderHook(() => useCompositionInput());
      const onEnterPress = vi.fn();
      const handler = result.current.createKeyDownHandler(onEnterPress, undefined, true);

      handler(createKeyEvent({ shiftKey: true, metaKey: true }));

      expect(onEnterPress).not.toHaveBeenCalled();
    });

    it('interceptor can intercept in modifier mode', () => {
      const { result } = renderHook(() => useCompositionInput());
      const onEnterPress = vi.fn();
      const onKeyDownIntercept = vi.fn(() => true);
      const handler = result.current.createKeyDownHandler(onEnterPress, onKeyDownIntercept, true);

      handler(createKeyEvent({ metaKey: true }));

      expect(onKeyDownIntercept).toHaveBeenCalledTimes(1);
      expect(onEnterPress).not.toHaveBeenCalled();
    });
  });
});
