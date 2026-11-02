import { t } from '../../i18n';
import { has } from '../../sim/tutorial';
import { useGame, useStore } from '../../store/hooks';
import { CraftPanel, craftableCount } from '../scenes/CraftPanel';
import { useUi, type SideTab } from '../ui';
import { Inventory } from './Inventory';
import { LogView } from './LogView';
import { Tabs, type TabDef } from './Tabs';

/** 制作标签的文字：能做几样就显示几 */
export function useCraftLabel(): string {
  const g = useGame();
  if (g.newRecipes.length) return t('ui.tab.craftNew');
  const n = craftableCount(g);
  return n > 0 ? t('ui.tab.craftN', { n }) : t('ui.tab.craft');
}

/** 切到制作页时，把“新配方”标记清掉 */
function useSetTab() {
  const ui = useUi();
  const store = useStore();
  const g = useGame();
  return (id: string) => {
    ui.setSideTab(id as SideTab);
    if (id === 'craft' && g.newRecipes.length) store.dispatch({ t: 'seenRecipes' });
  };
}

/** 桌面右栏：物品 / 制作 */
export function SidePanel() {
  const g = useGame();
  const ui = useUi();
  const craftLabel = useCraftLabel();
  const setTab = useSetTab();
  if (!has(g, 'craft')) return <Inventory />;
  const tab = ui.sideTab === 'craft' ? 'craft' : 'items';
  return (
    <div style={{ flex: '1 1 320px', minWidth: 0 }}>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'items', label: t('ui.tab.items'), node: <Inventory /> },
          { id: 'craft', label: craftLabel, node: <CraftPanel /> },
        ]}
      />
    </div>
  );
}

/** 手机底部标签：可选的“岛上”页 + 物品 + 制作 + 日志 */
export function MobileTabs({ island }: { island?: TabDef }) {
  const g = useGame();
  const ui = useUi();
  const craftLabel = useCraftLabel();
  const setTab = useSetTab();
  const tabs: TabDef[] = [];
  if (island) tabs.push(island);
  tabs.push({ id: 'items', label: t('ui.tab.items'), node: <Inventory /> });
  if (has(g, 'craft')) tabs.push({ id: 'craft', label: craftLabel, node: <CraftPanel /> });
  tabs.push({ id: 'log', label: t('ui.tab.log'), node: <LogView count={10} big={false} /> });
  const value = tabs.some((x) => x.id === ui.sideTab) ? ui.sideTab : tabs[0].id;
  return <Tabs tabs={tabs} value={value} onChange={setTab} />;
}
