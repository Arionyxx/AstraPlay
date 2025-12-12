import { ipcMain } from 'electron';
import { DatabaseManager } from '../database/schema';
import { ProviderManager } from '../providers/provider-manager';
import {
  MediaSearchSchema,
  EpisodeSearchSchema,
  MagnetResolveSchema,
  StreamUrlSchema,
  ProviderAuthSchema,
  WatchProgressSchema,
} from '../../src/types/ipc';

const db = DatabaseManager.getInstance().getDb();
const providerManager = ProviderManager.getInstance();

function validateInput<T>(schema: any, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`Validation failed: ${result.error.message}`);
  }
  return result.data;
}

export function registerIpcHandlers(): void {
  ipcMain.handle('torrent:search', async (_, data) => {
    try {
      const validated = validateInput<any>(MediaSearchSchema, data);
      const scrapers = providerManager.getAllScrapers().filter(s => s.enabled);
      
      if (scrapers.length === 0) {
        throw new Error('No scrapers available');
      }

      const results = await Promise.allSettled(
        scrapers.map(scraper => scraper.search(validated.query, validated.type || 'movie'))
      );

      const allResults = results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .flatMap(r => r.value);

      return allResults.sort((a, b) => b.seeders - a.seeders);
    } catch (error) {
      console.error('[IPC] torrent:search error:', error);
      throw error;
    }
  });

  ipcMain.handle('torrent:search-episode', async (_, data) => {
    try {
      const validated = validateInput<any>(EpisodeSearchSchema, data);
      const scrapers = providerManager.getAllScrapers().filter(s => s.enabled);
      
      if (scrapers.length === 0) {
        throw new Error('No scrapers available');
      }

      const results = await Promise.allSettled(
        scrapers.map(scraper => 
          scraper.searchEpisode(validated.seriesName, validated.season, validated.episode)
        )
      );

      const allResults = results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .flatMap(r => r.value);

      return allResults.sort((a, b) => b.seeders - a.seeders);
    } catch (error) {
      console.error('[IPC] torrent:search-episode error:', error);
      throw error;
    }
  });

  ipcMain.handle('debrid:authenticate', async (_, data) => {
    try {
      const validated = validateInput<any>(ProviderAuthSchema, data);
      const provider = providerManager.getDebridProvider(validated.providerId);
      
      if (!provider) {
        throw new Error(`Debrid provider not found: ${validated.providerId}`);
      }

      const account = await provider.authenticate({
        apiKey: validated.apiKey,
        accessToken: validated.accessToken,
        refreshToken: validated.refreshToken,
      });

      db.prepare(`
        INSERT OR REPLACE INTO provider_accounts 
        (id, provider_id, username, email, premium, expires_at, quota_used, quota_limit, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(
        account.id,
        account.providerId,
        account.username || null,
        account.email || null,
        account.premium ? 1 : 0,
        account.expiresAt?.toISOString() || null,
        account.quotaUsed || null,
        account.quotaLimit || null
      );

      return account;
    } catch (error) {
      console.error('[IPC] debrid:authenticate error:', error);
      throw error;
    }
  });

  ipcMain.handle('debrid:status', async (_, data) => {
    try {
      const provider = providerManager.getDebridProvider(data.providerId);
      
      if (!provider) {
        throw new Error(`Debrid provider not found: ${data.providerId}`);
      }

      return await provider.checkStatus();
    } catch (error) {
      console.error('[IPC] debrid:status error:', error);
      throw error;
    }
  });

  ipcMain.handle('debrid:resolve-magnet', async (_, data) => {
    try {
      const validated = validateInput<any>(MagnetResolveSchema, data);
      const provider = providerManager.getDebridProvider(validated.providerId);
      
      if (!provider) {
        throw new Error(`Debrid provider not found: ${validated.providerId}`);
      }

      return await provider.addMagnet(validated.magnetUri);
    } catch (error) {
      console.error('[IPC] debrid:resolve-magnet error:', error);
      throw error;
    }
  });

  ipcMain.handle('debrid:get-stream-url', async (_, data) => {
    try {
      const validated = validateInput<any>(StreamUrlSchema, data);
      const provider = providerManager.getDebridProvider(validated.providerId);
      
      if (!provider) {
        throw new Error(`Debrid provider not found: ${validated.providerId}`);
      }

      return await provider.getStreamUrl(validated.transferId, validated.fileId);
    } catch (error) {
      console.error('[IPC] debrid:get-stream-url error:', error);
      throw error;
    }
  });

  ipcMain.handle('debrid:delete-transfer', async (_, data) => {
    try {
      const provider = providerManager.getDebridProvider(data.providerId);
      
      if (!provider) {
        throw new Error(`Debrid provider not found: ${data.providerId}`);
      }

      await provider.deleteTransfer(data.transferId);
    } catch (error) {
      console.error('[IPC] debrid:delete-transfer error:', error);
      throw error;
    }
  });

  ipcMain.handle('library:get-all', async () => {
    try {
      const items = db.prepare(`
        SELECT 
          l.id, l.media_id, l.added_at, l.favorite, l.notes,
          m.type, m.title, m.year, m.poster_url, m.rating
        FROM library_items l
        JOIN media_items m ON l.media_id = m.id
        ORDER BY l.added_at DESC
      `).all() as any[];

      return items.map(item => ({
        id: item.id,
        mediaId: item.media_id,
        addedAt: new Date(item.added_at),
        favorite: item.favorite === 1,
        notes: item.notes,
        media: {
          id: item.media_id,
          type: item.type,
          title: item.title,
          year: item.year,
          posterUrl: item.poster_url,
          rating: item.rating,
        },
      }));
    } catch (error) {
      console.error('[IPC] library:get-all error:', error);
      throw error;
    }
  });

  ipcMain.handle('progress:get-continue-watching', async (_, data) => {
    try {
      const items = db.prepare(`
        SELECT 
          wp.id, wp.media_id, wp.episode_id, wp.progress, wp.duration, 
          wp.completed, wp.last_watched_at,
          m.type, m.title, m.year, m.poster_url,
          e.name as episode_name, e.season_number, e.episode_number
        FROM watch_progress wp
        JOIN media_items m ON wp.media_id = m.id
        LEFT JOIN episodes e ON wp.episode_id = e.id
        WHERE wp.completed = 0 AND wp.progress > 0
        ORDER BY wp.last_watched_at DESC
        LIMIT ?
      `).all(data.limit) as any[];

      return items.map(item => ({
        id: item.id,
        mediaId: item.media_id,
        episodeId: item.episode_id,
        progress: item.progress,
        duration: item.duration,
        completed: item.completed === 1,
        lastWatchedAt: new Date(item.last_watched_at),
        media: {
          id: item.media_id,
          type: item.type,
          title: item.title,
          year: item.year,
          posterUrl: item.poster_url,
        },
        episode: item.episode_id ? {
          id: item.episode_id,
          name: item.episode_name,
          seasonNumber: item.season_number,
          episodeNumber: item.episode_number,
        } : undefined,
      }));
    } catch (error) {
      console.error('[IPC] progress:get-continue-watching error:', error);
      throw error;
    }
  });

  ipcMain.handle('progress:update', async (_, data) => {
    try {
      const validated = validateInput<any>(WatchProgressSchema, data);
      const id = `${validated.mediaId}-${validated.episodeId || 'movie'}`;

      db.prepare(`
        INSERT OR REPLACE INTO watch_progress 
        (id, media_id, episode_id, progress, duration, completed, last_watched_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(
        id,
        validated.mediaId,
        validated.episodeId || null,
        validated.progress,
        validated.duration,
        validated.completed ? 1 : 0
      );

      const result = db.prepare(`
        SELECT * FROM watch_progress WHERE id = ?
      `).get(id) as any;

      return {
        id: result.id,
        mediaId: result.media_id,
        episodeId: result.episode_id,
        progress: result.progress,
        duration: result.duration,
        completed: result.completed === 1,
        lastWatchedAt: new Date(result.last_watched_at),
        createdAt: new Date(result.created_at),
        updatedAt: new Date(result.updated_at),
      };
    } catch (error) {
      console.error('[IPC] progress:update error:', error);
      throw error;
    }
  });

  ipcMain.handle('settings:get', async () => {
    try {
      const settings = db.prepare(`
        SELECT * FROM user_settings WHERE id = 'default'
      `).get() as any;

      return {
        id: settings.id,
        theme: settings.theme,
        language: settings.language,
        autoPlay: settings.auto_play === 1,
        autoPlayNext: settings.auto_play_next === 1,
        skipIntro: settings.skip_intro === 1,
        skipOutro: settings.skip_outro === 1,
        defaultQuality: settings.default_quality,
        subtitleLanguage: settings.subtitle_language,
        subtitleSize: settings.subtitle_size,
        volume: settings.volume,
        downloadPath: settings.download_path,
        enableNotifications: settings.enable_notifications === 1,
        hardwareAcceleration: settings.hardware_acceleration === 1,
        createdAt: new Date(settings.created_at),
        updatedAt: new Date(settings.updated_at),
      };
    } catch (error) {
      console.error('[IPC] settings:get error:', error);
      throw error;
    }
  });

  ipcMain.handle('settings:update', async (_, data) => {
    try {
      const updates: string[] = [];
      const values: any[] = [];

      Object.entries(data).forEach(([key, value]) => {
        const dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        updates.push(`${dbKey} = ?`);
        values.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
      });

      if (updates.length > 0) {
        values.push('default');
        db.prepare(`
          UPDATE user_settings 
          SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(...values);
      }

      const settings = db.prepare(`
        SELECT * FROM user_settings WHERE id = 'default'
      `).get() as any;

      return {
        id: settings.id,
        theme: settings.theme,
        language: settings.language,
        autoPlay: settings.auto_play === 1,
        autoPlayNext: settings.auto_play_next === 1,
        skipIntro: settings.skip_intro === 1,
        skipOutro: settings.skip_outro === 1,
        defaultQuality: settings.default_quality,
        subtitleLanguage: settings.subtitle_language,
        subtitleSize: settings.subtitle_size,
        volume: settings.volume,
        downloadPath: settings.download_path,
        enableNotifications: settings.enable_notifications === 1,
        hardwareAcceleration: settings.hardware_acceleration === 1,
        createdAt: new Date(settings.created_at),
        updatedAt: new Date(settings.updated_at),
      };
    } catch (error) {
      console.error('[IPC] settings:update error:', error);
      throw error;
    }
  });

  ipcMain.handle('provider:get-all', async () => {
    try {
      const configs = db.prepare(`
        SELECT * FROM provider_configs ORDER BY priority DESC
      `).all() as any[];

      return configs.map(config => ({
        id: config.id,
        providerId: config.provider_id,
        enabled: config.enabled === 1,
        priority: config.priority,
        settings: config.settings ? JSON.parse(config.settings) : {},
        credentials: config.credentials ? JSON.parse(config.credentials) : undefined,
        createdAt: new Date(config.created_at),
        updatedAt: new Date(config.updated_at),
      }));
    } catch (error) {
      console.error('[IPC] provider:get-all error:', error);
      throw error;
    }
  });

  console.log('[IPC] All handlers registered');
}
