/* ========================================================================== */
/*  桌面端 KV 收纳层：把 localStorage 全量镜像到 exe 同级 data\kv.json          */
/*                                                                            */
/*  · Electron 下（gwNative.kvRead 存在）用磁盘 backed 的 Storage 替换           */
/*    window.localStorage，所有既有 localStorage 调用点无需改动即自动落盘        */
/*  · 首次运行把分区 localStorage 旧数据一次性迁入 kv.json                     */
/*  · 浏览器局域网端不存在 gwNative，原样使用真实 localStorage（行为不变）       */
/*  · 写入经 300ms 防抖整体落盘，退出（beforeunload）时强制刷盘                  */
/* ========================================================================== */

interface KvNative {
  kvRead?: () => Promise<Record<string, string> | null>;
  kvWrite?: (obj: Record<string, string>) => Promise<boolean>;
}

const KV_DEBOUNCE = 300;

let store: Record<string, string> = {};
let nativeKv: KvNative | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flushNow(): void {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  nativeKv?.kvWrite?.({ ...store })?.catch(() => undefined);
}

function scheduleFlush(): void {
  if (!nativeKv) return;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flushNow, KV_DEBOUNCE);
}

const shim = {
  get length(): number { return Object.keys(store).length; },
  clear(): void { store = {}; scheduleFlush(); },
  getItem(key: string): string | null {
    return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
  },
  key(index: number): string | null {
    return Object.keys(store)[index] ?? null;
  },
  removeItem(key: string): void {
    delete store[key];
    scheduleFlush();
  },
  setItem(key: string, value: string): void {
    store[key] = String(value);
    scheduleFlush();
  },
} as unknown as Storage;

export async function initKvShim(): Promise<void> {
  const n = (typeof window !== "undefined"
    ? (window as unknown as { gwNative?: KvNative }).gwNative
    : undefined) ?? null;
  if (!n?.kvRead) return; /* 浏览器端：不接管 */
  nativeKv = n;
  try {
    const disk = await n.kvRead();
    if (disk && Object.keys(disk).length > 0) {
      store = { ...disk };
    } else {
      const legacy: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) legacy[k] = localStorage.getItem(k) ?? "";
      }
      store = legacy;
      scheduleFlush();
    }
  } catch { store = {}; }
  try { Object.defineProperty(window, "localStorage", { value: shim, configurable: true }); } catch { /* 无法替换则维持真实 localStorage */ }
  window.addEventListener("beforeunload", flushNow);
}
