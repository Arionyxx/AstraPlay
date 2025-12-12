import axios from 'axios';
import * as cheerio from 'cheerio';
import { BaseProvider } from '../base-provider';
import type { ScraperProvider, TorrentResult } from '../../../src/types/provider';

export class LimeTorrentsScraperProvider extends BaseProvider implements ScraperProvider {
  public readonly type = 'scraper' as const;
  private baseUrl = 'https://www.limetorrents.lol';
  private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

  constructor() {
    super('limetorrents', 'LimeTorrents', 'scraper', '1.0.0');
  }

  async initialize(): Promise<void> {
    this.log('Initializing LimeTorrents scraper');
    this.enabled = true;
  }

  async shutdown(): Promise<void> {
    this.log('Shutting down LimeTorrents scraper');
    this.enabled = false;
  }

  async search(query: string, _mediaType: 'movie' | 'series'): Promise<TorrentResult[]> {
    try {
      const searchQuery = encodeURIComponent(query);
      const url = `${this.baseUrl}/search/all/${searchQuery}/seeds/1/`;

      this.log(`Searching for: ${query}`);

      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.userAgent,
        },
        timeout: 10000,
      });

      return this.parseSearchResults(response.data);
    } catch (error) {
      return this.handleError(error, 'search');
    }
  }

  async searchEpisode(
    seriesName: string,
    season: number,
    episode: number
  ): Promise<TorrentResult[]> {
    try {
      const query = `${seriesName} S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
      return this.search(query, 'series');
    } catch (error) {
      return this.handleError(error, 'searchEpisode');
    }
  }

  private parseSearchResults(html: string): TorrentResult[] {
    const $ = cheerio.load(html);
    const results: TorrentResult[] = [];

    $('.table2 tbody tr').each((_, element) => {
      try {
        const row = $(element);
        const titleElement = row.find('.tt-name a').eq(1);
        const name = titleElement.text().trim();
        
        if (!name) return;

        const torrentLink = row.find('.tt-name a').eq(0).attr('href');
        const sizeText = row.find('.tdnormal').eq(1).text().trim();
        const seedersText = row.find('.tdseed').text().trim();
        const leechersText = row.find('.tdleech').text().trim();
        const dateText = row.find('.tdnormal').eq(0).text().trim();

        const infoHash = this.extractInfoHashFromLink(torrentLink);
        if (!infoHash) return;

        const size = this.parseSize(sizeText);
        const seeders = parseInt(seedersText) || 0;
        const leechers = parseInt(leechersText) || 0;

        const quality = this.extractQuality(name);

        results.push({
          id: infoHash,
          name,
          size,
          seeders,
          leechers,
          magnetUri: this.buildMagnetUri(infoHash, name),
          infoHash,
          uploadDate: this.parseDate(dateText),
          quality,
          source: 'limetorrents',
          providerId: this.id,
        });
      } catch (error) {
        this.warn('Failed to parse result row:', error);
      }
    });

    return results.sort((a, b) => b.seeders - a.seeders);
  }

  private extractInfoHashFromLink(link?: string): string | undefined {
    if (!link) return undefined;
    const match = link.match(/\/([A-F0-9]{40})\//i);
    return match ? match[1].toLowerCase() : undefined;
  }

  private buildMagnetUri(infoHash: string, name: string): string {
    const encodedName = encodeURIComponent(name);
    const trackers = [
      'udp://tracker.opentrackr.org:1337/announce',
      'udp://open.stealth.si:80/announce',
      'udp://tracker.torrent.eu.org:451/announce',
      'udp://tracker.bittor.pw:1337/announce',
      'udp://public.popcorn-tracker.org:6969/announce',
    ];

    const trackerString = trackers.map(t => `&tr=${encodeURIComponent(t)}`).join('');
    return `magnet:?xt=urn:btih:${infoHash}&dn=${encodedName}${trackerString}`;
  }

  private parseSize(sizeText: string): number {
    const match = sizeText.match(/([\d.]+)\s*(GB|MB|KB|TB)/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    const multipliers: Record<string, number> = {
      TB: 1024 ** 4,
      GB: 1024 ** 3,
      MB: 1024 ** 2,
      KB: 1024,
    };

    return value * (multipliers[unit] || 0);
  }

  private parseDate(dateText: string): Date | undefined {
    if (!dateText || dateText === '-') return undefined;
    try {
      return new Date(dateText);
    } catch {
      return undefined;
    }
  }

  private extractQuality(name: string): string | undefined {
    const qualities = ['2160p', '1080p', '720p', '480p', '360p'];
    const nameUpper = name.toUpperCase();
    
    for (const quality of qualities) {
      if (nameUpper.includes(quality.toUpperCase())) {
        return quality;
      }
    }

    if (nameUpper.includes('4K') || nameUpper.includes('UHD')) {
      return '2160p';
    }

    return undefined;
  }
}
