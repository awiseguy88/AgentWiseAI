export interface AiHookResult { ok: boolean; message: string; }

export async function tryBackgroundRemoval(): Promise<AiHookResult> {
  // Optional local hook; lazy-loaded models not bundled. Graceful degradation.
  return { ok: false, message: 'Background removal model not available in this build. Core export still works.' };
}

export async function tryUpscale(_factor: number): Promise<AiHookResult> {
  return { ok: false, message: 'Super-resolution model not available in this build. Standard resize applied.' };
}

export function aiHooksAvailable(): boolean {
  return false;
}