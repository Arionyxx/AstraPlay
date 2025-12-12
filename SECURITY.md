# AstraPlay Security Best Practices

## Overview

This document outlines the security measures implemented in AstraPlay and best practices for maintaining a secure Electron application.

## Security Architecture

### 1. Process Isolation

```typescript
// main.ts - Strict security configuration
const mainWindow = new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,        // ✅ No Node.js in renderer
    contextIsolation: true,         // ✅ Context bridge required
    sandbox: true,                  // ✅ Sandboxed renderer
    webSecurity: true,              // ✅ Web security enabled
    allowRunningInsecureContent: false,  // ✅ No mixed content
    preload: path.join(__dirname, '../preload/preload.js'),
  },
});
```

**Why This Matters**:
- **nodeIntegration: false**: Prevents renderer from accessing Node.js APIs directly
- **contextIsolation: true**: Separates renderer context from preload context
- **sandbox: true**: Runs renderer in OS-level sandbox
- **webSecurity: true**: Enforces same-origin policy
- **allowRunningInsecureContent: false**: Blocks HTTP content in HTTPS pages

### 2. Content Security Policy (CSP)

```typescript
// main.ts - Restrictive CSP
session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': [
        isDev
          ? "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:*; ..."
          : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; media-src 'self' https: blob:; connect-src 'self' https:;"
      ]
    }
  });
});
```

**Production CSP Breakdown**:
- `default-src 'self'`: Only load resources from app origin
- `script-src 'self'`: Only execute scripts bundled with app
- `style-src 'self' 'unsafe-inline'`: Allow inline styles (needed for React)
- `img-src 'self' data: https:`: Allow images from app, data URIs, and HTTPS
- `media-src 'self' https: blob:`: Allow media from app, HTTPS, and blob URLs
- `connect-src 'self' https:`: Only connect to app and HTTPS endpoints

**Why `unsafe-inline` for styles?**:
- React and styled-components use inline styles
- Risk is minimal since we control all code
- Alternative: Use nonce-based CSP (more complex)

### 3. Context Bridge

```typescript
// preload.ts - Minimal, typed API
const api = {
  invoke: async <T extends IpcChannel>(
    channel: T,
    data?: IpcRequest<T>
  ): Promise<IpcResponse<T>> => {
    if (!isValidChannel(channel)) {
      throw new Error(`Invalid IPC channel: ${channel}`);
    }
    return await ipcRenderer.invoke(channel, data);
  },
};

contextBridge.exposeInMainWorld('electron', api);
```

**Security Features**:
- **Channel Whitelisting**: Only predefined channels allowed
- **Type Safety**: TypeScript prevents invalid data types
- **No Direct Access**: Renderer can't access `ipcRenderer` directly
- **Minimal Surface**: Only expose what's necessary

### 4. IPC Validation

```typescript
// ipc-handlers.ts - Strict validation
import { z } from 'zod';

const MediaSearchSchema = z.object({
  query: z.string().min(1).max(200),
  year: z.number().min(1800).max(2100).optional(),
  type: z.enum(['movie', 'series', 'anime']).optional(),
});

ipcMain.handle('media:search', async (_, data) => {
  const validated = MediaSearchSchema.safeParse(data);
  
  if (!validated.success) {
    throw new Error(`Validation failed: ${validated.error.message}`);
  }
  
  // Proceed with validated data
  const { query, year, type } = validated.data;
  // ...
});
```

**Why Zod?**:
- **Runtime Validation**: TypeScript only checks at compile time
- **Detailed Errors**: Provides specific validation failure messages
- **Type Inference**: Automatically infers TypeScript types
- **Composable**: Easy to create complex schemas

### 5. Credential Storage

**❌ NEVER DO THIS**:
```typescript
// DON'T store API keys in plaintext
localStorage.setItem('apiKey', 'my-secret-key');
db.prepare('INSERT INTO credentials VALUES (?)').run('my-secret-key');
```

**✅ CORRECT APPROACH**:

