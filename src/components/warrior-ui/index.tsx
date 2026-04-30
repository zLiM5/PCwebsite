import clsx from "clsx";
import Image from "next/image";
import type { CSSProperties } from "react";

const asset = {
  backgroundPaper: "/game-ui/warrior-select/layers/background/ink-paper-crop.png",
  bottomSmoke: "/game-ui/warrior-select/layers/background/bottom-smoke-crop.png",
  heroCharacter: "/game-ui/warrior-select/layers/background/hero-character-crop.png",
  leftPanel: "/game-ui/warrior-select/components/panels/left-list-panel.svg",
  rightPanel: "/game-ui/warrior-select/components/panels/right-attribute-panel.svg",
  profilePanel: "/game-ui/warrior-select/components/panels/profile-paper-panel.svg",
  rowNormal: "/game-ui/warrior-select/components/list/general-row-normal.svg",
  rowSelected: "/game-ui/warrior-select/components/list/general-row-selected.svg",
  sortBadge: "/game-ui/warrior-select/components/list/general-sort-badge.svg",
  avatarFrame: "/game-ui/warrior-select/components/list/avatar-mask-frame.svg",
  scrollbarTrack: "/game-ui/warrior-select/components/list/scrollbar-track.svg",
  scrollbarThumb: "/game-ui/warrior-select/components/list/scrollbar-thumb.svg",
  dropdown: "/game-ui/warrior-select/components/dropdown/ink-dropdown-bg.svg",
  caret: "/game-ui/warrior-select/components/dropdown/caret.svg",
  brushPrimary: "/game-ui/warrior-select/components/buttons/brush-primary.svg",
  returnButton: "/game-ui/warrior-select/components/buttons/return-button.svg",
  tagButton: "/game-ui/warrior-select/components/buttons/tag-button.svg",
  detailButton: "/game-ui/warrior-select/components/buttons/detail-button.svg",
  titleLeft: "/game-ui/warrior-select/components/icons/title-ornament-left.svg",
  titleRight: "/game-ui/warrior-select/components/icons/title-ornament-right.svg",
  factionWei: "/game-ui/warrior-select/components/icons/faction-wei.svg",
  help: "/game-ui/warrior-select/components/icons/help.svg",
  traitFrame: "/game-ui/warrior-select/components/icons/trait-frame.svg",
  skillFrame: "/game-ui/warrior-select/components/icons/skill-frame.svg",
  statTrack: "/game-ui/warrior-select/components/stat-bars/stat-track.svg",
  statFill: "/game-ui/warrior-select/components/stat-bars/stat-fill.svg",
};

const statIcons = {
  leadership: "/game-ui/warrior-select/components/icons/stat-leadership.svg",
  attack: "/game-ui/warrior-select/components/icons/stat-attack.svg",
  intellect: "/game-ui/warrior-select/components/icons/stat-intellect.svg",
  politics: "/game-ui/warrior-select/components/icons/stat-politics.svg",
  charm: "/game-ui/warrior-select/components/icons/stat-charm.svg",
};

const unitIcons = {
  infantry: "/game-ui/warrior-select/components/icons/unit-infantry.svg",
  cavalry: "/game-ui/warrior-select/components/icons/unit-cavalry.svg",
  archer: "/game-ui/warrior-select/components/icons/unit-archer.svg",
  spear: "/game-ui/warrior-select/components/icons/unit-spear.svg",
  siege: "/game-ui/warrior-select/components/icons/unit-siege.svg",
};

type General = {
  name: string;
  faction: string;
  portrait: string;
  stats: string;
};

