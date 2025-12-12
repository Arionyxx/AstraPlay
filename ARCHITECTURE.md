# AstraPlay Architecture Documentation

## Overview

AstraPlay is a cross-platform desktop media hub built with Electron and TypeScript. It provides a secure, modular architecture for streaming media content through torrent scrapers and debrid services.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Renderer Process                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              React Application                        │   │
│  │  - HomeScreen, LibraryScreen, SettingsScreen         │   │
│  │  - ProviderConfigDialog, VideoPlayer                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                 │
│                            │ window.electron.invoke()        │
│                            ▼                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Preload Script (Context Bridge)            │   │
│  │  - Type-safe IPC API                                 │   │
│  │  - Input validation                                  │   │
│  │  - Channel whitelisting                              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                             │
                             │ IPC
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                      Main Process                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Main Entry Point                         │   │
│  │  - Window management                                  │   │
│  │  - App lifecycle                                      │   │
│  │  - CSP configuration                                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                 │
│            ┌───────────────┼───────────────┐                │
│            ▼               ▼               ▼                │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │  IPC Handlers│ │  Database    │ │  Provider    │        │
│  │              │ │  Manager     │ │  Manager     │        │
│  │ - Media      │ │              │ │              │        │
│  │ - Torrent    │ │ - SQLite     │ │ - Scrapers   │        │
│  │ - Debrid     │ │ - Migrations │ │ - Debrid     │        │
│  │ - Library    │ │ - CRUD Ops   │ │ - Metadata   │        │
│  │ - Settings   │ │              │ │              │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
│                                             │                │
│                            ┌────────────────┘                │
│                            ▼                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           Provider Implementations                   │    │
│  │                                                      │    │
│  │  ┌────────────────┐  ┌────────────────┐            │    │
│  │  │   Scrapers     │  │  Debrid Svcs   │            │    │
│  │  │                │  │                │            │    │
│  │  │ - LimeTorrents │  │ - Real-Debrid  │            │    │
│  │  │ - 1337x        │  │ - AllDebrid    │            │    │
│  │  │ - ThePirateBay │  │ - Premiumize   │            │    │
│  │  └────────────────┘  └────────────────┘            │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Project Structure

```
astraplay/
├── electron/                    # Main process code
│   ├── main/
│   │   ├── main.ts              # App entry point
│   │   └── ipc-handlers.ts      # IPC channel handlers
│   ├── preload/
│   │   └── preload.ts           # Context bridge & API exposure
│   ├── providers/               # Provider system
│   │   ├── base-provider.ts     # Abstract base class
│   │   ├── provider-manager.ts  # Provider orchestration
│   │   ├── scrapers/
│   │   │   ├── limetorrents-scraper.ts
│   │   │   └── 1337x-scraper.ts (future)
│   │   └── debrid/
│   │       ├── real-debrid.ts
│   │       └── alldebrid.ts (future)
│   ├── database/
│   │   └── schema.ts            # SQLite schema & migrations
│   └── utils/
│       └── security.ts          # Token encryption utilities
├── src/                         # Renderer process code
│   ├── components/
│   │   ├── App.tsx              # Root component
│   │   ├── home/
│   │   │   └── HomeScreen.tsx
│   │   ├── player/
│   │   │   └── VideoPlayer.tsx
│   │   ├── settings/
│   │   │   └── SettingsScreen.tsx
│   │   └── providers/
│   │       └── ProviderConfigDialog.tsx
│   ├── hooks/
│   │   ├── useMedia.ts
│   │   └── useProvider.ts
│   ├── contexts/
│   │   └── AppContext.tsx
│   ├── services/
│   │   └── streaming.ts         # Stream resolution logic
│   ├── types/
│   │   ├── media.ts             # Media type definitions
│   │   ├── provider.ts          # Provider interfaces
│   │   ├── settings.ts          # Settings types
│   │   ├── ipc.ts               # IPC channel definitions
│   │   └── window.d.ts          # Global type augmentation
│   └── styles/
│       └── galactic.css         # Space-themed styling
├── public/
│   └── index.html
└── package.json
```

## Key Design Decisions

### 1. Process Separation

**Decision**: Strict separation between main and renderer processes with no Node.js integration in renderer.

**Rationale**:
- **Security**: Prevents arbitrary code execution in the renderer
- **Stability**: Main process crashes don't affect UI
- **Performance**: Blocking operations run in main process

### 2. Type-Safe IPC

**Decision**: All IPC channels are strictly typed with Zod validation.

**Rationale**:
- **Type Safety**: Compile-time guarantees for IPC messages
- **Validation**: Runtime validation prevents malformed data
- **Documentation**: Types serve as documentation

### 3. Provider System Architecture

**Decision**: Abstract provider interface with concrete implementations in main process.

**Rationale**:
- **Extensibility**: Easy to add new scrapers/debrid services
- **Isolation**: Providers run independently
- **Security**: Network calls isolated from renderer

### 4. Database Layer

**Decision**: SQLite with better-sqlite3 for local persistence.

**Rationale**:
- **Performance**: Synchronous API, no callback overhead
- **Reliability**: ACID compliance
- **Portability**: Single-file database
- **Simplicity**: No external database server required

### 5. Security Model

**Decision**: Content Security Policy (CSP), context isolation, and sandboxing enabled.

**Rationale**:
- **XSS Prevention**: CSP blocks unauthorized scripts
- **Data Protection**: Context isolation prevents renderer from accessing Node.js
- **Process Sandboxing**: Limits attack surface

