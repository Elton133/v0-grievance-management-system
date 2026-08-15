import { AsyncLocalStorage } from "node:async_hooks";

type TenantContext = {
  organizationId: string;
  organizationSlug: string;
  bypassTenantScope?: boolean;
};

const storage = new AsyncLocalStorage<TenantContext>();

export function runWithTenant<T>(context: TenantContext, callback: () => T): T {
  return storage.run(context, callback);
}

export function currentTenant(): TenantContext | undefined {
  return storage.getStore();
}

export function runWithoutTenantScope<T>(callback: () => T): T {
  return storage.run({ organizationId: "platform", organizationSlug: "platform", bypassTenantScope: true }, callback);
}
