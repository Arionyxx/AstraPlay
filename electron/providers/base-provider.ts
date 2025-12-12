import type { Provider, ProviderType } from '../../src/types/provider';

export abstract class BaseProvider implements Provider {
  public readonly id: string;
  public readonly name: string;
  public readonly type: ProviderType;
  public readonly version: string;
  public enabled: boolean = false;

  constructor(
    id: string,
    name: string,
    type: ProviderType,
    version: string = '1.0.0'
  ) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.version = version;
  }

  abstract initialize(): Promise<void>;
  abstract shutdown(): Promise<void>;

  protected async handleError(error: unknown, context: string): Promise<never> {
    console.error(`[${this.name}] Error in ${context}:`, error);
    throw error instanceof Error ? error : new Error(String(error));
  }

  protected log(message: string, ...args: unknown[]): void {
    console.log(`[${this.name}]`, message, ...args);
  }

  protected warn(message: string, ...args: unknown[]): void {
    console.warn(`[${this.name}]`, message, ...args);
  }
}