#### Option 1: Electron's safeStorage (Recommended)
```typescript
import { safeStorage } from 'electron';

// Encrypt before storing
function storeCredential(key: string, value: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption not available on this system');
  }
  
  const encrypted = safeStorage.encryptString(value);
  const base64 = encrypted.toString('base64');
  
  db.prepare('UPDATE provider_configs SET credentials = ? WHERE id = ?')
    .run(base64, key);
}

// Decrypt when needed
function getCredential(key: string): string {
  const row = db.prepare('SELECT credentials FROM provider_configs WHERE id = ?')
    .get(key);
  
  if (!row || !row.credentials) {
    throw new Error('Credential not found');
  }
  
  const encrypted = Buffer.from(row.credentials, 'base64');
  return safeStorage.decryptString(encrypted);
}
```

**How it works**:
- **macOS**: Uses Keychain
- **Windows**: Uses DPAPI (Data Protection API)
- **Linux**: Uses libsecret or kwallet

#### Option 2: keytar (Alternative)
```typescript
import keytar from 'keytar';

// Store credential
await keytar.setPassword('AstraPlay', 'real-debrid-api-key', apiKey);

// Retrieve credential
const apiKey = await keytar.getPassword('AstraPlay', 'real-debrid-api-key');

// Delete credential
await keytar.deletePassword('AstraPlay', 'real-debrid-api-key');
```

**Advantages**:
- Integrates with OS credential managers
- More secure than app-level encryption
- Survives app uninstall (can be pro or con)

### 6. SQL Injection Prevention

```typescript
// ❌ VULNERABLE - Never concatenate SQL
const query = `SELECT * FROM media WHERE title = '${userInput}'`;
db.exec(query); // SQLi vulnerability!

// ✅ SAFE - Use parameterized queries
const stmt = db.prepare('SELECT * FROM media WHERE title = ?');
const results = stmt.all(userInput); // Safely escaped
```

**Better-sqlite3 Safety**:
- All `prepare()` statements use parameter binding
- No string concatenation of SQL
- Automatic escaping of special characters

### 7. Path Traversal Prevention

```typescript
// ❌ VULNERABLE
const filePath = `/downloads/${userInput}`;
fs.readFileSync(filePath); // Can read ../../../../etc/passwd

// ✅ SAFE - Validate and sanitize paths
import path from 'path';

function getSafeDownloadPath(filename: string): string {
  // Remove path separators and relative paths
  const safe = filename.replace(/[\/\\]/g, '_').replace(/\.\./g, '');
  
  // Ensure file stays in downloads directory
  const downloadDir = app.getPath('downloads');
  const fullPath = path.join(downloadDir, safe);
  
  // Double-check resolved path is within downloads
  if (!fullPath.startsWith(downloadDir)) {
    throw new Error('Invalid file path');
  }
  
  return fullPath;
}
```

### 8. XSS Prevention

**React's Built-in Protection**:
```tsx
// ✅ SAFE - React auto-escapes
const userInput = '<script>alert("xss")</script>';
return <div>{userInput}</div>;
// Renders: &lt;script&gt;alert("xss")&lt;/script&gt;

// ❌ DANGEROUS - Bypasses escaping
return <div dangerouslySetInnerHTML={{ __html: userInput }} />;
```

**When You Must Render HTML**:
```typescript
import DOMPurify from 'dompurify';

const sanitized = DOMPurify.sanitize(userHtml, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
  ALLOWED_ATTR: ['href'],
});

return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
```

### 9. SSRF Prevention

**Problem**: User-controlled URLs could access internal services

```typescript
// ❌ VULNERABLE
const imageUrl = userInput; // Could be http://localhost:6379
<img src={imageUrl} />

// ✅ SAFE - Whitelist allowed domains
const ALLOWED_DOMAINS = [
  'image.tmdb.org',
  'cdn.real-debrid.com',
  'img.omdbapi.com',
];

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    
    // Only allow HTTPS
    if (parsed.protocol !== 'https:') {
      return false;
    }
    
    // Check domain whitelist
    return ALLOWED_DOMAINS.some(domain => 
      parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

// Usage
if (!isAllowedUrl(imageUrl)) {
  throw new Error('Invalid image URL');
}
```

### 10. Rate Limiting

**Prevent abuse of IPC channels**:

