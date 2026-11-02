// 本地化消息：模拟层只产出“键 + 参数”，由界面按当前语言渲染。
import type { ItemId } from '../config/items';

export type Stockish = Partial<Record<ItemId, number>>;
export type Param = string | number | Msg | { stock: Stockish } | { list: Msg[] };

export interface Msg {
  k: string;
  p?: Record<string, Param>;
}

export function m(k: string, p?: Record<string, Param>): Msg {
  return p ? { k, p } : { k };
}

export const itemM = (id: ItemId): Msg => ({ k: 'item.' + id });
export const islandM = (id: string): Msg => ({ k: 'island.' + id });
export const roleM = (role: string): Msg => ({ k: 'role.' + role });
export const recipeM = (id: string): Msg => ({ k: 'recipe.' + id });
export const stockP = (s: Stockish): { stock: Stockish } => ({ stock: { ...s } });