## Stream Resolution Pipeline

The core feature of AstraPlay is resolving torrents into premium streaming links:

```
1. User searches for media
   ↓
2. Scrapers search torrent sites in parallel
   ↓
3. Results aggregated and sorted by seeders
   ↓
4. User selects a torrent
   ↓
5. Magnet URI sent to debrid provider (e.g., Real-Debrid)
   ↓
6. Debrid service downloads/caches torrent
   ↓
7. Debrid returns direct HTTP/HTTPS stream URL
   ↓
8. Stream URL passed to video player
   ↓
9. User watches content in high-speed stream
```

### Implementation Details

```typescript
// Step 1-3: Search torrents
const results = await window.electron.invoke('torrent:search', {
  query: 'Inception 2010',
  type: 'movie'
});

// Step 5: Resolve magnet with debrid
const transfer = await window.electron.invoke('debrid:resolve-magnet', {
  magnetUri: results[0].magnetUri,
  providerId: 'real-debrid'
});

// Step 6: Wait for download/cache (poll or wait)
await waitForTransferReady(transfer.id);

// Step 7: Get stream URL
const streamUrl = await window.electron.invoke('debrid:get-stream-url', {
  transferId: transfer.id,
  providerId: 'real-debrid'
});

// Step 8-9: Play in video player
playVideo(streamUrl);
```

## Security Best Practices

### 1. IPC Validation

```typescript
// All IPC inputs validated with Zod
const validated = MediaSearchSchema.safeParse(input);
if (!validated.success) {
  throw new Error('Invalid input');
}
```

### 2. Content Security Policy

```typescript
// Restrictive CSP in production
session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      'Content-Security-Policy': [
        "default-src 'self'; script-src 'self'; ..."
      ]
    }
  });
});
```

### 3. Context Isolation

```typescript
// Preload exposes minimal, typed API
contextBridge.exposeInMainWorld('electron', {
  invoke: async (channel, data) => { /* ... */ }
});
```

### 4. Credential Storage

**Recommendation**: Use Electron's `safeStorage` API or `keytar` for API keys:

```typescript
import { safeStorage } from 'electron';

// Encrypt before storing
const encrypted = safeStorage.encryptString(apiKey);
db.prepare('UPDATE provider_configs SET credentials = ?').run(encrypted);

// Decrypt when needed
const decrypted = safeStorage.decryptString(encrypted);
```

### 5. Channel Whitelisting

```typescript
// Only allow specific IPC channels
const validChannels = ['media:search', 'torrent:search', /* ... */];

if (!validChannels.includes(channel)) {
  throw new Error('Invalid channel');
}
```

## Data Flow Examples

### Example 1: User Authenticates with Real-Debrid

```
1. User opens Settings → Configure Real-Debrid
2. Renderer: ProviderConfigDialog component renders
3. User enters API key
4. Renderer → Preload: window.electron.invoke('debrid:authenticate', { providerId, apiKey })
5. Preload → Main: IPC channel 'debrid:authenticate'
6. Main: Validate input with ProviderAuthSchema
7. Main: Get RealDebridProvider from ProviderManager
8. Provider: Call Real-Debrid API /user endpoint
9. Provider: Return ProviderAccount object
10. Main: Store account in database
11. Main → Preload → Renderer: Return account
12. Renderer: Display success message
```

### Example 2: Continue Watching

```
1. App loads HomeScreen component
2. Renderer → Main: invoke('progress:get-continue-watching', { limit: 10 })
3. Main: Query watch_progress table with JOIN on media_items
4. Main: Map database rows to WatchProgress objects
5. Main → Renderer: Return array of progress items
6. Renderer: Display cards with progress bars
```

## Extension Points

### Adding a New Scraper

1. Create `electron/providers/scrapers/new-scraper.ts`
2. Extend `BaseProvider` and implement `ScraperProvider` interface
3. Implement `search()` and `searchEpisode()` methods
4. Register in `ProviderManager`

### Adding a New Debrid Service

1. Create `electron/providers/debrid/new-debrid.ts`
2. Extend `BaseProvider` and implement `DebridProvider` interface
3. Implement auth, magnet resolution, and stream URL methods
4. Register in `ProviderManager`

### Adding a Metadata Provider

1. Create `electron/providers/metadata/tmdb.ts`
2. Implement `MetadataProvider` interface
3. Add IPC handlers for metadata operations
4. Integrate with search/library UI

## Performance Considerations

1. **Database Indexing**: Critical indexes on `media_items`, `watch_progress`, and `library_items`
2. **Parallel Scraping**: All scrapers run concurrently with `Promise.allSettled()`
3. **Lazy Loading**: Components load data on-demand
4. **Caching**: Consider implementing in-memory cache for frequent queries
5. **Worker Threads**: Heavy scraping could move to worker threads if needed

## Future Enhancements

1. **Plugin System**: Allow third-party providers via plugin API
2. **Offline Mode**: Download videos for offline viewing
3. **Subtitle Integration**: OpenSubtitles API integration
4. **Multiple Profiles**: User profile support
5. **Watchlist Sync**: Cloud sync across devices
6. **Chromecast**: Cast to TV support
7. **VPN Integration**: Built-in VPN for privacy

## Conclusion

This architecture provides a solid foundation for a secure, extensible, and high-performance desktop media application. The strict separation of concerns, type safety, and modular provider system make it easy to maintain and extend.
