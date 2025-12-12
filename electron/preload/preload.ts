import { contextBridge, ipcRenderer } from 'electron';
import type { IpcChannel, IpcRequest, IpcResponse } from '../../src/types/ipc';

const validChannels: IpcChannel[] = [
  'media:search',
  'media:get',
  'media:recent',
  'torrent:search',
  'torrent:search-episode',
  'debrid:authenticate',
  'debrid:status',
  'debrid:resolve-magnet',
  'debrid:get-stream-url',
  'debrid:delete-transfer',
  'library:get-all',
  'library:add',
  'library:remove',
  'library:toggle-favorite',
  'progress:get',
  'progress:update',
  'progress:get-continue-watching',
  'settings:get',
  'settings:update',
  'provider:get-all',
  'provider:get',
  'provider:update',
  'provider:enable',
];

function isValidChannel(channel: string): channel is IpcChannel {
  return validChannels.includes(channel as IpcChannel);
}

const api = {
  invoke: async <T extends IpcChannel>(
    channel: T,
    data?: IpcRequest<T>
  ): Promise<IpcResponse<T>> => {
    if (!isValidChannel(channel)) {
      throw new Error(`Invalid IPC channel: ${channel}`);
    }

    try {
      return await ipcRenderer.invoke(channel, data);
    } catch (error) {
      console.error(`[Preload] IPC error on channel ${channel}:`, error);
      throw error;
    }
  },

  on: <T extends IpcChannel>(
    channel: T,
    callback: (data: IpcResponse<T>) => void
  ): (() => void) => {
    if (!isValidChannel(channel)) {
      throw new Error(`Invalid IPC channel: ${channel}`);
    }

    const subscription = (_event: Electron.IpcRendererEvent, data: IpcResponse<T>) => {
      callback(data);
    };

    ipcRenderer.on(channel, subscription);

    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },

  getVersion: (): string => {
    return process.versions.electron || 'unknown';
  },

  getPlatform: (): NodeJS.Platform => {
    return process.platform;
  },
};

contextBridge.exposeInMainWorld('electron', api);

export type ElectronAPI = typeof api;
