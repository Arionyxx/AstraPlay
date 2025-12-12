import type { Provider, ScraperProvider, DebridProvider } from '../../src/types/provider';
import { LimeTorrentsScraperProvider } from './scrapers/limetorrents-scraper';
import { RealDebridProvider } from './debrid/real-debrid';

export class ProviderManager {
  private static instance: ProviderManager;
  private providers: Map<string, Provider> = new Map();
  private scrapers: Map<string, ScraperProvider> = new Map();
  private debridProviders: Map<string, DebridProvider> = new Map();

  private constructor() {
    this.registerDefaultProviders();
  }

  public static getInstance(): ProviderManager {
    if (!ProviderManager.instance) {
      ProviderManager.instance = new ProviderManager();
    }
    return ProviderManager.instance;
  }

  private registerDefaultProviders(): void {
    const limetorrents = new LimeTorrentsScraperProvider();
    const realDebrid = new RealDebridProvider();

    this.registerProvider(limetorrents);
    this.registerProvider(realDebrid);
  }

  public registerProvider(provider: Provider): void {
    this.providers.set(provider.id, provider);

    if (provider.type === 'scraper') {
      this.scrapers.set(provider.id, provider as ScraperProvider);
    } else if (provider.type === 'debrid') {
      this.debridProviders.set(provider.id, provider as DebridProvider);
    }

    console.log(`[ProviderManager] Registered provider: ${provider.name} (${provider.id})`);
  }

  public getProvider(id: string): Provider | undefined {
    return this.providers.get(id);
  }

  public getScraper(id: string): ScraperProvider | undefined {
    return this.scrapers.get(id);
  }

  public getDebridProvider(id: string): DebridProvider | undefined {
    return this.debridProviders.get(id);
  }

  public getAllProviders(): Provider[] {
    return Array.from(this.providers.values());
  }

  public getAllScrapers(): ScraperProvider[] {
    return Array.from(this.scrapers.values());
  }

  public getAllDebridProviders(): DebridProvider[] {
    return Array.from(this.debridProviders.values());
  }

  public async initializeAll(): Promise<void> {
    console.log('[ProviderManager] Initializing all providers...');
    
    const promises = Array.from(this.providers.values()).map(async (provider) => {
      try {
        await provider.initialize();
        console.log(`[ProviderManager] Initialized ${provider.name}`);
      } catch (error) {
        console.error(`[ProviderManager] Failed to initialize ${provider.name}:`, error);
      }
    });

    await Promise.all(promises);
    console.log('[ProviderManager] All providers initialized');
  }

  public async shutdownAll(): Promise<void> {
    console.log('[ProviderManager] Shutting down all providers...');
    
    const promises = Array.from(this.providers.values()).map(async (provider) => {
      try {
        await provider.shutdown();
      } catch (error) {
        console.error(`[ProviderManager] Failed to shutdown ${provider.name}:`, error);
      }
    });

    await Promise.all(promises);
    console.log('[ProviderManager] All providers shut down');
  }
}
