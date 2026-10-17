/**
 * ============================================================================
 * PLUGIN: local/auto-continue-v2
 * ============================================================================
 *
 * PURPOSE
 * -------
 * Auto-send "continue" to a session after a transient / retryable error so
 * that long-running (overnight) tasks resume without human intervention.
 *
 * AXIOMS
 * ------
 * A1. OpenCode V2 delivers events typed as `V2Event` to plugins through
 *     `ctx.event.subscribe()`, which returns an AsyncIterable.
 *     [Citation: @opencode/client dist/promise/generated/client.d.ts:186]
 * A2. In V2 the failure events are `session.execution.failed` and
 *     `session.step.failed`; the idle event is `session.idle`. There is NO
 *     `session.error` and NO `message.updated` in the V2Event union — a plugin
 *     that listens for those V1 names NEVER fires.
 *     [Citation: @opencode/client dist/promise/generated/types.d.ts:3354]
 * A3. `ctx.session.prompt({ sessionID, text })` injects a user turn.
 *     [Citation: SessionApi.prompt / SessionPromptInput types.d.ts:5494]
 * A4. Repetition is observable: `session.text.ended` carries the full assistant
 *     text and `session.tool.called` carries the tool input object. Hashing
 *     those payloads to a signature exposes a repeated (looping) action.
 *     [Citation: @opencode/client types.d.ts (SessionTextEnded, SessionToolCalled)]
 * A5. `ctx.session.compact({ sessionID })` requests native context compaction.
 *     [Citation: SessionApi.compact / SessionCompactInput client.d.ts:48]
 *
 * THEORIES
 * --------
 * T1. If a retryable error fires and the session then goes idle, sending
 *     "continue" resumes work. (matches the upstream plugin's intent)
 *     PROOF: session.idle means no execution is in flight; prompt() starts a
 *     new execution. Therefore work resumes.
 * T2. OpenCode V2 has a BUILT-IN retry that emits `session.retry.scheduled`.
 *     When that fires we must NOT also send "continue", or two drivers race
 *     the same session. PROOF: prompt() and the built-in retry both enqueue an
 *     assistant turn; two turns = double-drive.
 * T3. A session that terminally fails may never emit `session.idle`; waiting
 *     for idle alone can therefore drop the continue. PROOF: "failed" is a
 *     terminal execution state; idle is only one possible successor. Therefore
 *     the failure handler also schedules a continue directly.
 * T4. If the same action signature (assistant text or tool input) repeats
 *     >= repeatThreshold times within a window of repeatWindow actions, the
 *     model is stuck in a loop; sending "continue" deepens it. Compaction is
 *     the correct recovery. PROOF: identical input + identical output means the
 *     execution state is a fixed point; only a context change escapes it.
 *
 * APPLICATIONS
 * ------------
 * - session.execution.failed / session.step.failed + matching error
 *     -> mark pending AND schedule a "continue" (T1 + T3).
 * - session.retry.scheduled
 *     -> clear pending; let OpenCode retry itself (T2).
 * - session.execution.interrupted with reason "inactivity"
 *     -> schedule a "continue" (idle-timeout recovery for unattended runs).
 * - session.idle + pending
 *     -> schedule a "continue" (T1).
 * - session.text.ended / session.tool.called whose signature repeats >= N times
 *     -> compact the session (T4) instead of sending "continue".
 *
 * CITATIONS
 * ---------
 * [1] @opencode/client dist/promise/generated/types.d.ts  (V2Event, SessionStructuredError)
 * [2] https://opencode.ai/v2/docs/build/plugins             (plugin lifecycle, ctx surface)
 * [3] @hikae/opencode-auto-continue v2.0.0 src/index.ts     (MIT; logic base, ported)
 * [4] SessionApi.compact / SessionApi.command — client.d.ts (native compaction, fallback command)
 *
 * DEPENDENCY-FREE BY DESIGN: imports only Node builtins, so it loads without
 * resolving `@opencode/plugin` (which is NOT resolvable from the global config
 * dir — verified: `require.resolve('@opencode/plugin')` fails there).
 * ============================================================================
 */

