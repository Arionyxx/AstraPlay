export interface UserSettings {
  id: string;
  theme: 'light' | 'dark' | 'system';
  language: string;
  autoPlay: boolean;
  autoPlayNext: boolean;
  skipIntro: boolean;
  skipOutro: boolean;
  defaultQuality: 'auto' | '1080p' | '720p' | '480p' | '360p';
  subtitleLanguage?: string;
  subtitleSize: 'small' | 'medium' | 'large';
  volume: number;
  downloadPath?: string;
  enableNotifications: boolean;
  hardwareAcceleration: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppConfig {
  version: string;
  dataPath: string;
  cachePath: string;
  downloadPath: string;
  logPath: string;
  firstRun: boolean;
}
