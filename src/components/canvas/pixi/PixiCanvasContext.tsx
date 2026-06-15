import { createContext, useContext } from 'react';

export interface PixiCanvasAPI {
  screenToWorld: (clientX: number, clientY: number) => { x: number; y: number };
  hitTestAt: (clientX: number, clientY: number) => string | null;
  hitTestEdgeAt: (clientX: number, clientY: number) => string | null;
  panTo: (worldX: number, worldY: number) => void;
}

const PixiCanvasContext = createContext<PixiCanvasAPI | null>(null);

export const PixiCanvasProvider = PixiCanvasContext.Provider;

export function usePixiCanvas(): PixiCanvasAPI | null {
  return useContext(PixiCanvasContext);
}
