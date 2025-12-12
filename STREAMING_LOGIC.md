# AstraPlay Streaming Logic

## Overview

This document details the "Premium Link" pipeline that transforms torrent magnets into high-speed direct streaming URLs using debrid services.

## The Problem

Traditional torrenting has several issues:
- **Speed**: Depends on seeders, can be slow
- **Waiting**: Must download before watching
- **Upload Requirements**: Ratio requirements on private trackers
- **Security**: IP address exposed to swarm
- **Reliability**: Torrents can go dead

## The Solution: Debrid Services

Debrid services (Real-Debrid, AllDebrid, Premiumize) act as intermediaries:
1. They download/cache torrents on their servers
2. Convert them to direct HTTP/HTTPS links
3. Serve at maximum speed from their CDN
4. No upload requirements
5. User IP address hidden

## Pipeline Implementation

### Step 1: Torrent Discovery

**Location**: `electron/providers/scrapers/`

**Process**:
```typescript
// User searches for content
const query = "Inception 2010";

// All enabled scrapers search in parallel
const scrapers = providerManager.getAllScrapers().filter(s => s.enabled);
const results = await Promise.allSettled(
  scrapers.map(scraper => scraper.search(query, 'movie'))
);

// Aggregate and deduplicate results by infoHash
const torrents = results
  .filter(r => r.status === 'fulfilled')
  .flatMap(r => r.value)
  .sort((a, b) => b.seeders - a.seeders); // Sort by popularity
```

**Data Structure**:
```typescript
interface TorrentResult {
  id: string;              // Info hash
  name: string;            // Release name
  size: number;            // Bytes
  seeders: number;         // Active seeders
  leechers: number;        // Active leechers
  magnetUri: string;       // magnet:?xt=urn:btih:...
  infoHash: string;        // 40-char hex hash
  uploadDate?: Date;
  quality?: string;        // 1080p, 720p, etc.
  source?: string;         // Scraper source
  providerId: string;      // Scraper ID
}
```

**Scraping Strategy**:

Each scraper:
1. Makes HTTP request to torrent site search page
2. Parses HTML with Cheerio
3. Extracts torrent metadata (name, size, seeders)
4. Extracts or reconstructs info hash
5. Builds magnet URI with trackers
6. Returns standardized `TorrentResult[]`

**Example: LimeTorrents Scraper**

```typescript
async search(query: string, mediaType: 'movie' | 'series'): Promise<TorrentResult[]> {
  const url = `https://www.limetorrents.lol/search/all/${encodeURIComponent(query)}/seeds/1/`;
  
  const response = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 ...' },
    timeout: 10000,
  });

  return this.parseSearchResults(response.data);
}

private parseSearchResults(html: string): TorrentResult[] {
  const $ = cheerio.load(html);
  const results: TorrentResult[] = [];

  $('.table2 tbody tr').each((_, element) => {
    const name = $(element).find('.tt-name a').eq(1).text().trim();
    const sizeText = $(element).find('.tdnormal').eq(1).text().trim();
    const seedersText = $(element).find('.tdseed').text().trim();
    
    const infoHash = this.extractInfoHashFromLink(link);
    const magnetUri = this.buildMagnetUri(infoHash, name);
    
    results.push({
      id: infoHash,
      name,
      size: this.parseSize(sizeText),
      seeders: parseInt(seedersText) || 0,
      leechers: parseInt(leechersText) || 0,
      magnetUri,
      infoHash,
      quality: this.extractQuality(name),
      source: 'limetorrents',
      providerId: this.id,
    });
  });

  return results;
}
```

### Step 2: Magnet Resolution

**Location**: `electron/providers/debrid/real-debrid.ts`

**Process**:
```typescript
// User selects a torrent
const selectedTorrent = torrents[0];

