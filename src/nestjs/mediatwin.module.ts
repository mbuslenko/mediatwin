import { DynamicModule, Module } from '@nestjs/common';
import { MEDIATWIN_MODULE_OPTIONS } from './constants';
import type { MediaTwinModuleOptions, MediaTwinModuleAsyncOptions } from './interfaces';
import { MediaTwinService } from './mediatwin.service';

@Module({})
export class MediaTwinModule {
  static forRoot(options: MediaTwinModuleOptions): DynamicModule {
    return {
      module: MediaTwinModule,
      global: options.isGlobal ?? false,
      providers: [
        {
          provide: MEDIATWIN_MODULE_OPTIONS,
          useValue: options,
        },
        MediaTwinService,
      ],
      exports: [MediaTwinService],
    };
  }

  static forRootAsync(options: MediaTwinModuleAsyncOptions): DynamicModule {
    return {
      module: MediaTwinModule,
      global: options.isGlobal ?? false,
      imports: options.imports || [],
      providers: [
        {
          provide: MEDIATWIN_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        MediaTwinService,
      ],
      exports: [MediaTwinService],
    };
  }
}