const generals: General[] = [
  { name: "曹操", faction: "魏", portrait: "/game-ui/warrior-select/layers/portraits/portrait-01.png", stats: "统帅 97　武力 72　智力 91　政治 94　魅力 96" },
  { name: "夏侯惇", faction: "魏", portrait: "/game-ui/warrior-select/layers/portraits/portrait-02.png", stats: "统帅 92　武力 88　智力 42　政治 48　魅力 71" },
  { name: "夏侯渊", faction: "魏", portrait: "/game-ui/warrior-select/layers/portraits/portrait-03.png", stats: "统帅 84　武力 86　智力 40　政治 36　魅力 68" },
  { name: "张辽", faction: "魏", portrait: "/game-ui/warrior-select/layers/portraits/portrait-04.png", stats: "统帅 90　武力 89　智力 72　政治 55　魅力 73" },
  { name: "司马懿", faction: "魏", portrait: "/game-ui/warrior-select/layers/portraits/portrait-05.png", stats: "统帅 91　武力 42　智力 97　政治 92　魅力 78" },
  { name: "许褚", faction: "魏", portrait: "/game-ui/warrior-select/layers/portraits/portrait-06.png", stats: "统帅 62　武力 96　智力 22　政治 18　魅力 42" },
  { name: "荀彧", faction: "魏", portrait: "/game-ui/warrior-select/layers/portraits/portrait-07.png", stats: "统帅 55　武力 29　智力 95　政治 97　魅力 90" },
  { name: "郭嘉", faction: "魏", portrait: "/game-ui/warrior-select/layers/portraits/portrait-08.png", stats: "统帅 62　武力 22　智力 98　政治 78　魅力 85" },
  { name: "刘备", faction: "蜀", portrait: "/game-ui/warrior-select/layers/portraits/portrait-09.png", stats: "统帅 78　武力 68　智力 75　政治 70　魅力 99" },
  { name: "关羽", faction: "蜀", portrait: "/game-ui/warrior-select/layers/portraits/portrait-10.png", stats: "统帅 92　武力 97　智力 76　政治 62　魅力 93" },
  { name: "张飞", faction: "蜀", portrait: "/game-ui/warrior-select/layers/portraits/portrait-11.png", stats: "统帅 78　武力 98　智力 30　政治 22　魅力 55" },
];

const attributes = [
  { label: "统率", value: 97, icon: statIcons.leadership },
  { label: "武力", value: 72, icon: statIcons.attack },
  { label: "智力", value: 91, icon: statIcons.intellect },
  { label: "政治", value: 94, icon: statIcons.politics },
  { label: "魅力", value: 96, icon: statIcons.charm },
];

const units = [
  { label: "步兵", grade: "S", icon: unitIcons.infantry },
  { label: "骑兵", grade: "A", icon: unitIcons.cavalry },
  { label: "弓兵", grade: "S", icon: unitIcons.archer },
  { label: "枪兵", grade: "A", icon: unitIcons.spear },
  { label: "攻城", grade: "B", icon: unitIcons.siege },
];

const skills = [
  { name: "魏武之世", image: "/game-ui/warrior-select/layers/skills/skill-01.png" },
  { name: "挟天子令诸侯", image: "/game-ui/warrior-select/layers/skills/skill-02.png" },
  { name: "文韬武略", image: "/game-ui/warrior-select/layers/skills/skill-03.png" },
  { name: "屯田令", image: "/game-ui/warrior-select/layers/skills/skill-04.png" },
];

function texture(pathname: string): CSSProperties {
  return {
    backgroundImage: `url(${pathname})`,
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "100% 100%",
  };
}

function AssetImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return <Image src={src} alt={alt} fill sizes="220px" className={clsx("object-contain", className)} />;
}

export function InkDropdown({ label, disabled = false }: { label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="relative h-8 w-40 px-4 text-left text-[13px] text-stone-200 transition hover:brightness-125 disabled:opacity-45"
      style={texture(asset.dropdown)}
    >
      <span>{label}</span>
      <span className="absolute right-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2" style={texture(asset.caret)} />
    </button>
  );
}

