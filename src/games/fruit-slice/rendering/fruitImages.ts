// Real fruit photo assets — preloaded for canvas rendering.

import type { FruitType } from './types';
import appleUrl from '../fruits/apple.jpg';
import bananaUrl from '../fruits/banana.png';
import cherryUrl from '../fruits/cherry.jpg';
import orangeUrl from '../fruits/orange.jpg';
import peachUrl from '../fruits/peach.jpg';

const SOURCES: Record<FruitType, string> = {
  apple: appleUrl,
  banana: bananaUrl,
  cherry: cherryUrl,
  orange: orangeUrl,
  peach: peachUrl,
};

const cache: Partial<Record<FruitType, HTMLImageElement>> = {};
let loadPromise: Promise<void> | null = null;

function loadOne(type: FruitType, url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { cache[type] = img; resolve(); };
    img.onerror = () => reject(new Error(`Failed to load fruit image: ${type}`));
    img.src = url;
  });
}

export function preloadFruitImages(): Promise<void> {
  if (!loadPromise) {
    loadPromise = Promise.all(
      (Object.entries(SOURCES) as [FruitType, string][]).map(([type, url]) => loadOne(type, url)),
    ).then(() => undefined);
  }
  return loadPromise;
}

export function getFruitImage(type: FruitType): HTMLImageElement | undefined {
  return cache[type];
}

export function fruitImagesReady(): boolean {
  return Object.keys(cache).length === Object.keys(SOURCES).length;
}