// Send magnet to Real-Debrid
const transfer = await realDebridProvider.addMagnet(selectedTorrent.magnetUri);
```

**Real-Debrid API Flow**:

1. **Add Magnet** (`POST /torrents/addMagnet`)
   ```typescript
   const response = await this.client.post('/torrents/addMagnet', 
     new URLSearchParams({ magnet: magnetUri })
   );
   const torrentId = response.data.id;
   ```

2. **Get Torrent Info** (`GET /torrents/info/{id}`)
   ```typescript
   const info = await this.client.get(`/torrents/info/${torrentId}`);
   // Returns: { id, filename, status, files, links, progress }
   ```

3. **Select Files** (`POST /torrents/selectFiles/{id}`)
   - For multi-file torrents, we need to select which files to download
   - Usually select all files or the largest video file
   ```typescript
   if (info.files && info.files.length > 0) {
     const fileIds = info.files.map(f => f.id).join(',');
     await this.client.post(`/torrents/selectFiles/${torrentId}`, 
       new URLSearchParams({ files: fileIds })
     );
   }
   ```

4. **Wait for Download** (Poll or wait)
   - Status: `magnet_conversion` → `queued` → `downloading` → `downloaded`
   - If cached, goes straight to `downloaded` (instant!)
   ```typescript
   let status = 'queued';
   while (status !== 'downloaded' && status !== 'error') {
     await new Promise(resolve => setTimeout(resolve, 2000));
     const info = await this.getTransferStatus(torrentId);
     status = info.status;
   }
   ```

**Cache Hit Optimization**:

Real-Debrid caches popular torrents. If cached:
- Status immediately becomes `downloaded`
- No waiting required
- Stream available instantly

This is why popular movies/shows stream immediately!

### Step 3: Stream URL Extraction

**Process**:
```typescript
const streamUrl = await realDebridProvider.getStreamUrl(transfer.id);
```

**Implementation**:

1. **Get Torrent Links** (`GET /torrents/info/{id}`)
   ```typescript
   const info = await this.client.get(`/torrents/info/${torrentId}`);
   const links = info.data.links; // Array of Real-Debrid hosted links
   ```

2. **Select Best File**
   - For movies: Usually only one video file
   - For TV episodes: Match episode number
   - Strategy: Select largest video file (by bytes)
   ```typescript
   const videoFiles = info.files.filter(f => 
     /\.(mp4|mkv|avi|mov|wmv)$/i.test(f.path)
   );
   const largestVideo = videoFiles.reduce((prev, current) => 
     current.bytes > prev.bytes ? current : prev
   );
   const linkToUnrestrict = links[videoFiles.indexOf(largestVideo)];
   ```

3. **Unrestrict Link** (`POST /unrestrict/link`)
   - Converts Real-Debrid internal link to direct download URL
   ```typescript
   const response = await this.client.post('/unrestrict/link',
     new URLSearchParams({ link: linkToUnrestrict })
   );
   const directUrl = response.data.download;
   // Returns: https://cdn.real-debrid.com/d/XXXXXXXXXX/video.mp4
   ```

4. **Return Direct URL**
   - This is a standard HTTPS URL
   - No authentication needed (short-lived token in URL)
   - Can be used in any video player
   - Served from CDN at maximum speed

### Step 4: Video Playback

**Location**: `src/components/player/VideoPlayer.tsx`

**Process**:
```typescript
// Renderer receives stream URL
const streamUrl = "https://cdn.real-debrid.com/d/XXXXXXXXXX/video.mp4";

// Use HTML5 video element
<video
  src={streamUrl}
  controls
  autoPlay
  onTimeUpdate={handleProgress}
  onEnded={handleComplete}
