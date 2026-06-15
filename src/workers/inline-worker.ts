// 번들 플러그인은 단일 ESM(blob-URL)로 적재된다 — `new Worker(new URL('@/workers/X', import.meta.url))`
// 패턴은 import.meta.url 이 blob URL 이라 깨진다. build.mjs(Stage A)가 각 워커를 IIFE 로 standalone
// 번들해 문자열(__ERD_WORKER_*)로 주입하고, 여기서 blob-URL classic worker 로 생성한다.
// OffscreenCanvas transferable 은 classic blob worker 에서도 동일하게 동작한다.
export function blobWorker(code: string): Worker {
  const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
  const w = new Worker(url); // classic(IIFE) — {type:'module'} 불필요
  // 로드 후 즉시 revoke(워커는 이미 코드를 읽었다).
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return w;
}
