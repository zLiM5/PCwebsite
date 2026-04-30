import Image from "next/image";
import manifest from "../../../public/game-ui/warrior-select/manifest.json";
import { ComponentStatePreview, WarriorSelectScreen } from "@/components/warrior-ui";

const layerNames: Record<string, string> = {
  background: "背景层",
  "top-title": "顶部标题层",
  "left-list": "左侧筛选与列表",
  profile: "中央武将详情",
  attributes: "右侧属性面板",
  "bottom-actions": "底部操作",
};

export const metadata = {
  title: "武将选择 UI 素材拆分",
  description: "Godot 4 可用的武将选择界面分层素材包与 Next 预览页",
};

export default function WarriorSelectPreviewPage() {
  const assetsByLayer = manifest.assets.reduce<Record<string, typeof manifest.assets>>((groups, item) => {
    groups[item.layer] ??= [];
    groups[item.layer].push(item);
    return groups;
  }, {});

  return (
    <main className="min-h-dvh bg-[#090908] text-stone-100">
      <section className="mx-auto max-w-[1800px] px-5 py-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-semibold tracking-[0] text-[#c2964d]">武将选择界面分层素材</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-400">
              资源按 Godot 4 控件使用方式拆分：可变文案保持动态文本，面板和按钮带九宫格边距，截图裁切层作为人物、背景、头像和技能参考素材。
            </p>
          </div>
          <a
            href="/game-ui/warrior-select/manifest.json"
            className="inline-flex h-9 items-center rounded border border-[#8b6a34] px-3 text-sm text-[#d4b16d] transition hover:bg-[#8b6a34]/15"
          >
            manifest.json
          </a>
        </div>

        <WarriorSelectScreen />
      </section>

      <section className="mx-auto max-w-[1280px] px-5 py-8">
        <h2 className="mb-4 font-serif text-2xl font-semibold tracking-[0] text-[#c2964d]">组件状态预览</h2>
        <ComponentStatePreview />
      </section>

      <section className="mx-auto max-w-[1280px] px-5 pb-12">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-2xl font-semibold tracking-[0] text-[#c2964d]">素材层级清单</h2>
            <p className="mt-2 text-sm text-stone-400">共 {manifest.assets.length} 个条目，每个条目都带 Godot 节点建议、尺寸和动态文本策略。</p>
          </div>
          <div className="rounded border border-stone-700 px-3 py-2 text-xs leading-5 text-stone-400">
            Source: {manifest.source_size.width} × {manifest.source_size.height}
          </div>
        </div>

        <div className="space-y-8">
          {Object.entries(assetsByLayer).map(([layer, items]) => (
            <section key={layer}>
              <h3 className="mb-3 border-b border-stone-800 pb-2 text-lg font-semibold text-stone-200">{layerNames[layer] ?? layer}</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((item) => (
                  <article key={item.id} className="rounded-lg border border-stone-800 bg-stone-950/80 p-3">
                    <div className="relative grid aspect-[16/9] place-items-center overflow-hidden rounded border border-stone-800 bg-[linear-gradient(45deg,#171613_25%,#11100e_25%,#11100e_50%,#171613_50%,#171613_75%,#11100e_75%)] bg-[length:18px_18px]">
                      <Image
                        src={item.path}
                        alt={item.usage}
                        width={item.size.width}
                        height={item.size.height}
                        sizes="240px"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div className="mt-3 space-y-1">
                      <h4 className="truncate text-sm font-semibold text-stone-100">{item.id}</h4>
                      <p className="min-h-10 text-xs leading-5 text-stone-400">{item.usage}</p>
                      <div className="flex flex-wrap gap-2 text-[11px] text-stone-500">
                        <span>{item.kind}</span>
                        <span>{item.size.width}×{item.size.height}</span>
                        <span>{item.godot_node}</span>
                      </div>
                      {item.nine_patch_margin ? (
                        <p className="text-[11px] text-[#c2964d]">
                          nine-patch: {item.nine_patch_margin.left}/{item.nine_patch_margin.top}/{item.nine_patch_margin.right}/{item.nine_patch_margin.bottom}
                        </p>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
