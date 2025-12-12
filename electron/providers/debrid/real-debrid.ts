import axios, { AxiosInstance } from 'axios';
import { BaseProvider } from '../base-provider';
import type {
  DebridProvider,
  DebridCredentials,
  ProviderAccount,
  ProviderStatus,
  DebridTransfer,
  DebridFile,
} from '../../../src/types/provider';

interface RealDebridUser {
  id: number;
  username: string;
  email: string;
  premium: number;
  expiration: string;
}

interface RealDebridTorrent {
  id: string;
  filename: string;
  hash: string;
  bytes: number;
  status: string;
  added: string;
  links: string[];
  ended?: string;
  progress: number;
  files?: Array<{
    id: number;
    path: string;
    bytes: number;
    selected: number;
  }>;
}

interface RealDebridUnrestrict {
  id: string;
  filename: string;
  download: string;
  streamable: number;
}

export class RealDebridProvider extends BaseProvider implements DebridProvider {
  public readonly type = 'debrid' as const;
  public account?: ProviderAccount;
  
  private apiKey?: string;
  private client: AxiosInstance;
  private baseUrl = 'https://api.real-debrid.com/rest/1.0';

  constructor() {
    super('real-debrid', 'Real-Debrid', 'debrid', '1.0.0');
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'User-Agent': 'AstraPlay/1.0',
      },
    });
  }

  async initialize(): Promise<void> {
    this.log('Initializing Real-Debrid provider');
    this.enabled = true;
  }

  async shutdown(): Promise<void> {
    this.log('Shutting down Real-Debrid provider');
    this.enabled = false;
    this.apiKey = undefined;
    this.account = undefined;
  }

  async authenticate(credentials: DebridCredentials): Promise<ProviderAccount> {
    try {
      if (!credentials.apiKey) {
        throw new Error('API key is required for Real-Debrid authentication');
      }

      this.apiKey = credentials.apiKey;
      this.client.defaults.headers.common['Authorization'] = `Bearer ${this.apiKey}`;

      const response = await this.client.get<RealDebridUser>('/user');
      const user = response.data;

      this.account = {
        id: user.id.toString(),
        providerId: this.id,
        username: user.username,
        email: user.email,
        premium: user.premium > 0,
        expiresAt: new Date(user.expiration),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.log('Successfully authenticated with Real-Debrid');
      return this.account;
    } catch (error) {
      this.apiKey = undefined;
      return this.handleError(error, 'authenticate');
    }
  }

  async checkStatus(): Promise<ProviderStatus> {
    try {
      if (!this.apiKey) {
        throw new Error('Not authenticated with Real-Debrid');
      }

      const response = await this.client.get<RealDebridUser>('/user');
      const user = response.data;

      return {
        online: true,
        premium: user.premium > 0,
        expiresAt: new Date(user.expiration),
      };
    } catch (error) {
      return this.handleError(error, 'checkStatus');
    }
  }

  async addMagnet(magnetUri: string): Promise<DebridTransfer> {
    try {
      if (!this.apiKey) {
        throw new Error('Not authenticated with Real-Debrid');
      }

      this.log('Adding magnet to Real-Debrid');

      const addResponse = await this.client.post('/torrents/addMagnet', 
        new URLSearchParams({ magnet: magnetUri }),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );

      const torrentId = addResponse.data.id;

      await new Promise(resolve => setTimeout(resolve, 2000));

      const infoResponse = await this.client.get<RealDebridTorrent>(`/torrents/info/${torrentId}`);
      const torrent = infoResponse.data;

      if (torrent.files && torrent.files.length > 0) {
        const fileIds = torrent.files.map(f => f.id).join(',');
        await this.client.post(`/torrents/selectFiles/${torrentId}`, 
          new URLSearchParams({ files: fileIds }),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          }
        );
      }

      return this.mapTorrentToTransfer(torrent);
    } catch (error) {
      return this.handleError(error, 'addMagnet');
    }
  }

  async getTransferStatus(transferId: string): Promise<DebridTransfer> {
    try {
      if (!this.apiKey) {
        throw new Error('Not authenticated with Real-Debrid');
      }

      const response = await this.client.get<RealDebridTorrent>(`/torrents/info/${transferId}`);
      return this.mapTorrentToTransfer(response.data);
    } catch (error) {
      return this.handleError(error, 'getTransferStatus');
    }
  }

  async getStreamUrl(transferId: string, fileId?: string): Promise<string> {
    try {
      if (!this.apiKey) {
        throw new Error('Not authenticated with Real-Debrid');
      }

      this.log(`Getting stream URL for transfer ${transferId}`);

      const torrentInfo = await this.client.get<RealDebridTorrent>(`/torrents/info/${transferId}`);
      const torrent = torrentInfo.data;

      if (torrent.status !== 'downloaded') {
        throw new Error(`Torrent not ready yet. Status: ${torrent.status}`);
      }

      if (!torrent.links || torrent.links.length === 0) {
        throw new Error('No links available for this torrent');
      }

      let linkToUnrestrict = torrent.links[0];

      if (fileId && torrent.files) {
        const fileIndex = torrent.files.findIndex(f => f.id === parseInt(fileId));
        if (fileIndex !== -1 && fileIndex < torrent.links.length) {
          linkToUnrestrict = torrent.links[fileIndex];
        }
      } else if (torrent.files && torrent.files.length > 1) {
        const videoFiles = torrent.files.filter(f => 
          /\.(mp4|mkv|avi|mov|wmv|flv|webm)$/i.test(f.path)
        );
        
        if (videoFiles.length > 0) {
          const largestVideo = videoFiles.reduce((prev, current) => 
            current.bytes > prev.bytes ? current : prev
          );
          const videoIndex = torrent.files.indexOf(largestVideo);
          if (videoIndex !== -1 && videoIndex < torrent.links.length) {
            linkToUnrestrict = torrent.links[videoIndex];
          }
        }
      }

      const unrestrictResponse = await this.client.post<RealDebridUnrestrict>(
        '/unrestrict/link',
        new URLSearchParams({ link: linkToUnrestrict }),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );

      this.log('Successfully obtained stream URL');
      return unrestrictResponse.data.download;
    } catch (error) {
      return this.handleError(error, 'getStreamUrl');
    }
  }

  async deleteTransfer(transferId: string): Promise<void> {
    try {
      if (!this.apiKey) {
        throw new Error('Not authenticated with Real-Debrid');
      }

      await this.client.delete(`/torrents/delete/${transferId}`);
      this.log(`Deleted transfer ${transferId}`);
    } catch (error) {
      return this.handleError(error, 'deleteTransfer');
    }
  }

  private mapTorrentToTransfer(torrent: RealDebridTorrent): DebridTransfer {
    const statusMap: Record<string, DebridTransfer['status']> = {
      'magnet_error': 'error',
      'magnet_conversion': 'queued',
      'waiting_files_selection': 'queued',
      'queued': 'queued',
      'downloading': 'downloading',
      'downloaded': 'ready',
      'error': 'error',
      'virus': 'error',
      'dead': 'error',
    };

    const files: DebridFile[] = torrent.files?.map(f => ({
      id: f.id.toString(),
      name: f.path,
      size: f.bytes,
    })) || [];

    return {
      id: torrent.id,
      magnetUri: `magnet:?xt=urn:btih:${torrent.hash}`,
      name: torrent.filename,
      status: statusMap[torrent.status] || 'queued',
      progress: torrent.progress,
      files,
    };
  }
}
