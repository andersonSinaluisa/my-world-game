/**
 * Scene transition sequence (HU-GAME-050 RN-1, SCENE_SYSTEM §4). Pure orchestration with injected
 * timing so it is tested without the renderer: fade out → flush → enter → preload (≤ 1.5 s) → fade in →
 * unlock. The overlay only reads `phase`.
 */
export type TransitionPhase = 'idle' | 'out' | 'loading' | 'in';

export const FADE_MS = 300;
/** A load longer than this shows the wordless loading animation (RN-3). */
export const LOADING_INDICATOR_MS = 600;
/** Texture preload waits at most this long; the rest fades in later (RN-6). */
export const PRELOAD_TIMEOUT_MS = 1500;

export interface TravelRequest {
  sceneId: string;
  spawnId: string;
  travelers: string[];
}

export interface TransitionDeps {
  wait(ms: number): Promise<void>;
  flush(): Promise<void>;
  /** Dispatches enterScene; false when the engine refused it. */
  enter(request: TravelRequest): boolean;
  /** Visible textures of the new scene (resolves when loaded). */
  preload(): Promise<void>;
  /** Dispatches transitionDone. */
  done(): void;
  now(): number;
  onError?(error: unknown): void;
}

type Listener = () => void;

export class TransitionDirector {
  private current: TransitionPhase = 'idle';
  private target: string | undefined;
  private loadingSince: number | undefined;
  private readonly listeners = new Set<Listener>();

  constructor(private readonly deps: TransitionDeps) {}

  get phase(): TransitionPhase {
    return this.current;
  }

  /** Scene being entered (for the fade color). */
  get targetSceneId(): string | undefined {
    return this.target;
  }

  /** Time spent loading so far; the overlay shows the indicator past LOADING_INDICATOR_MS. */
  loadingMs(): number {
    return this.loadingSince === undefined ? 0 : this.deps.now() - this.loadingSince;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async run(request: TravelRequest): Promise<void> {
    this.target = request.sceneId;
    try {
      this.set('out');
      await this.deps.wait(FADE_MS);
      await this.deps.flush().catch((e) => this.deps.onError?.(e));
      this.loadingSince = this.deps.now();
      this.set('loading');
      if (this.deps.enter(request)) {
        await Promise.race([this.deps.preload().catch(() => undefined), this.deps.wait(PRELOAD_TIMEOUT_MS)]);
      }
      this.loadingSince = undefined;
      this.set('in');
      await this.deps.wait(FADE_MS);
    } catch (error) {
      this.deps.onError?.(error);
    } finally {
      this.loadingSince = undefined;
      this.target = undefined;
      this.set('idle');
      this.deps.done();
    }
  }

  private set(phase: TransitionPhase): void {
    this.current = phase;
    for (const l of this.listeners) l();
  }
}