import { promises as fs, appendFileSync, mkdirSync, writeFileSync, statSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ─── Plugin metadata ───────────────────────────────────────────────────────
export const id = "local/auto-continue-v2";

// ─── Minimal local types for the V2 API surface we use ────────────────────
// Kept intentionally small so the plugin has no runtime dependency on
// `@opencode/plugin` or `@opencode/client`.
interface Ctx {
  readonly session: {
    prompt: (input: { sessionID: string; text: string }) => Promise<unknown>;
    /** Native context compaction. [SessionApi.compact] */
    compact?: (input: { sessionID: string }) => Promise<unknown>;
    /** Command dispatch fallback (name "compact"). [SessionApi.command] */
    command?: (input: { sessionID: string; name: string; text: string }) => Promise<unknown>;
  };
  readonly event: {
    subscribe: () => AsyncIterable<Record<string, unknown>>;
  };
  readonly options: Record<string, unknown>;
  readonly app?: { name?: string; version?: string };
}

interface ErrorLike {
  name?: string;
  type?: string;
  data?: { message?: string };
  message?: string;
}

// ─── Default retryable error patterns ──────────────────────────────────────
// Matched case-insensitively against "ErrorName: error message".
const DEFAULT_ERROR_PATTERNS: string[] = [
  "bad request",
  "reasoning_opaque",
  "prefill",
  "SSE read timed out",
  "DecimalError",
  "ContextOverflowError",
  "too large to compact",
  "Invalid diff",
  "Tool execution aborted",
  "JSON parsing failed",
  "Invalid input for tool",
  "tried to call unavailable tool",
  "finding less tool calls",
  "tool_use ids were found without tool_result",
  "ECONNREFUSED",
  "ECONNRESET",
  // upstream / gateway transient failures (the originally reported case)
  "endpoint is unavailable",
  "upstream request failed",
  "service unavailable",
  "bad gateway",
  "idle timeout",
  "no data received",
  "expected string, received undefined",
];

const DEFAULT_EXCLUDE_PATTERNS: string[] = [
  "MessageAbortedError",
  "operation was aborted",
];

interface Config {
  enabled: boolean;
  /** Minimum ms between auto-continues per session. */
  throttleMs: number;
  /** Delay after a trigger before sending "continue". */
  delayMs: number;
  /** Max consecutive auto-continues per session (0 = unlimited). */
  maxConsecutive: number;
  /** Log activity to the server log. */
  debug: boolean;
  errorPatterns: string[];
  excludePatterns: string[];
  /** Detect repetitive behaviour and compact instead of continuing (T4). */
  repetitionDetection: boolean;
  /** Identical signatures within the window that constitute a loop. */
  repeatThreshold: number;
  /** How many recent action signatures are remembered per session. */
  repeatWindow: number;
  /** Minimum ms between compactions per session (loop cooldown). */
  compactCooldownMs: number;
}

const DEFAULTS: Config = {
  enabled: true,
  throttleMs: 5000,
  delayMs: 500,
  maxConsecutive: 5,
  debug: false,
  errorPatterns: DEFAULT_ERROR_PATTERNS,
  excludePatterns: DEFAULT_EXCLUDE_PATTERNS,
  repetitionDetection: true,
  repeatThreshold: 3,
  repeatWindow: 8,
  compactCooldownMs: 120000,
};

function globalConfigPath(): string {
  return join(homedir(), ".config", "opencode", "opencode-auto-continue.jsonc");
}

/** Path of the durable activity log used to verify the plugin is live. */
function logFilePath(): string {
  return join(homedir(), ".config", "opencode", "auto-continue-v2.log");
}

/**
 * flog — append a timestamped line to the durable activity log.
 *
 * AXIOM (Murphy): the plugin's stderr is NOT captured by the server log, so
 * the only trustworthy proof that the plugin is loaded and receiving events is
 * a file it writes itself. Logging failures must never break the plugin.
 *
 * @param msg Human-readable message.
 */
function flog(msg: string): void {
  try {
    appendFileSync(logFilePath(), `${new Date().toISOString()} ${msg}\n`);
  } catch {
    // Never let a logging failure break event handling.
  }
}

/** Directory holding cross-instance continue claims. */
function claimDir(): string {
  return join(homedir(), ".config", "opencode", "auto-continue-locks");
}

/**
 * claim — atomically claim the right to send ONE continue for `key`.
 *
 * AXIOM: opencode loads this plugin MULTIPLE times concurrently (4 live
 * instances were observed with zero disposals). Every instance receives the
 * same event stream, so without a shared arbiter each instance would send its
 * own "continue" and multi-drive the session.
 *
 * THEORY: `writeFileSync(..., { flag: "wx" })` maps to open(O_CREAT|O_EXCL),
 * which is atomic on POSIX. Exactly one contender can create the claim file;
 * the others get EEXIST and skip. Therefore at most one continue is sent per
 * throttle window.
 *
 * A claim older than `ttlMs` is stale (a later real failure may reuse it).
 *
 * @param key    Usually the sessionID.
 * @param ttlMs  How long a claim stays valid.
 * @returns true iff this instance won the claim.
 */
function claim(key: string, ttlMs: number): boolean {
  const dir = claimDir();
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    // Directory may already exist or be unwritable; handled below.
  }
  const file = join(dir, encodeURIComponent(key));
  try {
    const st = statSync(file);
    if (Date.now() - st.mtimeMs > ttlMs) {
      try {
        unlinkSync(file);
      } catch {
        // Another instance may have removed it first; safe to ignore.
      }
    }
  } catch {
    // No existing claim.
  }
  try {
    writeFileSync(file, `${process.pid}:${Date.now()}`, { flag: "wx" });
    return true;
  } catch {
    return false; // Another instance holds the claim.
  }
}

