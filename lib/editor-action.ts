export interface EditorCapabilityLike {
  available: boolean;
  reason: string;
  fallbackPath?: string | null;
}

export interface EditorOpenLike {
  success: boolean;
  reason: string;
  message: string;
  fallbackPath?: string | null;
  fallbackUsed?: boolean;
}

export type EditorFlowStatus = 'opened' | 'fallback_opened' | 'unavailable' | 'error';

export interface EditorFlowResult<TOpen extends EditorOpenLike = EditorOpenLike> {
  status: EditorFlowStatus;
  message: string;
  probe: EditorCapabilityLike;
  openResult: TOpen | null;
}

export async function runEditorActionFlow<TProbe extends EditorCapabilityLike, TOpen extends EditorOpenLike>(options: {
  probe: () => Promise<TProbe>;
  open: () => Promise<TOpen>;
  fallbackOpen?: (path: string) => Promise<void>;
  unavailableMessage?: string;
}): Promise<EditorFlowResult<TOpen>> {
  const probe = await options.probe();
  const fallbackPath = probe.fallbackPath ?? null;

  if (!probe.available) {
    if (options.fallbackOpen && fallbackPath) {
      await options.fallbackOpen(fallbackPath);
      return {
        status: 'fallback_opened',
        message: options.unavailableMessage ?? 'Editor unavailable, opened fallback path.',
        probe,
        openResult: null,
      };
    }

    return {
      status: 'unavailable',
      message: options.unavailableMessage ?? 'Editor unavailable.',
      probe,
      openResult: null,
    };
  }

  const openResult = await options.open();
  if (openResult.success) {
    return {
      status: openResult.fallbackUsed ? 'fallback_opened' : 'opened',
      message: openResult.message,
      probe,
      openResult,
    };
  }

  const openFallbackPath = openResult.fallbackPath ?? fallbackPath;
  if (options.fallbackOpen && openFallbackPath) {
    await options.fallbackOpen(openFallbackPath);
    return {
      status: 'fallback_opened',
      message: openResult.message,
      probe,
      openResult,
    };
  }

  return {
    status: 'error',
    message: openResult.message,
    probe,
    openResult,
  };
}
