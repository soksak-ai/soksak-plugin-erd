// build.mjs(Stage A)가 워커별 IIFE 번들 문자열을 esbuild `define` 으로 주입한다.
// 콜사이트(PixiERDCanvas·Import*Dialog)는 `blobWorker(__ERD_WORKER_EDGE__)` 처럼 쓴다.
declare const __ERD_WORKER_EDGE__: string; // src/workers/edge-render.worker.ts (OffscreenCanvas)
declare const __ERD_WORKER_LAYOUT__: string; // src/workers/layout.worker.ts (dagre)
declare const __ERD_WORKER_MWB__: string; // src/workers/mwb.worker.ts
declare const __ERD_WORKER_IMPORT__: string; // src/workers/import.worker.ts