// ─── JSONC parsing (comments + trailing commas) ────────────────────────────
/**
 * parseJsonc — parse a JSON-with-comments document.
 *
 * AXIOM: OpenCode config files use JSONC (line + block comments, trailing
 * commas). `JSON.parse` rejects them, so we strip comments while preserving
 * string contents before parsing.
 *
 * @param text Raw JSONC text.
 * @returns Parsed value.
 * @throws SyntaxError if the cleaned text is not valid JSON (caller catches).
 */
function parseJsonc(text: string): unknown {
  let out = "";
  let inString = false;
  let quote = "";
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inString) {
      if (c === "\\" && i + 1 < text.length) {
        out += c + text[i + 1];
        i += 2;
        continue;
      }
      if (c === quote) inString = false;
      out += c;
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      inString = true;
      quote = c;
      out += c;
      i++;
    } else if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
    } else if (c === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i += 2;
    } else {
      out += c;
      i++;
    }
  }
  out = out.replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(out);
}

/**
 * sanitizeConfig — coerce an untrusted object into a valid Config.
 *
 * AXIOM (Murphy): input may be null, wrong types, or have out-of-range numbers.
 * Every field is validated; invalid fields fall back to DEFAULTS.
 *
 * @param raw Untrusted value (ctx.options or a parsed file).
 * @returns A complete, valid Config.
 */
function sanitizeConfig(raw: unknown): Config {
  const config: Config = { ...DEFAULTS };
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (typeof o.enabled === "boolean") config.enabled = o.enabled;
    if (typeof o.throttleMs === "number" && o.throttleMs >= 0) config.throttleMs = o.throttleMs;
    if (typeof o.delayMs === "number" && o.delayMs >= 0) config.delayMs = o.delayMs;
    if (typeof o.maxConsecutive === "number" && o.maxConsecutive >= 0) config.maxConsecutive = o.maxConsecutive;
    if (typeof o.debug === "boolean") config.debug = o.debug;
    if (Array.isArray(o.errorPatterns))
      config.errorPatterns = o.errorPatterns.filter((p): p is string => typeof p === "string");
    if (Array.isArray(o.excludePatterns))
      config.excludePatterns = o.excludePatterns.filter((p): p is string => typeof p === "string");
    if (typeof o.repetitionDetection === "boolean") config.repetitionDetection = o.repetitionDetection;
    if (typeof o.repeatThreshold === "number" && o.repeatThreshold >= 2) config.repeatThreshold = o.repeatThreshold;
    if (typeof o.repeatWindow === "number" && o.repeatWindow >= 2) config.repeatWindow = o.repeatWindow;
    if (typeof o.compactCooldownMs === "number" && o.compactCooldownMs >= 0) config.compactCooldownMs = o.compactCooldownMs;
  }
  return config;
}

