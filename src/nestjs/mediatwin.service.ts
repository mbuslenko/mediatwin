import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { MediaTwin } from '../mediatwin';
import type { MediaInput, SearchInput, MediaEntry } from '../types/media';
import type { AddResult, SearchResult, BatchOptions, BatchResult, IndexStats } from '../types/results';
import { MEDIATWIN_MODULE_OPTIONS } from './constants';
import type { MediaTwinModuleOptions } from './interfaces';

@Injectable()
export class MediaTwinService implements OnModuleInit, OnModuleDestroy {
  private readonly client: MediaTwin;

  constructor(@Inject(MEDIATWIN_MODULE_OPTIONS) options: MediaTwinModuleOptions) {
    const { isGlobal: _, ...config } = options;
    this.client = new MediaTwin(config);
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.disconnect();
  }

  getClient(): MediaTwin {
    return this.client;
  }

  isConnected(): boolean {
    return this.client.isConnected();
  }

  async add(input: MediaInput): Promise<AddResult> {
    return this.client.add(input);
  }

  async search(input: SearchInput): Promise<SearchResult[]> {
    return this.client.search(input);
  }

  async remove(mediaId: string): Promise<boolean> {
    return this.client.remove(mediaId);
  }

  async get(mediaId: string): Promise<MediaEntry | null> {
    return this.client.get(mediaId);
  }

  async exists(mediaId: string): Promise<boolean> {
    return this.client.exists(mediaId);
  }

  async addBatch(inputs: MediaInput[], options?: BatchOptions): Promise<BatchResult> {
    return this.client.addBatch(inputs, options);
  }

  async rebuildIndex(): Promise<void> {
    return this.client.rebuildIndex();
  }

  async getStats(): Promise<IndexStats> {
    return this.client.getStats();
  }
}
