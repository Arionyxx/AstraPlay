export type ProviderType = 'scraper' | 'debrid' | 'metadata';

export interface Provider {
  id: string;
  name: string;
  type: ProviderType;
  version: string;
  enabled: boolean;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface ScraperProvider extends Provider {
  type: 'scraper';
  search(query: string, mediaType: 'movie' | 'series'): Promise<TorrentResult[]>;
  searchEpisode(seriesName: string, season: number, episode: number): Promise<TorrentResult[]>;
}

export interface DebridProvider extends Provider {
  type: 'debrid';
  account?: ProviderAccount;
  authenticate(credentials: DebridCredentials): Promise<ProviderAccount>;
  checkStatus(): Promise<ProviderStatus>;
  addMagnet(magnetUri: string): Promise<DebridTransfer>;
  getStreamUrl(transferId: string, fileId?: string): Promise<string>;
  deleteTransfer(transferId: string): Promise<void>;
}

export interface MetadataProvider extends Provider {
  type: 'metadata';
  searchMedia(query: string, year?: number): Promise<MediaMetadata[]>;
  getMovieDetails(id: string): Promise<MovieMetadata>;
  getSeriesDetails(id: string): Promise<SeriesMetadata>;
  getSeasonDetails(seriesId: string, seasonNumber: number): Promise<SeasonMetadata>;
}

export interface ProviderAccount {
  id: string;
  providerId: string;
  username?: string;
  email?: string;
  premium: boolean;
  expiresAt?: Date;
  quotaUsed?: number;
  quotaLimit?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DebridCredentials {
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface ProviderStatus {
  online: boolean;
  premium: boolean;
  quotaRemaining?: number;
  quotaLimit?: number;
  expiresAt?: Date;
}

export interface TorrentResult {
  id: string;
  name: string;
  size: number;
  seeders: number;
  leechers: number;
  magnetUri: string;
  infoHash: string;
  uploadDate?: Date;
  quality?: string;
  source?: string;
  providerId: string;
}

export interface DebridTransfer {
  id: string;
  magnetUri: string;
  name: string;
  status: 'queued' | 'downloading' | 'processing' | 'ready' | 'error';
  progress: number;
  files: DebridFile[];
  error?: string;
}

export interface DebridFile {
  id: string;
  name: string;
  size: number;
  streamUrl?: string;
}

export interface MediaMetadata {
  id: string;
  title: string;
  originalTitle?: string;
  year: number;
  type: 'movie' | 'series';
  posterUrl?: string;
  backdropUrl?: string;
  overview?: string;
  rating?: number;
  genres?: string[];
}

export interface MovieMetadata extends MediaMetadata {
  type: 'movie';
  runtime?: number;
  director?: string;
  cast?: Array<{ name: string; character: string; profileUrl?: string }>;
  imdbId?: string;
}

export interface SeriesMetadata extends MediaMetadata {
  type: 'series';
  totalSeasons: number;
  totalEpisodes: number;
  status: 'ongoing' | 'completed' | 'cancelled';
  creators?: string[];
  networks?: string[];
}

export interface SeasonMetadata {
  seasonNumber: number;
  name: string;
  overview?: string;
  posterUrl?: string;
  airDate?: Date;
  episodes: EpisodeMetadata[];
}

export interface EpisodeMetadata {
  episodeNumber: number;
  seasonNumber: number;
  name: string;
  overview?: string;
  stillUrl?: string;
  airDate?: Date;
  runtime?: number;
}

export interface ProviderConfig {
  id: string;
  providerId: string;
  enabled: boolean;
  priority: number;
  settings: Record<string, unknown>;
  credentials?: DebridCredentials;
  createdAt: Date;
  updatedAt: Date;
}
