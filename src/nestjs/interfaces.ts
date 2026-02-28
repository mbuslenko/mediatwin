import type { InjectionToken, ModuleMetadata, OptionalFactoryDependency } from '@nestjs/common';
import type { MediaTwinConfig } from '../types/config';

export interface MediaTwinModuleOptions extends MediaTwinConfig {
  isGlobal?: boolean;
}

export interface MediaTwinModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  isGlobal?: boolean;
  useFactory: (...args: any[]) => MediaTwinModuleOptions | Promise<MediaTwinModuleOptions>;
  inject?: Array<InjectionToken | OptionalFactoryDependency>;
}
