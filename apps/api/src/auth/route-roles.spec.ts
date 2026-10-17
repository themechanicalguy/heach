import type { DynamicModule, Type } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { AppModule } from '../app.module.js';
import { PUBLIC_KEY, ROLES_KEY } from './roles.decorator.js';

type ModuleRef = Type | DynamicModule;

function controllersOf(module: ModuleRef, seen = new Set<unknown>()): Type[] {
  const type = 'module' in module ? module.module : module;
  if (seen.has(type)) {
    return [];
  }
  seen.add(type);
  const dynamic: Partial<DynamicModule> = 'module' in module ? module : {};
  const own = [
    ...((Reflect.getMetadata('controllers', type) as Type[] | undefined) ?? []),
    ...(dynamic.controllers ?? []),
  ];
  const imports = [
    ...((Reflect.getMetadata('imports', type) as ModuleRef[] | undefined) ?? []),
    ...((dynamic.imports ?? []) as ModuleRef[]),
  ];
  return [...own, ...imports.flatMap((child) => controllersOf(child, seen))];
}

function routes(controller: Type): { name: string; declared: boolean }[] {
  const proto = controller.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(proto)
    .filter(
      (key) =>
        typeof proto[key] === 'function' &&
        Reflect.hasMetadata(METHOD_METADATA, proto[key] as object),
    )
    .map((key) => {
      const handler = proto[key] as object;
      const declared = [ROLES_KEY, PUBLIC_KEY].some(
        (meta) => Reflect.hasMetadata(meta, handler) || Reflect.hasMetadata(meta, controller),
      );
      return {
        name: `${controller.name}.${key} ${String(Reflect.getMetadata(PATH_METADATA, handler))}`,
        declared,
      };
    });
}

describe('Route table', () => {
  it('SE-02.1 every route declares its allowed roles or is explicitly public', () => {
    const all = controllersOf(AppModule.forEnv('test')).flatMap(routes);
    expect(all.length).toBeGreaterThan(5);
    expect(all.filter((route) => !route.declared).map((route) => route.name)).toEqual([]);
  });
});
