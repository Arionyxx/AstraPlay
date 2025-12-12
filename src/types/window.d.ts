import type { ElectronAPI } from '../../electron/preload/preload';

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

export {};
