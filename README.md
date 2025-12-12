# ⭐ AstraPlay - Premium Desktop Media Hub

A modern, cross-platform desktop application for streaming movies, TV shows, and anime using torrent scrapers and debrid services.

![AstraPlay](docs/screenshot.png)

## 🌟 Features

- **🎬 Media Management**: Browse movies, TV shows, and anime with rich metadata
- **🔍 Smart Search**: Parallel torrent scraping from multiple sources
- **⚡ Premium Streaming**: Convert torrents to instant, high-speed streams via debrid services
- **🎨 Galactic UI**: Beautiful space-themed interface with smooth animations
- **📊 Watch Progress**: Track your watching history and resume where you left off
- **📚 Personal Library**: Build your collection with favorites
- **🔒 Secure**: Strict security model with context isolation and CSP
- **🚀 Performance**: SQLite database with efficient indexing
- **🌍 Cross-Platform**: Windows, macOS, and Linux support

## 🏗️ Architecture

AstraPlay is built with:

- **Electron** - Desktop application framework
- **TypeScript** - Type-safe development
- **React** - Modern UI library
- **Vite** - Fast build tooling
- **SQLite** - Local database (better-sqlite3)
- **Zod** - Runtime type validation
- **Axios** - HTTP client
- **Cheerio** - HTML parsing for scrapers

### Process Architecture

```
┌─────────────────────────────────────┐
│     Renderer Process (React)        │
│  - UI Components                    │
│  - React Hooks & State              │
├─────────────────────────────────────┤
│     Preload (Context Bridge)        │
│  - Type-safe IPC API                │
│  - Input validation                 │
├─────────────────────────────────────┤
│     Main Process (Node.js)          │
│  - Window Management                │
│  - Database (SQLite)                │
│  - Provider System:                 │
│    • Torrent Scrapers               │
│    • Debrid Services                │
│    • Metadata Providers             │
└─────────────────────────────────────┘
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed documentation.

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.x (for building native modules)
- **Build Tools**:
  - Windows: Visual Studio Build Tools
  - macOS: Xcode Command Line Tools
  - Linux: `build-essential`

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/astraplay.git
cd astraplay

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will open automatically. The renderer runs on `http://localhost:3000` in development.

### Building for Production

```bash
# Build for current platform
npm run dist

# Build for specific platforms
npm run dist:win   # Windows
npm run dist:mac   # macOS
npm run dist:linux # Linux
```

Binaries will be in the `release/` directory.

## 📖 Usage

### 1. Configure Real-Debrid