```typescript
// utils/rate-limiter.ts
class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  
  checkLimit(key: string, maxAttempts: number, windowMs: number): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    
    // Remove old attempts outside window
    const recentAttempts = attempts.filter(time => now - time < windowMs);
    
    if (recentAttempts.length >= maxAttempts) {
      return false; // Rate limit exceeded
    }
    
    recentAttempts.push(now);
    this.attempts.set(key, recentAttempts);
    return true;
  }
}

const rateLimiter = new RateLimiter();

// Usage in IPC handler
ipcMain.handle('torrent:search', async (event, data) => {
  const key = `torrent:search:${event.sender.id}`;
  
  if (!rateLimiter.checkLimit(key, 10, 60000)) {
    throw new Error('Rate limit exceeded. Please wait before searching again.');
  }
  
  // Proceed with search
});
```

### 11. Secure External Communication

```typescript
// Secure axios configuration
const secureClient = axios.create({
  timeout: 10000,
  maxRedirects: 3,
  validateStatus: (status) => status >= 200 && status < 300,
  headers: {
    'User-Agent': 'AstraPlay/1.0',
  },
  httpsAgent: new https.Agent({
    rejectUnauthorized: true,  // Verify SSL certificates
    minVersion: 'TLSv1.2',     // Minimum TLS version
  }),
});

// Certificate pinning (advanced)
const secureClient = axios.create({
  httpsAgent: new https.Agent({
    ca: fs.readFileSync('path/to/ca-cert.pem'),
  }),
});
```

### 12. Update Security

```typescript
// Use electron-updater for secure updates
import { autoUpdater } from 'electron-updater';

autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'your-org',
  repo: 'astraplay',
});

// Verify signatures
autoUpdater.checkForUpdatesAndNotify({
  autoDownload: false,
});

autoUpdater.on('update-available', (info) => {
  // Show notification to user
  // Only download after user confirmation
});

// Auto-update only over HTTPS
// electron-updater verifies code signatures
```

## Security Checklist

### Before Production

- [ ] `nodeIntegration: false` in all BrowserWindows
- [ ] `contextIsolation: true` in all BrowserWindows
- [ ] `sandbox: true` in production builds
- [ ] Strict CSP configured
- [ ] All IPC channels validated with Zod
- [ ] Credentials encrypted with safeStorage or keytar
- [ ] SQL queries use parameterized statements
- [ ] File paths validated against traversal
- [ ] External URLs validated and whitelisted
- [ ] Rate limiting implemented for critical operations
- [ ] HTTPS required for all external APIs
- [ ] Code signing certificate acquired
- [ ] Auto-update configured with signature verification
- [ ] Security audit completed
- [ ] Penetration testing performed

### Regular Maintenance

- [ ] Update Electron regularly (security patches)
- [ ] Update all dependencies (npm audit)
- [ ] Review and rotate API keys
- [ ] Monitor for reported vulnerabilities
- [ ] Review IPC channels for new attack vectors
- [ ] Test CSP effectiveness
- [ ] Audit credential storage

## Common Vulnerabilities to Avoid

### 1. Remote Code Execution (RCE)
**Cause**: Enabling `nodeIntegration` or `remote` module
**Solution**: Never enable these in production

### 2. Cross-Site Scripting (XSS)
**Cause**: Rendering unsanitized user input
**Solution**: Use React's auto-escaping or DOMPurify

### 3. SQL Injection
**Cause**: String concatenation in SQL queries
**Solution**: Always use parameterized queries

### 4. Insecure Updates
**Cause**: HTTP update URLs or no signature verification
**Solution**: Use electron-updater with HTTPS and signatures

### 5. Credential Leakage
**Cause**: Storing API keys in plaintext or version control
**Solution**: Use safeStorage and .gitignore sensitive files

### 6. Path Traversal
**Cause**: Using user input in file paths
**Solution**: Validate and sanitize all paths

### 7. SSRF Attacks
**Cause**: Loading user-controlled URLs
**Solution**: Whitelist allowed domains

## Incident Response

If a security vulnerability is discovered:

1. **Assess Impact**: Determine severity and affected versions
2. **Patch Immediately**: Develop and test fix
3. **Release Update**: Push emergency update
4. **Notify Users**: Inform via in-app notification
5. **Post-Mortem**: Document what went wrong and how to prevent

## Resources

- [Electron Security Checklist](https://www.electronjs.org/docs/latest/tutorial/security)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)

## Conclusion

Security is not a feature—it's a requirement. By following these best practices, AstraPlay maintains a strong security posture that protects both the application and its users.

Remember: **Defense in depth**. Multiple layers of security ensure that even if one fails, others protect the system.
