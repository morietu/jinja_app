export interface TokenStore {
  get(): Promise<string | null>;
  set(token: string | null): Promise<void>;
}
