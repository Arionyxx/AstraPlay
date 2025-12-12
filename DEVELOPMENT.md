# Development Guide

## Getting Started

### Prerequisites

1. **Node.js** 18+ and npm
2. **Python** 3.x (required for building native modules like better-sqlite3)
3. **Platform-specific build tools**:
   - **Windows**: Visual Studio Build Tools
     ```bash
     npm install --global windows-build-tools
     ```
   - **macOS**: Xcode Command Line Tools
     ```bash
     xcode-select --install
     ```
   - **Linux**: build-essential
     ```bash
     sudo apt-get install build-essential
     ```

### Initial Setup

```bash
# Clone the repository
git clone <repo-url>
cd astraplay

# Install dependencies
npm install

# Start development
npm run dev
```

## Project Structure

```
astraplay/
├── electron/              # Main process (Node.js)
│   ├── main/              # App entry and IPC handlers
│   ├── preload/           # Context bridge
│   ├── providers/         # Provider system
│   │   ├── scrapers/      # Torrent scrapers
│   │   └── debrid/        # Debrid services
│   ├── database/          # SQLite database
│   └── utils/             # Utilities
│
├── src/                   # Renderer process (React)
│   ├── components/        # React components
│   ├── hooks/             # Custom React hooks
│   ├── contexts/          # React contexts
│   ├── services/          # Business logic
│   ├── types/             # TypeScript definitions
│   └── styles/            # CSS styles
│
├── public/                # Static assets
└── build/                 # Build resources (icons, etc.)
```

## Development Workflow

### Running the App

```bash
# Development mode (hot reload)
npm run dev

# This runs two processes:
# 1. Vite dev server (renderer) on http://localhost:3000
# 2. Electron main process (connects to Vite)
```

The app will:
1. Start Vite dev server for React
2. Wait for Vite to be ready
3. Launch Electron window
4. Load React app from localhost:3000
5. Enable hot module replacement (HMR)

### Building

```bash
# Build both renderer and electron
npm run build

# Build only renderer
npm run build:renderer

# Build only electron
npm run build:electron

# Type checking
npm run type-check

# Lint code
npm run lint
```

### Packaging

```bash
# Package for current platform
npm run dist

# Platform-specific
npm run dist:win    # Windows
npm run dist:mac    # macOS
npm run dist:linux  # Linux
```

## Adding Features

### 1. Adding a New IPC Channel

#### Step 1: Define the channel in `src/types/ipc.ts`

```typescript
// Add to IpcChannels interface
export interface IpcChannels {
  // ... existing channels
  'my-feature:action': {
    request: { param: string };
    response: { result: string };
  };
}
```

#### Step 2: Add to preload whitelist in `electron/preload/preload.ts`

```typescript
const validChannels: IpcChannel[] = [
  // ... existing channels
  'my-feature:action',
];
```

#### Step 3: Implement handler in `electron/main/ipc-handlers.ts`

```typescript
ipcMain.handle('my-feature:action', async (_, data) => {
  try {
    // Validate input if needed
    const result = await doSomething(data.param);
    return { result };
  } catch (error) {
    console.error('[IPC] my-feature:action error:', error);
    throw error;
  }
});
```

#### Step 4: Use in renderer

```typescript
const result = await window.electron.invoke('my-feature:action', {
  param: 'value'
});
```

### 2. Adding a New Scraper

#### Step 1: Create scraper class

```typescript
// electron/providers/scrapers/my-scraper.ts
import { BaseProvider } from '../base-provider';
import type { ScraperProvider, TorrentResult } from '../../../src/types/provider';

export class MyScraperProvider extends BaseProvider implements ScraperProvider {
  public readonly type = 'scraper' as const;

  constructor() {
    super('my-scraper', 'My Scraper', 'scraper', '1.0.0');
  }

  async initialize(): Promise<void> {
    this.log('Initializing');
    this.enabled = true;
  }

  async shutdown(): Promise<void> {
    this.log('Shutting down');
    this.enabled = false;
  }

  async search(query: string, mediaType: 'movie' | 'series'): Promise<TorrentResult[]> {
    // Implement scraping logic
    return [];
  }

  async searchEpisode(
    seriesName: string,
    season: number,
    episode: number
  ): Promise<TorrentResult[]> {
    // Implement episode search
    return [];
  }
}
```

#### Step 2: Register in provider manager

```typescript
// electron/providers/provider-manager.ts
import { MyScraperProvider } from './scrapers/my-scraper';

private registerDefaultProviders(): void {
  // ... existing providers
  const myScraper = new MyScraperProvider();
  this.registerProvider(myScraper);
}
```

### 3. Adding a New Debrid Service

Similar to scrapers, but implement `DebridProvider` interface:

```typescript
export class MyDebridProvider extends BaseProvider implements DebridProvider {
  public readonly type = 'debrid' as const;
  
  async authenticate(credentials: DebridCredentials): Promise<ProviderAccount> { /* ... */ }
  async checkStatus(): Promise<ProviderStatus> { /* ... */ }
  async addMagnet(magnetUri: string): Promise<DebridTransfer> { /* ... */ }
  async getStreamUrl(transferId: string, fileId?: string): Promise<string> { /* ... */ }
  async deleteTransfer(transferId: string): Promise<void> { /* ... */ }
}
```

