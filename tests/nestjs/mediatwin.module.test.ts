import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { MediaTwinModule, MediaTwinService, MEDIATWIN_MODULE_OPTIONS } from '../../src/nestjs';

vi.mock('../../src/mediatwin', () => {
  const MockMediaTwin = vi.fn(function (this: Record<string, unknown>) {
    this.connect = vi.fn().mockResolvedValue(undefined);
    this.disconnect = vi.fn().mockResolvedValue(undefined);
    this.isConnected = vi.fn().mockReturnValue(true);
    this.add = vi.fn().mockResolvedValue({ mediaId: 'test', hashes: {}, processingTime: 0 });
    this.search = vi.fn().mockResolvedValue([]);
    this.remove = vi.fn().mockResolvedValue(true);
    this.get = vi.fn().mockResolvedValue(null);
    this.exists = vi.fn().mockResolvedValue(false);
    this.addBatch = vi.fn().mockResolvedValue({ successful: [], failed: [], totalTime: 0 });
    this.rebuildIndex = vi.fn().mockResolvedValue(undefined);
    this.getStats = vi.fn().mockResolvedValue({
      totalMedia: 0,
      imageCount: 0,
      videoCount: 0,
      hashCounts: {},
      storageSizeBytes: 0,
    });
  });
  return { MediaTwin: MockMediaTwin };
});

const testOptions = {
  redis: 'redis://localhost:6379',
  namespace: 'test',
};

describe('MediaTwinModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('forRoot', () => {
    it('should provide MediaTwinService', async () => {
      const module = await Test.createTestingModule({
        imports: [MediaTwinModule.forRoot(testOptions)],
      }).compile();

      const service = module.get(MediaTwinService);
      expect(service).toBeInstanceOf(MediaTwinService);
    });

    it('should provide the options token', async () => {
      const module = await Test.createTestingModule({
        imports: [MediaTwinModule.forRoot(testOptions)],
      }).compile();

      const options = module.get(MEDIATWIN_MODULE_OPTIONS);
      expect(options).toEqual(testOptions);
    });

    it('should call connect on module init', async () => {
      const module = await Test.createTestingModule({
        imports: [MediaTwinModule.forRoot(testOptions)],
      }).compile();

      const service = module.get(MediaTwinService);
      await module.init();

      const client = service.getClient();
      expect(client.connect).toHaveBeenCalled();
    });

    it('should call disconnect on module destroy', async () => {
      const module = await Test.createTestingModule({
        imports: [MediaTwinModule.forRoot(testOptions)],
      }).compile();

      const service = module.get(MediaTwinService);
      await module.init();
      await module.close();

      const client = service.getClient();
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('should proxy methods to the underlying client', async () => {
      const module = await Test.createTestingModule({
        imports: [MediaTwinModule.forRoot(testOptions)],
      }).compile();

      const service = module.get(MediaTwinService);
      const client = service.getClient();

      expect(service.isConnected()).toBe(true);
      expect(client.isConnected).toHaveBeenCalled();

      await service.search({ source: Buffer.from('test'), threshold: 10 });
      expect(client.search).toHaveBeenCalled();

      await service.remove('test-id');
      expect(client.remove).toHaveBeenCalledWith('test-id');

      await service.get('test-id');
      expect(client.get).toHaveBeenCalledWith('test-id');

      await service.exists('test-id');
      expect(client.exists).toHaveBeenCalledWith('test-id');

      await service.rebuildIndex();
      expect(client.rebuildIndex).toHaveBeenCalled();

      await service.getStats();
      expect(client.getStats).toHaveBeenCalled();
    });
  });

  describe('forRootAsync', () => {
    it('should provide MediaTwinService with async factory', async () => {
      const module = await Test.createTestingModule({
        imports: [
          MediaTwinModule.forRootAsync({
            useFactory: () => testOptions,
          }),
        ],
      }).compile();

      const service = module.get(MediaTwinService);
      expect(service).toBeInstanceOf(MediaTwinService);
    });

    it('should support async factory function', async () => {
      const module = await Test.createTestingModule({
        imports: [
          MediaTwinModule.forRootAsync({
            useFactory: async () => {
              return { ...testOptions, namespace: 'async-test' };
            },
          }),
        ],
      }).compile();

      const options = module.get(MEDIATWIN_MODULE_OPTIONS);
      expect(options.namespace).toBe('async-test');
    });

    it('should support inject tokens', async () => {
      const CONFIG_TOKEN = 'CONFIG_TOKEN';

      const configModule = {
        module: class ConfigModule {},
        providers: [{ provide: CONFIG_TOKEN, useValue: 'redis://injected:6379' }],
        exports: [CONFIG_TOKEN],
        global: true,
      };

      const module = await Test.createTestingModule({
        imports: [
          configModule as any,
          MediaTwinModule.forRootAsync({
            useFactory: (redisUrl: string) => ({
              redis: redisUrl,
              namespace: 'injected',
            }),
            inject: [CONFIG_TOKEN],
          }),
        ],
      }).compile();

      const options = module.get(MEDIATWIN_MODULE_OPTIONS);
      expect(options.redis).toBe('redis://injected:6379');
      expect(options.namespace).toBe('injected');
    });
  });
});