1. Open Settings → Configure Real-Debrid
2. Get your API key from [real-debrid.com/apitoken](https://real-debrid.com/apitoken)
3. Enter the API key and authenticate
4. Your premium account will be connected

### 2. Search and Stream

1. Go to Search tab
2. Enter a movie or series name
3. Select from search results
4. Choose a torrent (sorted by quality and seeders)
5. AstraPlay will:
   - Send the magnet to Real-Debrid
   - Wait for download/cache (instant if cached!)
   - Retrieve the direct stream URL
   - Start playback in the built-in player

### 3. Manage Library

- Add movies/shows to your library
- Mark favorites with ⭐
- View watch history
- Resume where you left off

## 🔐 Security

AstraPlay implements industry-standard security practices:

- ✅ **No Node.js in Renderer**: `nodeIntegration: false`
- ✅ **Context Isolation**: Strict separation of renderer and main
- ✅ **Content Security Policy**: Restrictive CSP headers
- ✅ **Sandboxed Renderer**: OS-level process sandboxing
- ✅ **Encrypted Credentials**: Using Electron's `safeStorage` API
- ✅ **IPC Validation**: Zod schemas for all IPC messages
- ✅ **SQL Injection Prevention**: Parameterized queries only
- ✅ **XSS Protection**: React auto-escaping

See [SECURITY.md](./SECURITY.md) for detailed security documentation.

## 🔄 Streaming Logic

The "Premium Link" pipeline:

```
1. User searches for "Inception 2010"
   ↓
2. Scrapers search torrent sites in parallel
   ↓
3. Results aggregated and sorted by seeders
   ↓
4. User selects a 1080p torrent
   ↓
5. Magnet sent to Real-Debrid API
   ↓
6. Real-Debrid downloads/caches torrent (instant if cached!)
   ↓
7. Direct HTTPS stream URL returned
   ↓
8. Video plays in built-in player at maximum speed
```

See [STREAMING_LOGIC.md](./STREAMING_LOGIC.md) for implementation details.

## 📁 Project Structure

```
astraplay/
├── electron/                    # Main process
│   ├── main/
│   │   ├── main.ts              # App entry point
│   │   └── ipc-handlers.ts      # IPC channels
│   ├── preload/
│   │   └── preload.ts           # Context bridge
│   ├── providers/
│   │   ├── provider-manager.ts  # Provider orchestration
│   │   ├── scrapers/            # Torrent scrapers
│   │   └── debrid/              # Debrid services
│   └── database/
│       └── schema.ts            # SQLite schema
├── src/                         # Renderer process
│   ├── components/
│   │   ├── App.tsx              # Root component
│   │   ├── home/                # Home screen
│   │   ├── player/              # Video player
│   │   ├── settings/            # Settings UI
│   │   └── providers/           # Provider config
│   ├── types/
│   │   ├── media.ts             # Media types
│   │   ├── provider.ts          # Provider interfaces
│   │   ├── ipc.ts               # IPC definitions
│   │   └── settings.ts          # Settings types
│   └── styles/
│       └── galactic.css         # Space theme
├── public/
│   └── index.html
├── ARCHITECTURE.md              # Architecture docs
├── STREAMING_LOGIC.md           # Streaming pipeline docs
├── SECURITY.md                  # Security best practices
└── package.json
```

## 🎨 UI Theme

AstraPlay features a "Galactic" space theme:

- **Dark Mode**: Deep space blacks and purples
- **Animations**: Smooth transitions and hover effects
- **Starfield**: Animated background stars
- **Gradients**: Nebula-inspired purple/blue accents
- **Typography**: Clean, modern fonts
- **Glass Morphism**: Frosted glass effects with backdrop blur

## 🔌 Provider System

### Current Providers

**Scrapers**:
- ✅ LimeTorrents
- 🔄 1337x (planned)
- 🔄 ThePirateBay (planned)

**Debrid Services**:
- ✅ Real-Debrid
- 🔄 AllDebrid (planned)
- 🔄 Premiumize (planned)

**Metadata**:
- 🔄 TMDB (planned)
- 🔄 OMDb (planned)

### Adding New Providers

1. Create provider class extending `BaseProvider`
2. Implement the appropriate interface (`ScraperProvider`, `DebridProvider`, etc.)
3. Register in `ProviderManager`
4. Add IPC handlers if needed

See [ARCHITECTURE.md](./ARCHITECTURE.md) for details.

## 🧪 Development

### Scripts

```bash
npm run dev              # Start dev server
npm run build            # Build for production
npm run build:renderer   # Build renderer only
npm run build:electron   # Build electron only
npm run dist             # Package for distribution
npm run lint             # Run ESLint
npm run type-check       # Run TypeScript checks
```

### Development Tools

- **React DevTools**: Automatically loaded in dev mode
- **Electron DevTools**: `Cmd+Option+I` / `Ctrl+Shift+I`
- **Hot Reload**: Renderer auto-reloads on changes

## 🐛 Troubleshooting

### Database Errors

```bash
# Delete and reinitialize database
rm ~/Library/Application\ Support/AstraPlay/astraplay.db  # macOS
rm ~/.config/AstraPlay/astraplay.db                        # Linux
del %APPDATA%\AstraPlay\astraplay.db                       # Windows
```

### Build Errors

```bash
# Clean build artifacts
rm -rf dist-electron dist-renderer release node_modules

# Reinstall dependencies
npm install

# Rebuild native modules
npm rebuild better-sqlite3
```

### Scraper Not Working

- Check if the torrent site is accessible
- Verify User-Agent in scraper
- Check HTML structure hasn't changed (sites update frequently)

## 📝 License

This project is for educational purposes. Respect copyright laws and terms of service for all providers used.

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📧 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/astraplay/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/astraplay/discussions)
- **Email**: support@astraplay.com

## 🙏 Acknowledgments

- **Electron** team for the amazing framework
- **Real-Debrid** for premium streaming infrastructure
- **React** team for the UI library
- All open-source contributors

## 🗺️ Roadmap

- [ ] TMDB metadata integration
- [ ] Subtitle support (OpenSubtitles)
- [ ] Multiple user profiles
- [ ] Cloud sync for watch progress
- [ ] Chromecast support
- [ ] Download for offline viewing
- [ ] VPN integration
- [ ] Plugin system for community providers
- [ ] Mobile companion app
- [ ] Social features (watch parties)

---

Made with ❤️ and ⭐ by the AstraPlay Team