### 4. Adding a React Component

```tsx
// src/components/my-feature/MyComponent.tsx
import React, { useState, useEffect } from 'react';

interface MyComponentProps {
  title: string;
}

export const MyComponent: React.FC<MyComponentProps> = ({ title }) => {
  const [data, setData] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const result = await window.electron.invoke('my-feature:action', {
        param: 'value'
      });
      setData(result.result);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  return (
    <div className="my-component">
      <h2>{title}</h2>
      <p>{data}</p>
    </div>
  );
};
```

## Database Migrations

### Adding a New Table

Edit `electron/database/schema.ts`:

```typescript
private runMigrations(currentVersion: number): void {
  if (currentVersion < 2) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS my_new_table (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_my_new_table_name ON my_new_table(name);
    `);
    this.db.pragma('user_version = 2');
  }
}
```

## Debugging

### Main Process

1. Add `debugger` statements in `electron/` code
2. Run with `--inspect` flag:
   ```bash
   npm run dev:electron -- --inspect=5858
   ```
3. Open `chrome://inspect` in Chrome
4. Click "inspect" on the Electron process

### Renderer Process

1. Open DevTools: `Cmd+Option+I` (Mac) or `Ctrl+Shift+I` (Windows/Linux)
2. Use React DevTools (auto-loaded in dev mode)
3. Console logs appear in DevTools console

### IPC Communication

Add logging in preload:

```typescript
const api = {
  invoke: async <T extends IpcChannel>(channel: T, data?: IpcRequest<T>) => {
    console.log('[IPC Send]', channel, data);
    const result = await ipcRenderer.invoke(channel, data);
    console.log('[IPC Receive]', channel, result);
    return result;
  },
};
```

## Testing

### Manual Testing Checklist

- [ ] App launches without errors
- [ ] UI renders correctly
- [ ] Navigation works
- [ ] Database operations succeed
- [ ] IPC channels respond correctly
- [ ] Provider authentication works
- [ ] Torrent search returns results
- [ ] Stream resolution completes
- [ ] Video playback works
- [ ] Settings persist
- [ ] App closes cleanly

### Future: Automated Testing

Consider adding:
- **Unit tests**: Jest for business logic
- **Integration tests**: Test IPC communication
- **E2E tests**: Spectron or Playwright for Electron

## Common Issues

### Native Module Build Errors

```bash
# Rebuild native modules for Electron
npm rebuild better-sqlite3 --runtime=electron --target=<electron-version> --abi=<abi-version>

# Or use electron-rebuild
npm install --save-dev electron-rebuild
npx electron-rebuild
```

### Database Locked

```bash
# Close all app instances
# Delete WAL files
rm <app-data>/astraplay.db-wal
rm <app-data>/astraplay.db-shm
```

### Port Already in Use

```bash
# Kill process on port 3000
# macOS/Linux
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### TypeScript Errors

```bash
# Clean TypeScript cache
rm -rf node_modules/.cache
rm tsconfig.tsbuildinfo

# Regenerate types
npm run type-check
```

## Performance Tips

1. **Database Indexes**: Add indexes for frequently queried columns
2. **Lazy Loading**: Load components and data on-demand
3. **Virtualization**: Use virtual scrolling for long lists
4. **Memoization**: Use `React.memo()` and `useMemo()` appropriately
5. **Debouncing**: Debounce search inputs and frequent operations
6. **Worker Threads**: Move CPU-intensive tasks to workers

## Code Style

### TypeScript

- Use `interface` for object shapes
- Use `type` for unions and primitives
- Prefer `const` over `let`
- Use optional chaining `?.` and nullish coalescing `??`
- Avoid `any` - use `unknown` if type is truly unknown

### React

- Functional components only (no class components)
- Use hooks for state and effects
- Keep components small and focused
- Extract custom hooks for reusable logic
- Use TypeScript for all props

### File Naming

- Components: `PascalCase.tsx` (e.g., `HomeScreen.tsx`)
- Utilities: `kebab-case.ts` (e.g., `rate-limiter.ts`)
- Types: `kebab-case.ts` (e.g., `media.ts`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_RESULTS`)

## Resources

- [Electron Documentation](https://www.electronjs.org/docs/latest)
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook)
- [Vite Guide](https://vite.dev/guide)
- [Better SQLite3](https://github.com/WiseLibs/better-sqlite3)
- [Zod Documentation](https://zod.dev)

## Getting Help

- Check [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
- Check [SECURITY.md](./SECURITY.md) for security guidelines
- Check [STREAMING_LOGIC.md](./STREAMING_LOGIC.md) for streaming pipeline
- Open an issue on GitHub
- Join discussions

## Contributing

See [README.md](./README.md) for contribution guidelines.
