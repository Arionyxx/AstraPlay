export type MediaType = 'movie' | 'series' | 'anime';

export interface MediaItem {
  id: string;
  type: MediaType;
  title: string;
  originalTitle?: string;
  year: number;
  posterUrl?: string;
  backdropUrl?: string;
  overview?: string;
  rating?: number;
  genres?: string[];
  cast?: CastMember[];
  director?: string;
  runtime?: number;
  tmdbId?: string;
  imdbId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Movie extends MediaItem {
  type: 'movie';
}

export interface Series extends MediaItem {
  type: 'series' | 'anime';
  seasons: Season[];
  totalSeasons: number;
  totalEpisodes: number;
  status: 'ongoing' | 'completed' | 'cancelled';
}

export interface Season {
  id: string;
  seriesId: string;
  seasonNumber: number;
  name: string;
  overview?: string;
  posterUrl?: string;
  airDate?: Date;
  episodes: Episode[];
  episodeCount: number;
}

export interface Episode {
  id: string;
  seriesId: string;
  seasonId: string;
  episodeNumber: number;
  seasonNumber: number;
  name: string;
  overview?: string;
  stillUrl?: string;
  airDate?: Date;
  runtime?: number;
  rating?: number;
}

export interface CastMember {
  id: string;
  name: string;
  character?: string;
  profileUrl?: string;
  order?: number;
}

export interface WatchProgress {
  id: string;
  mediaId: string;
  episodeId?: string;
  userId?: string;
  progress: number;
  duration: number;
  completed: boolean;
  lastWatchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface LibraryItem {
  id: string;
  mediaId: string;
  media: MediaItem;
  addedAt: Date;
  favorite: boolean;
  notes?: string;
}
