import { registerPlugin } from '@capacitor/core';

import type { IronvaultIapPlugin } from './definitions';

const IronvaultIap = registerPlugin<IronvaultIapPlugin>('IronvaultIap', {
  web: () => import('./web').then(m => new m.IronvaultIapWeb()),
});

export * from './definitions';
export { IronvaultIap };