export function GeneralListItem({ general, selected = false }: { general: General; selected?: boolean }) {
  return (
    <article className="relative h-[70px] w-[342px] overflow-hidden px-2 py-[6px]" style={texture(selected ? asset.rowSelected : asset.rowNormal)}>
      <div className="absolute left-[7px] top-[6px] h-[58px] w-[72px] overflow-hidden">
        <Image src={general.portrait} alt={`${general.name} portrait`} fill sizes="72px" className="object-cover" />
      </div>
      <div className="absolute left-[5px] top-[4px] h-[62px] w-[76px]" style={texture(asset.avatarFrame)} />
      <div className="ml-[92px] flex h-full min-w-0 flex-col justify-center">
        <div className="flex items-center gap-2">
          <h3 className="text-[18px] font-semibold leading-none tracking-[0] text-stone-100">{general.name}</h3>
          <span className="text-[13px] text-stone-300">[{general.faction}]</span>
        </div>
        <p className="mt-2 truncate text-[11px] leading-none text-stone-400">{general.stats}</p>
      </div>
      {selected ? (
        <div className="absolute right-[10px] top-[10px] grid h-[30px] w-[51px] place-items-center text-[12px] text-[#c59a49]" style={texture(asset.sortBadge)}>
          排序
        </div>
      ) : null}
    </article>
  );
}

export function GeneralListPanel() {
  return (
    <section className="absolute left-[28px] top-[99px] h-[792px] w-[354px] px-[6px] py-[4px]" style={texture(asset.leftPanel)} aria-label="武将列表">
      <div className="flex h-full flex-col gap-[4px] overflow-hidden">
        {generals.map((general, index) => (
          <GeneralListItem key={general.name} general={general} selected={index === 0} />
        ))}
      </div>
      <div className="absolute right-[-10px] top-0 h-[782px] w-[6px]" style={texture(asset.scrollbarTrack)} />
      <div className="absolute right-[-10px] top-[8px] h-[84px] w-[6px]" style={texture(asset.scrollbarThumb)} />
    </section>
  );
}

export function SkillIcon({ skill }: { skill: (typeof skills)[number] }) {
  return (
    <div className="flex w-[70px] flex-col items-center gap-2 text-center">
      <div className="relative h-16 w-16">
        <span className="absolute inset-0" style={texture(asset.skillFrame)} />
        <Image src={skill.image} alt={skill.name} fill sizes="64px" className="rounded-full object-cover p-[4px] grayscale" />
      </div>
      <span className="text-[12px] leading-tight text-stone-300">{skill.name}</span>
    </div>
  );
}

export function StatBar({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="grid grid-cols-[26px_44px_30px_1fr] items-center gap-2 text-stone-200">
      <span className="relative h-6 w-6">
        <AssetImage src={icon} alt={`${label} icon`} />
      </span>
      <span className="text-[17px] leading-none">{label}</span>
      <span className="text-right text-[14px] text-stone-200">{value}</span>
      <span className="relative block h-2 w-[168px]" style={texture(asset.statTrack)}>
        <span className="absolute left-0 top-0 h-2" style={{ ...texture(asset.statFill), width: `${value}%` }} />
      </span>
    </div>
  );
}

export function AttributePanel() {
  return (
    <aside className="absolute left-[1328px] top-[311px] h-[548px] w-[342px] px-6 py-7 text-stone-200" style={texture(asset.rightPanel)}>
      <div className="mb-5 flex items-center gap-2">
        <h2 className="text-[17px] font-semibold text-[#bf9651]">武将属性</h2>
        <span className="relative h-[18px] w-[18px]">
          <AssetImage src={asset.help} alt="help" />
        </span>
      </div>
      <div className="space-y-[12px]">
        {attributes.map((item) => (
          <StatBar key={item.label} {...item} />
        ))}
      </div>
      <h3 className="mt-7 text-[17px] font-semibold text-[#bf9651]">兵种适性</h3>
      <div className="mt-4 grid grid-cols-3 gap-x-6 gap-y-4">
        {units.map((unit) => (
          <div key={unit.label} className="flex items-center gap-2">
            <span className="relative h-6 w-6">
              <AssetImage src={unit.icon} alt={`${unit.label} icon`} />
            </span>
            <span className="text-[15px]">{unit.label}</span>
            <strong className="text-[15px] text-stone-100">{unit.grade}</strong>
          </div>
        ))}
      </div>
      <h3 className="mt-8 text-[17px] font-semibold text-[#bf9651]">初始技能</h3>
      <div className="mt-5 flex justify-between">
        {skills.map((skill) => (
          <SkillIcon key={skill.name} skill={skill} />
        ))}
      </div>
    </aside>
  );
}