/**
 * readConfigFile — read and sanitize the global auto-continue config.
 *
 * AXIOM (Murphy): the file may be missing, unreadable, or malformed. All
 * failures are caught and reported as `null` so the plugin still runs on
 * defaults rather than crashing the server.
 *
 * @returns Parsed Config, or null if the file is absent/unreadable/invalid.
 */
async function readConfigFile(): Promise<Config | null> {
  try {
    const raw = await fs.readFile(globalConfigPath(), "utf-8");
    return sanitizeConfig(parseJsonc(raw));
  } catch {
    return null;
  }
}

/**
 * isRetryableError — decide whether an error should trigger auto-continue.
 *
 * AXIOMS: V2 errors are `SessionStructuredError = { type, message, status?,
 * response? }`; older shapes use `name`/`data.message`. We build a lowercase
 * "name: message" haystack and test excludes first, then includes.
 *
 * @param error Untrusted error value from the event payload.
 * @param config Active config (patterns).
 * @returns true iff a non-excluded errorPattern is found.
 */
function isRetryableError(error: unknown, config: Config): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as ErrorLike;
  const name =
    (typeof err.name === "string" ? err.name : null) ??
    (typeof err.type === "string" ? err.type : "");
  const message =
    (typeof err.data?.message === "string" ? err.data.message : null) ??
    (typeof err.message === "string" ? err.message : "");
  const matchStr = `${name}: ${message}`.toLowerCase();
  for (const pattern of config.excludePatterns) {
    if (matchStr.includes(pattern.toLowerCase())) return false;
  }
  for (const pattern of config.errorPatterns) {
    if (matchStr.includes(pattern.toLowerCase())) return true;
  }
  return false;
}

/**
 * errorMessage — best-effort human-readable text for logging.
 * @param error Untrusted error value.
 * @returns A non-empty string, never undefined.
 */
function errorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "unknown";
  const err = error as ErrorLike;
  return err.data?.message ?? err.message ?? err.name ?? err.type ?? "unknown";
}

// ─── Repetition detection helpers (T4) ─────────────────────────────────────
/**
 * signatureOf — stable 32-bit FNV-1a hash of an action payload.
 *
 * AXIOM: a repetition loop is only visible if equal actions map to equal
 * signatures. FNV-1a is dependency-free, fast, and stable across runs.
 * [Reference: FNV hash — http://www.isthe.com/chongo/tech/comp/fnv/]
 *
 * @param kind    Category ("text" | "tool") to avoid cross-kind collisions.
 * @param payload Normalized payload text.
 * @returns Hex signature string.
 */
