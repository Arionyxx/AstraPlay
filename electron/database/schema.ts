import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

export class DatabaseManager {
  private db: Database.Database;
  private static instance: DatabaseManager;

  private constructor() {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'astraplay.db');
    
    fs.mkdirSync(userDataPath, { recursive: true });
    
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    
    this.initializeSchema();
  }

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  public getDb(): Database.Database {
    return this.db;
  }

  private initializeSchema(): void {
    const version = this.db.pragma('user_version', { simple: true }) as number;
    
    if (version === 0) {
      this.createInitialSchema();
      this.db.pragma('user_version = 1');
    }
    
    this.runMigrations(version);
  }

  private createInitialSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS media_items (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK(type IN ('movie', 'series', 'anime')),
        title TEXT NOT NULL,
        original_title TEXT,
        year INTEGER NOT NULL,
        poster_url TEXT,
        backdrop_url TEXT,
        overview TEXT,
        rating REAL,
        genres TEXT,
        cast TEXT,
        director TEXT,
        runtime INTEGER,
        tmdb_id TEXT,
        imdb_id TEXT,
        total_seasons INTEGER,
        total_episodes INTEGER,
        status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS seasons (
        id TEXT PRIMARY KEY,
        series_id TEXT NOT NULL,
        season_number INTEGER NOT NULL,
        name TEXT NOT NULL,
        overview TEXT,
        poster_url TEXT,
        air_date DATETIME,
        episode_count INTEGER DEFAULT 0,
        FOREIGN KEY (series_id) REFERENCES media_items(id) ON DELETE CASCADE,
        UNIQUE(series_id, season_number)
      );

      CREATE TABLE IF NOT EXISTS episodes (
        id TEXT PRIMARY KEY,
        series_id TEXT NOT NULL,
        season_id TEXT NOT NULL,
        episode_number INTEGER NOT NULL,
        season_number INTEGER NOT NULL,
        name TEXT NOT NULL,
        overview TEXT,
        still_url TEXT,
        air_date DATETIME,
        runtime INTEGER,
        rating REAL,
        FOREIGN KEY (series_id) REFERENCES media_items(id) ON DELETE CASCADE,
        FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
        UNIQUE(series_id, season_number, episode_number)
      );

      CREATE TABLE IF NOT EXISTS watch_progress (
        id TEXT PRIMARY KEY,
        media_id TEXT NOT NULL,
        episode_id TEXT,
        progress REAL NOT NULL DEFAULT 0,
        duration REAL NOT NULL,
        completed INTEGER DEFAULT 0,
        last_watched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (media_id) REFERENCES media_items(id) ON DELETE CASCADE,
        FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE,
        UNIQUE(media_id, episode_id)
      );

      CREATE TABLE IF NOT EXISTS library_items (
        id TEXT PRIMARY KEY,
        media_id TEXT NOT NULL,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        favorite INTEGER DEFAULT 0,
        notes TEXT,
        FOREIGN KEY (media_id) REFERENCES media_items(id) ON DELETE CASCADE,
        UNIQUE(media_id)
      );

      CREATE TABLE IF NOT EXISTS provider_configs (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL UNIQUE,
        enabled INTEGER DEFAULT 1,
        priority INTEGER DEFAULT 0,
        settings TEXT,
        credentials TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS provider_accounts (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL UNIQUE,
        username TEXT,
        email TEXT,
        premium INTEGER DEFAULT 0,
        expires_at DATETIME,
        quota_used INTEGER,
        quota_limit INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (provider_id) REFERENCES provider_configs(provider_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS user_settings (
        id TEXT PRIMARY KEY DEFAULT 'default',
        theme TEXT DEFAULT 'dark',
        language TEXT DEFAULT 'en',
        auto_play INTEGER DEFAULT 1,
        auto_play_next INTEGER DEFAULT 1,
        skip_intro INTEGER DEFAULT 0,
        skip_outro INTEGER DEFAULT 0,
        default_quality TEXT DEFAULT 'auto',
        subtitle_language TEXT,
        subtitle_size TEXT DEFAULT 'medium',
        volume REAL DEFAULT 1.0,
        download_path TEXT,
        enable_notifications INTEGER DEFAULT 1,
        hardware_acceleration INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_media_type ON media_items(type);
      CREATE INDEX idx_media_year ON media_items(year);
      CREATE INDEX idx_media_tmdb ON media_items(tmdb_id);
      CREATE INDEX idx_media_imdb ON media_items(imdb_id);
      CREATE INDEX idx_watch_progress_media ON watch_progress(media_id);
      CREATE INDEX idx_watch_progress_last_watched ON watch_progress(last_watched_at DESC);
      CREATE INDEX idx_library_added ON library_items(added_at DESC);
      CREATE INDEX idx_library_favorite ON library_items(favorite);

      INSERT OR IGNORE INTO user_settings (id) VALUES ('default');
    `);
  }

  private runMigrations(_currentVersion: number): void {
    // Future migrations will go here
    // Example:
    // if (_currentVersion < 2) {
    //   this.db.exec('ALTER TABLE media_items ADD COLUMN new_field TEXT;');
    //   this.db.pragma('user_version = 2');
    // }
  }

  public close(): void {
    this.db.close();
  }
}