export function WarriorProfilePanel() {
  const traits = [
    ["奸雄", "提高自身统率，并在击败敌方部队后提升士气。"],
    ["魏武之世", "我方部队攻击时有几率获得额外行动力。"],
    ["屯田令", "在己方领地内可建造屯田，提升资源产量。"],
  ];

  return (
    <section className="absolute left-[470px] top-[203px] h-[430px] w-[500px] text-[#1d1c18]">
      <div className="absolute inset-x-0 top-[70px] h-[412px] w-[470px] opacity-80" style={texture(asset.profilePanel)} />
      <div className="relative">
        <div className="flex items-center gap-4">
          <h1 className="font-serif text-[62px] font-bold leading-none tracking-[0]">曹操</h1>
          <span className="relative mt-4 h-9 w-9" style={texture(asset.factionWei)} />
        </div>
        <p className="mt-5 text-[16px] leading-8 text-stone-700">乱世之枭雄</p>
        <p className="text-[16px] leading-8 text-stone-700">宁教我负天下人，休教天下人负我。</p>
        <div className="mt-3 flex gap-2">
          {["奸雄", "诗人", "政治家", "军事家"].map((tag) => (
            <span key={tag} className="grid h-7 w-14 place-items-center text-[13px] text-stone-800" style={texture(asset.tagButton)}>
              {tag}
            </span>
          ))}
        </div>
        <h2 className="mt-10 border-b border-stone-800/30 pb-2 text-[17px] font-semibold">武将特性</h2>
        <div className="mt-4 space-y-4">
          {traits.map(([title, text]) => (
            <div key={title} className="grid grid-cols-[54px_1fr] gap-4">
              <span className="h-[54px] w-[54px]" style={texture(asset.traitFrame)} />
              <span>
                <strong className="block text-[15px]">{title}</strong>
                <span className="mt-1 block text-[13px] leading-6 text-stone-700">{text}</span>
              </span>
            </div>
          ))}
        </div>
        <button type="button" className="mt-5 h-[31px] w-[84px] text-[13px] text-stone-200 hover:brightness-125" style={texture(asset.detailButton)}>
          查看详情
        </button>
      </div>
    </section>
  );
}

export function BrushButton({ disabled = false }: { disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="absolute left-[590px] top-[815px] h-[82px] w-[492px] text-[29px] tracking-[0] text-[#c2964d] transition hover:brightness-125 disabled:opacity-45"
      style={texture(asset.brushPrimary)}
    >
      开始游戏
    </button>
  );
}

