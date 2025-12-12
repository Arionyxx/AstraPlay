import { z } from 'zod';
import type { MediaItem, Episode, WatchProgress, LibraryItem } from './media';
import type { TorrentResult, DebridTransfer, ProviderAccount, ProviderConfig, ProviderStatus } from './provider';
import type { UserSettings } from './settings';

export const MediaSearchSchema = z.object({
  query: z.string().min(1),
  year: z.number().optional(),
  type: z.enum(['movie', 'series', 'anime']).optional(),
});

export const EpisodeSearchSchema = z.object({
  seriesName: z.string().min(1),
  season: z.number().min(1),
  episode: z.number().min(1),
});

export const MagnetResolveSchema = z.object({
  magnetUri: z.string().startsWith('magnet:'),
  providerId: z.string(),
});

export const TransferStatusSchema = z.object({
  transferId: z.string(),
  providerId: z.string(),
});

export const StreamUrlSchema = z.object({
  transferId: z.string(),
  fileId: z.string().optional(),
  providerId: z.string(),
});

export const ProviderAuthSchema = z.object({
  providerId: z.string(),
  apiKey: z.string().optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
});

export const WatchProgressSchema = z.object({
  mediaId: z.string(),
  episodeId: z.string().optional(),
  progress: z.number().min(0),
  duration: z.number().min(0),
  completed: z.boolean(),
});

export interface IpcChannels {
  'media:search': {
    request: z.infer<typeof MediaSearchSchema>;
    response: MediaItem[];
  };
  'media:get': {
    request: { id: string };
    response: MediaItem | null;
  };
  'media:recent': {
    request: { limit: number };
    response: MediaItem[];
  };
  'torrent:search': {
    request: z.infer<typeof MediaSearchSchema>;
    response: TorrentResult[];
  };
  'torrent:search-episode': {
    request: z.infer<typeof EpisodeSearchSchema>;
    response: TorrentResult[];
  };
  'debrid:authenticate': {
    request: z.infer<typeof ProviderAuthSchema>;
    response: ProviderAccount;
  };
  'debrid:status': {
    request: { providerId: string };
    response: ProviderStatus;
  };
  'debrid:resolve-magnet': {
    request: z.infer<typeof MagnetResolveSchema>;
    response: DebridTransfer;
  };
  'debrid:get-stream-url': {
    request: z.infer<typeof StreamUrlSchema>;
    response: string;
  };
  'debrid:delete-transfer': {
    request: z.infer<typeof TransferStatusSchema>;
    response: void;
  };
  'library:get-all': {
    request: void;
    response: LibraryItem[];
  };
  'library:add': {
    request: { mediaId: string };
    response: LibraryItem;
  };
  'library:remove': {
    request: { id: string };
    response: void;
  };
  'library:toggle-favorite': {
    request: { id: string };
    response: LibraryItem;
  };
  'progress:get': {
    request: { mediaId: string; episodeId?: string };
    response: WatchProgress | null;
  };
  'progress:update': {
    request: z.infer<typeof WatchProgressSchema>;
    response: WatchProgress;
  };
  'progress:get-continue-watching': {
    request: { limit: number };
    response: Array<WatchProgress & { media: MediaItem; episode?: Episode }>;
  };
  'settings:get': {
    request: void;
    response: UserSettings;
  };
  'settings:update': {
    request: Partial<UserSettings>;
    response: UserSettings;
  };
  'provider:get-all': {
    request: void;
    response: ProviderConfig[];
  };
  'provider:get': {
    request: { providerId: string };
    response: ProviderConfig | null;
  };
  'provider:update': {
    request: { providerId: string; config: Partial<ProviderConfig> };
    response: ProviderConfig;
  };
  'provider:enable': {
    request: { providerId: string; enabled: boolean };
    response: ProviderConfig;
  };
}

export type IpcChannel = keyof IpcChannels;
export type IpcRequest<T extends IpcChannel> = IpcChannels[T]['request'];
export type IpcResponse<T extends IpcChannel> = IpcChannels[T]['response'];