function signatureOf(kind: string, payload: string): string {
  let h = 0x811c9dc5;
  const s = `${kind}\u0000${payload}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

/**
 * safeJson — JSON.stringify that never throws (cycles, BigInt, functions).
 *
 * AXIOM (Murphy): tool input is untrusted and may be non-serializable. A
 * stringify throw must not break the event loop.
 *
 * @param value Arbitrary value.
 * @returns A string; never throws.
 */
function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

interface SessionState {
  lastContinueTime: number;
  consecutiveCount: number;
  pendingContinue: boolean;
  /** True while a continue timer is armed, to prevent duplicate timers. */
  scheduled: boolean;
  /** Rolling window of recent action signatures (newest last). */
  recentSignatures: string[];
  /** Timestamp of the last compaction, for the loop cooldown. */
  lastCompactTime: number;
  /** True while a compact timer is armed, to prevent duplicate timers. */
  compactScheduled: boolean;
}

/**
 * setup — plugin entry point.
 *
 * AXIOMS: runs once at load; may return a cleanup function run on unload.
 * @param ctx OpenCode V2 plugin context (event + session domains).
 * @returns Cleanup function that stops timers and the event loop.
 */
export async function setup(ctx: Ctx): Promise<() => void> {
  // Precedence: explicit config entry options > global config file > defaults.
  let config: Config = sanitizeConfig(ctx.options);
  const initial = await readConfigFile();
  if (initial) config = { ...config, ...initial };
  let lastReload = 0;

  /**
   * reloadFileIfStale — re-read the config file at most once per 5s so edits
   * take effect without a restart. Failures keep the previous config.
   */
  async function reloadFileIfStale(): Promise<void> {
    const now = Date.now();
    if (now - lastReload < 5000) return;
    lastReload = now;
    const file = await readConfigFile();
    if (!file) return;
    config = { ...sanitizeConfig(ctx.options), ...file };
  }

  const sessions = new Map<string, SessionState>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let disposed = false;
  let sawFirstEvent = false;
  // Distinguishes concurrent plugin instances so we can detect multi-loading.
  const instanceId = Math.random().toString(36).slice(2, 8);

  /** log — write a diagnostic line to stderr (routed to the server log). */
  function log(msg: string): void {
    if (config.debug) {
      process.stderr.write(`[auto-continue-v2] ${msg}\n`);
    }
  }

  /** getState — fetch or lazily create per-session state. */
  function getState(sessionID: string): SessionState {
    let s = sessions.get(sessionID);
    if (!s) {
      s = {
        lastContinueTime: 0,
        consecutiveCount: 0,
        pendingContinue: false,
        scheduled: false,
        recentSignatures: [],
        lastCompactTime: 0,
        compactScheduled: false,
      };
      sessions.set(sessionID, s);
    }
    return s;
  }

  /** clearTimers — cancel every armed continue timer (used on unload). */
  function clearTimers(): void {
    for (const t of timers) clearTimeout(t);
    timers.clear();
  }

  /**
   * sendContinue — deliver one "continue" turn, honoring throttle/limits.
   *
   * AXIOMS: enabled gates all sending; throttleMs spaces sends; maxConsecutive
   * (0 = unlimited) caps consecutive retries.
   * @param sessionID Target session.
   */
  async function sendContinue(sessionID: string): Promise<void> {
    const state = getState(sessionID);
    const now = Date.now();

    if (!config.enabled) {
      state.pendingContinue = false;
      return;
    }
    if (now - state.lastContinueTime < config.throttleMs) {
      // Too soon — re-arm for the remaining throttle window (once).
      if (!state.pendingContinue || state.scheduled) return;
      const remaining = config.throttleMs - (now - state.lastContinueTime);
      state.scheduled = true;
      const timer = setTimeout(() => {
        timers.delete(timer);
        state.scheduled = false;
        void sendContinue(sessionID);
      }, remaining);
      timers.add(timer);
      return;
    }
    if (config.maxConsecutive !== 0 && state.consecutiveCount >= config.maxConsecutive) {
      log(`giving up on ${sessionID}: reached max ${config.maxConsecutive} consecutive retries`);
      state.pendingContinue = false;
      return;
    }

    // Cross-instance arbitration: opencode loads this plugin several times
    // concurrently (4 instances observed), so only one may send per window.
    if (!claim(sessionID, config.throttleMs)) {
      log(`another instance already sent continue for ${sessionID}; skipping`);
      flog(`skip continue for ${sessionID}: claimed by another instance`);
      state.pendingContinue = false;
      return;
    }

    state.pendingContinue = false;
    state.lastContinueTime = Date.now();
    state.consecutiveCount += 1;
    const attempt = state.consecutiveCount;
    log(`sending "continue" to ${sessionID} (attempt ${attempt})`);
    flog(`sending continue to ${sessionID} (attempt ${attempt})`);
    try {
      await ctx.session.prompt({ sessionID, text: "continue" });
      log(`sent "continue" to ${sessionID}`);
      flog(`sent continue to ${sessionID}`);
    } catch (err) {
      state.pendingContinue = false;
      log(`failed to send "continue" to ${sessionID}: ${String(err)}`);
    }
  }

  /**
   * scheduleContinue — arm a single continue timer for a session.
   *
   * AXIOM: at most one timer per session may be armed at a time; the `scheduled`
   * flag enforces this so the failure path and the idle path cannot double-fire.
   * @param sessionID Target session.
   */
  function scheduleContinue(sessionID: string): void {
    const state = getState(sessionID);
    if (!state.pendingContinue || state.scheduled) return;
    state.scheduled = true;
    const timer = setTimeout(() => {
      timers.delete(timer);
      state.scheduled = false;
      void sendContinue(sessionID);
    }, config.delayMs);
    timers.add(timer);
  }

  /**
   * sendCompact — request native compaction to break a repetition loop (T4).
   *
   * AXIOM (Murphy): the V2 host may not expose `compact`; fall back to the
   * "compact" command, then log the failure. The cross-instance claim prevents
   * the concurrent plugin instances from all compacting at once.
   *
   * @param sessionID Target session.
   */
  async function sendCompact(sessionID: string): Promise<void> {
    const state = getState(sessionID);
    if (!config.enabled) return;
    if (!claim(`compact:${sessionID}`, config.compactCooldownMs)) {
      flog(`skip compact for ${sessionID}: claimed by another instance`);
      return;
    }
    state.lastCompactTime = Date.now();
    try {
      if (typeof ctx.session.compact === "function") {
        await ctx.session.compact({ sessionID });
      } else if (typeof ctx.session.command === "function") {
        await ctx.session.command({ sessionID, name: "compact", text: "" });
      } else {
        throw new Error("no compact capability on ctx.session");
      }
      log(`compacted ${sessionID} after repetition`);
      flog(`compacted ${sessionID} after repetition`);
    } catch (err) {
      log(`compact failed for ${sessionID}: ${String(err)}`);
      flog(`compact FAILED for ${sessionID}: ${String(err)}`);
    }
  }

  /**
   * scheduleCompact — arm a single compaction timer for a session.
   *
   * AXIOM: at most one compact timer per session; the cooldown prevents a
   * compaction storm while the context is still shrinking.
   * @param sessionID Target session.
   */
  function scheduleCompact(sessionID: string): void {
    const state = getState(sessionID);
    if (state.compactScheduled) return;
    if (Date.now() - state.lastCompactTime < config.compactCooldownMs) return;
    state.compactScheduled = true;
    const timer = setTimeout(() => {
      timers.delete(timer);
      state.compactScheduled = false;
      void sendCompact(sessionID);
    }, config.delayMs);
    timers.add(timer);
  }

  /**
   * noteSignature — record an action signature and compact on a detected loop.
   *
   * THEORY (T4): if the same signature appears >= repeatThreshold times within
   * a window of repeatWindow actions, the model is stuck; compact the session.
   *
   * @param sessionID Target session.
   * @param kind      "text" | "tool".
   * @param payload   Normalized action payload.
   */
  function noteSignature(sessionID: string, kind: string, payload: string): void {
    if (!config.enabled || !config.repetitionDetection) return;
    const state = getState(sessionID);
    const sig = signatureOf(kind, payload);
    state.recentSignatures.push(sig);
    if (state.recentSignatures.length > config.repeatWindow) state.recentSignatures.shift();
    let count = 0;
    for (const s of state.recentSignatures) if (s === sig) count++;
    if (count >= config.repeatThreshold) {
      log(`repetition detected in ${sessionID} (${kind} x${count}); compacting`);
      flog(`repetition detected in ${sessionID} (${kind} x${count}); triggering compact`);
      state.recentSignatures = [];
      scheduleCompact(sessionID);
    }
  }

  /**
   * handleEvent — dispatch a single V2 event (see AXIOMS/THEORIES header).
   * @param event Untrusted event object from the subscription.
   */
  function handleEvent(event: Record<string, unknown>): void {
    const type = event.type;
    const data = (event.data ?? {}) as Record<string, unknown>;

    // Proof-of-life: the first event of any kind means the subscription works.
    if (!sawFirstEvent) {
      sawFirstEvent = true;
      flog(`first event received: ${String(type)}`);
    }

    // T1+T3: terminal execution/step failure with a retryable error.
    if (type === "session.execution.failed" || type === "session.step.failed") {
      const sessionID = typeof data.sessionID === "string" ? data.sessionID : null;
      if (!sessionID) return;
      const error = data.error;
      if (config.enabled && isRetryableError(error, config)) {
        log(`retryable ${String(type)} in ${sessionID}: ${errorMessage(error)}`);
        getState(sessionID).pendingContinue = true;
        scheduleContinue(sessionID);
      } else {
        log(`non-retryable ${String(type)} in ${sessionID}: ${errorMessage(error)}`);
      }
      return;
    }

    // T2: OpenCode's built-in retry owns this session — do not double-drive.
    if (type === "session.retry.scheduled") {
      const sessionID = typeof data.sessionID === "string" ? data.sessionID : null;
      if (!sessionID) return;
      log(`opencode scheduled retry for ${sessionID} (attempt ${String(data.attempt)}); suppressing auto-continue`);
      const st = sessions.get(sessionID);
      if (st) st.pendingContinue = false;
      return;
    }

    // Idle-timeout recovery for unattended runs.
    if (type === "session.execution.interrupted") {
      const sessionID = typeof data.sessionID === "string" ? data.sessionID : null;
      const reason = data.reason;
      if (sessionID && reason === "inactivity" && config.enabled) {
        log(`session ${sessionID} interrupted for inactivity; scheduling continue`);
        getState(sessionID).pendingContinue = true;
        scheduleContinue(sessionID);
      }
      return;
    }

    // T4: feed assistant text into the repetition window.
    if (type === "session.text.ended") {
      const sessionID = typeof data.sessionID === "string" ? data.sessionID : null;
      if (!sessionID) return;
      const text = typeof data.text === "string" ? data.text : "";
      noteSignature(sessionID, "text", text);
      return;
    }

    // T4: feed tool-call inputs into the repetition window. The V2
    // session.tool.called payload has NO tool-name field, so the input object
    // is the discriminator.
    if (type === "session.tool.called") {
      const sessionID = typeof data.sessionID === "string" ? data.sessionID : null;
      if (!sessionID) return;
      noteSignature(sessionID, "tool", safeJson(data.input));
      return;
    }

    // T1: session went idle with a pending continue.
    if (type === "session.idle") {
      const sessionID = typeof data.sessionID === "string" ? data.sessionID : null;
      if (!sessionID) return;
      void reloadFileIfStale();
      scheduleContinue(sessionID);
      return;
    }
  }

  // ── Event loop ───────────────────────────────────────────────────────────
  // AXIOM (Murphy): the subscription may end or throw. We log and stop
  // cleanly instead of crashing the server.
  (async () => {
    try {
      for await (const event of ctx.event.subscribe()) {
        if (disposed) return;
        try {
          handleEvent(event as Record<string, unknown>);
        } catch (err) {
          log(`handler error: ${String(err)}`);
        }
      }
    } catch (err) {
      if (!disposed) log(`event subscription ended: ${String(err)}`);
    }
  })();

  // Unconditional install markers (stderr + durable file) so the load can be
  // verified even though plugin stderr is not routed to the server log.
  process.stderr.write(`[auto-continue-v2] installed (debug=${config.debug})\n`);
  flog(`installed instance=${instanceId} (debug=${config.debug})`);

  return () => {
    disposed = true;
    clearTimers();
    sessions.clear();
    flog(`disposed instance=${instanceId}`);
  };
}

const plugin = { id, setup };
export default plugin;