/>
```

**Features**:
- Standard HTML5 video controls
- Seeking supported (Range requests)
- Adaptive streaming (if HLS/DASH)
- Track watch progress in database

## Complete Flow Example

```typescript
// 1. Search for content
async function searchAndPlay(query: string) {
  // Step 1: Find torrents
  const torrents = await window.electron.invoke('torrent:search', {
    query,
    type: 'movie'
  });
  
  if (torrents.length === 0) {
    throw new Error('No torrents found');
  }

  // Select best quality torrent (1080p with most seeders)
  const bestTorrent = torrents
    .filter(t => t.quality === '1080p')
    .sort((a, b) => b.seeders - a.seeders)[0] || torrents[0];

  // Step 2: Add to Real-Debrid
  const transfer = await window.electron.invoke('debrid:resolve-magnet', {
    magnetUri: bestTorrent.magnetUri,
    providerId: 'real-debrid'
  });

  // Step 3: Wait for ready status
  let status = transfer.status;
  while (status !== 'ready' && status !== 'error') {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const updated = await window.electron.invoke('debrid:get-transfer-status', {
      transferId: transfer.id,
      providerId: 'real-debrid'
    });
    
    status = updated.status;
    
    if (status === 'error') {
      throw new Error('Transfer failed');
    }
  }

  // Step 4: Get stream URL
  const streamUrl = await window.electron.invoke('debrid:get-stream-url', {
    transferId: transfer.id,
    providerId: 'real-debrid'
  });

  // Step 5: Play video
  const videoPlayer = document.querySelector('video');
  videoPlayer.src = streamUrl;
  videoPlayer.play();

  // Cleanup: Delete transfer after watching (optional)
  setTimeout(async () => {
    await window.electron.invoke('debrid:delete-transfer', {
      transferId: transfer.id,
      providerId: 'real-debrid'
    });
  }, 3600000); // 1 hour
}
```

## Error Handling

### Common Errors

1. **No Torrents Found**
   - Retry with different query
   - Try alternate spellings
   - Check year accuracy

2. **Magnet Add Failed**
   - Invalid magnet URI
   - Debrid service quota exceeded
   - Premium account expired

3. **Transfer Error**
   - Dead torrent (no seeders)
   - Copyrighted content blocked
   - Server-side error

4. **Unrestrict Failed**
   - File no longer available
   - Link expired
   - Network issue

### Error Recovery

```typescript
try {
  const streamUrl = await getStreamUrl(magnetUri);
  return streamUrl;
} catch (error) {
  if (error.message.includes('quota')) {
    // Suggest upgrading account or waiting
    showQuotaExceededMessage();
  } else if (error.message.includes('dead')) {
    // Try next torrent in list
    return tryNextTorrent();
  } else {
    // Generic error
    showErrorMessage(error.message);
  }
}
```

## Performance Optimizations

### 1. Parallel Scraping
```typescript
const results = await Promise.allSettled(
  scrapers.map(s => s.search(query))
);
```

### 2. Cache Check First
```typescript
// Check if torrent is cached before adding
const cacheStatus = await checkCache(infoHash);
if (cacheStatus.cached) {
  // Instant streaming available
}
```

### 3. Progressive Loading
```typescript
// Start playback as soon as first bytes are ready
video.preload = 'metadata';
video.addEventListener('canplay', () => video.play());
```

### 4. Smart File Selection
```typescript
// For season packs, only download/stream requested episode
const episodeFile = files.find(f => 
  f.path.includes(`S${season}E${episode}`)
);
```

## Security Considerations

### 1. Credential Protection
- Never store API keys in plaintext
- Use Electron's `safeStorage` for encryption
- Never expose credentials to renderer process

### 2. URL Sanitization
- Validate all URLs before playback
- Check domain whitelist
- Prevent SSRF attacks

### 3. Rate Limiting
- Implement request throttling
- Respect debrid service limits
- Queue requests if necessary

### 4. User Privacy
- Debrid service hides user IP from swarm
- No peer-to-peer connections
- Encrypted HTTPS transfers

## Alternative Debrid Services

### AllDebrid
- Similar API to Real-Debrid
- Different pricing model
- Implementation: `electron/providers/debrid/alldebrid.ts`

### Premiumize
- Premium API with more features
- Cloud storage integration
- Implementation: `electron/providers/debrid/premiumize.ts`

### Implementation Pattern
```typescript
export class AllDebridProvider extends BaseProvider implements DebridProvider {
  async addMagnet(magnetUri: string): Promise<DebridTransfer> {
    // AllDebrid-specific implementation
  }
  
  async getStreamUrl(transferId: string): Promise<string> {
    // AllDebrid-specific implementation
  }
}
```

## Conclusion

The streaming pipeline transforms slow, unreliable torrents into instant, high-speed streams through debrid services. This provides a Netflix-like experience while maintaining the vast content library of torrents.

Key benefits:
- ✅ Instant streaming (if cached)
- ✅ Maximum speed (CDN delivery)
- ✅ No upload requirements
- ✅ User privacy protected
- ✅ Reliable playback
- ✅ Wide format support