export function WarriorSelectScreen() {
  return (
    <div className="relative mx-auto aspect-[1672/941] w-full max-w-[1672px] overflow-hidden bg-[#10100e] text-stone-100 shadow-2xl ring-1 ring-stone-600/30" style={{ containerType: "inline-size" }}>
      <div className="absolute left-0 top-0 h-[941px] w-[1672px] origin-top-left" style={{ transform: "scale(calc(100cqw / 1672px))" }}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_48%_44%,#eeeee8_0,#d8d8d2_28%,#65645d_53%,#0d0d0c_100%)]" />
      <div className="absolute left-[388px] top-[57px] h-[824px] w-[945px] opacity-65 mix-blend-luminosity" style={texture(asset.backgroundPaper)} />
      <div className="absolute left-[716px] top-[58px] h-[804px] w-[650px]" style={texture(asset.heroCharacter)} />
      <div className="absolute left-[394px] top-[770px] h-[130px] w-[936px] opacity-80" style={texture(asset.bottomSmoke)} />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,.82)_0,rgba(0,0,0,.22)_25%,rgba(0,0,0,0)_50%,rgba(0,0,0,.42)_100%)]" />
      <div className="absolute left-[415px] top-[175px] h-[570px] w-[560px] bg-[radial-gradient(circle_at_28%_40%,rgba(232,232,226,.82),rgba(226,226,219,.72)_38%,rgba(225,225,218,.38)_67%,rgba(225,225,218,0)_100%)] backdrop-blur-[2px]" />
      <div className="absolute inset-x-0 top-0 h-[116px] bg-[linear-gradient(180deg,rgba(0,0,0,.88),rgba(0,0,0,0))]" />
      <div className="absolute inset-x-0 bottom-0 h-[110px] bg-[linear-gradient(0deg,rgba(0,0,0,.9),rgba(0,0,0,0))]" />

      <div className="absolute left-[650px] top-[24px] flex items-center gap-5">
        <span className="h-[14px] w-[74px]" style={texture(asset.titleLeft)} />
        <h2 className="font-serif text-[29px] font-semibold tracking-[0] text-[#bd8f45]">选择你要扮演的武将</h2>
        <span className="h-[14px] w-[74px]" style={texture(asset.titleRight)} />
      </div>

      <div className="absolute left-[28px] top-[57px] flex gap-3">
        <InkDropdown label="全部势力" />
        <InkDropdown label="默认排序" />
      </div>
      <GeneralListPanel />
      <WarriorProfilePanel />
      <AttributePanel />
      <BrushButton />
      <button type="button" className="absolute left-[1540px] top-[862px] h-9 w-[82px] text-[17px] text-stone-200 hover:brightness-125" style={texture(asset.returnButton)}>
        返回
      </button>
      </div>
    </div>
  );
}

export function ComponentStatePreview() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-lg border border-stone-700/70 bg-stone-950/80 p-4">
        <h3 className="mb-4 text-sm font-semibold text-[#c2964d]">列表项状态</h3>
        <div className="space-y-3">
          <GeneralListItem general={generals[1]} />
          <GeneralListItem general={generals[0]} selected />
        </div>
      </section>
      <section className="rounded-lg border border-stone-700/70 bg-stone-950/80 p-4">
        <h3 className="mb-4 text-sm font-semibold text-[#c2964d]">控件状态</h3>
        <div className="flex flex-wrap items-center gap-4">
          <InkDropdown label="normal" />
          <InkDropdown label="disabled" disabled />
          <div className="relative h-[82px] w-[492px] max-w-full">
            <button type="button" className="h-full w-full text-[25px] text-[#c2964d]" style={texture(asset.brushPrimary)}>
              hover / pressed
            </button>
          </div>
        </div>
      </section>
      <section className="rounded-lg border border-stone-700/70 bg-stone-950/80 p-4">
        <h3 className="mb-4 text-sm font-semibold text-[#c2964d]">属性条与技能</h3>
        <div className="space-y-4">
          <StatBar label="统率" value={97} icon={statIcons.leadership} />
          <div className="flex gap-4">
            {skills.map((skill) => (
              <SkillIcon key={skill.name} skill={skill} />
            ))}
          </div>
        </div>
      </section>
      <section className="rounded-lg border border-stone-700/70 bg-stone-950/80 p-4">
        <h3 className="mb-4 text-sm font-semibold text-[#c2964d]">Godot 映射</h3>
        <ul className="space-y-2 text-sm leading-6 text-stone-300">
          <li>NinePatchRect：面板、下拉框、列表项、普通按钮</li>
          <li>TextureButton：主笔刷按钮</li>
          <li>TextureRect：背景、头像、图标、技能、装饰线</li>
          <li>Label / RichTextLabel：全部中文文案与数值</li>
        </ul>
      </section>
    </div>
  );
}
