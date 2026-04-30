import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const sourceImage =
  process.argv[2] ??
  "C:/Users/zivmli/Documents/WXWork/1688850682073083/Cache/Image/2026-04/企业微信截图_17774505088808.png";

const root = process.cwd();
const out = path.join(root, "public", "game-ui", "warrior-select");
const publicBase = "/game-ui/warrior-select";
const assets = [];

async function ensureDirs() {
  const dirs = [
    "source",
    "layers/background",
    "layers/portraits",
    "layers/skills",
    "components/buttons",
    "components/dropdown",
    "components/icons",
    "components/list",
    "components/panels",
    "components/stat-bars",
  ];

  await Promise.all(dirs.map((dir) => fs.mkdir(path.join(out, dir), { recursive: true })));
}

function publicPath(relativePath) {
  return `${publicBase}/${relativePath.replaceAll(path.sep, "/")}`;
}

function addAsset({
  id,
  relativePath,
  kind,
  layer,
  usage,
  godotNode,
  size,
  sourceRect,
  ninePatchMargin,
  states,
  dynamicText = true,
}) {
  const item = {
    id,
    path: publicPath(relativePath),
    kind,
    layer,
    usage,
    godot_node: godotNode,
    size,
    dynamic_text: dynamicText,
  };

  if (sourceRect) item.source_rect = sourceRect;
  if (ninePatchMargin) item.nine_patch_margin = ninePatchMargin;
  if (states?.length) item.states = states;
  assets.push(item);
}

async function crop(relativePath, rect, id, layer, usage) {
  const output = path.join(out, relativePath);
  await sharp(sourceImage).extract(rect).png().toFile(output);
  addAsset({
    id,
    relativePath,
    kind: "png-crop",
    layer,
    usage,
    godotNode: "TextureRect",
    size: { width: rect.width, height: rect.height },
    sourceRect: rect,
    dynamicText: false,
  });
}

async function svg({
  relativePath,
  width,
  height,
  body,
  id,
  layer,
  usage,
  godotNode,
  ninePatchMargin,
  states,
}) {
  const output = path.join(out, relativePath);
  const content = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">\n${body}\n</svg>\n`;
  await fs.writeFile(output, content, "utf8");
  addAsset({
    id,
    relativePath,
    kind: "svg",
    layer,
    usage,
    godotNode,
    size: { width, height },
    ninePatchMargin,
    states,
  });
}

async function generateCrops() {
  await fs.copyFile(sourceImage, path.join(out, "source", "reference.png"));

  await crop(
    "layers/background/ink-paper-crop.png",
    { left: 388, top: 57, width: 945, height: 824 },
    "background.ink-paper-crop",
    "background",
    "水墨纸底与远山烟雾裁切参考",
  );
  await crop(
    "layers/background/hero-character-crop.png",
    { left: 716, top: 58, width: 650, height: 804 },
    "background.hero-character-crop",
    "background",
    "右侧人物与旗帜裁切参考",
  );
  await crop(
    "layers/background/bottom-smoke-crop.png",
    { left: 394, top: 770, width: 936, height: 130 },
    "background.bottom-smoke-crop",
    "background",
    "底部烟雾和前景暗部裁切参考",
  );

  const portraitY = [101, 176, 250, 323, 398, 472, 545, 619, 692, 766, 839];
  await Promise.all(
    portraitY.map((top, index) =>
      crop(
        `layers/portraits/portrait-${String(index + 1).padStart(2, "0")}.png`,
        { left: 31, top, width: 72, height: 58 },
        `portrait.${String(index + 1).padStart(2, "0")}`,
        "left-list",
        "武将列表头像裁切参考",
      ),
    ),
  );

  const skillRects = [
    { left: 1357, top: 681, width: 63, height: 63 },
    { left: 1436, top: 681, width: 63, height: 63 },
    { left: 1516, top: 681, width: 63, height: 63 },
    { left: 1594, top: 681, width: 63, height: 63 },
  ];
  await Promise.all(
    skillRects.map((rect, index) =>
      crop(
        `layers/skills/skill-${String(index + 1).padStart(2, "0")}.png`,
        rect,
        `skill.${String(index + 1).padStart(2, "0")}`,
        "attributes",
        "初始技能图标裁切参考",
      ),
    ),
  );
}

async function generateSvgComponents() {
  await svg({
    relativePath: "components/panels/left-list-panel.svg",
    width: 354,
    height: 792,
    body: `<defs>
  <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
    <stop stop-color="#1b1a16" stop-opacity=".95"/>
    <stop offset="1" stop-color="#090908" stop-opacity=".92"/>
  </linearGradient>
</defs>
<rect x="1" y="1" width="352" height="790" rx="4" fill="url(#panel)" stroke="#70674d" stroke-opacity=".55"/>
<rect x="7" y="7" width="340" height="778" rx="3" stroke="#25231c" stroke-opacity=".9"/>`,
    id: "panel.left-list",
    layer: "left-list",
    usage: "左侧武将列表容器底与描边",
    godotNode: "NinePatchRect",
    ninePatchMargin: { left: 8, top: 8, right: 8, bottom: 8 },
  });

  await svg({
    relativePath: "components/panels/right-attribute-panel.svg",
    width: 342,
    height: 548,
    body: `<defs>
  <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
    <stop stop-color="#26251f" stop-opacity=".88"/>
    <stop offset=".62" stop-color="#10100e" stop-opacity=".92"/>
    <stop offset="1" stop-color="#050505" stop-opacity=".86"/>
  </linearGradient>
</defs>
<path d="M0 0H342V548H0V0Z" fill="url(#panel)"/>
<path d="M1 1H341V547H1V1Z" stroke="#6d654d" stroke-opacity=".28"/>
<path d="M18 224H324M18 338H324M18 466H324" stroke="#736b54" stroke-opacity=".22"/>`,
    id: "panel.right-attributes",
    layer: "attributes",
    usage: "右侧属性面板暗底、分割线与边缘纹理",
    godotNode: "NinePatchRect",
    ninePatchMargin: { left: 10, top: 10, right: 10, bottom: 10 },
  });

  await svg({
    relativePath: "components/panels/profile-paper-panel.svg",
    width: 470,
    height: 412,
    body: `<defs>
  <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
    <stop stop-color="#ecebe6" stop-opacity=".34"/>
    <stop offset=".55" stop-color="#cfcfc8" stop-opacity=".12"/>
    <stop offset="1" stop-color="#f8f7f1" stop-opacity=".22"/>
  </linearGradient>
</defs>
<rect width="470" height="412" fill="url(#paper)" opacity=".72"/>
<path d="M0 151H470M0 274H470" stroke="#1c1b18" stroke-opacity=".26"/>`,
    id: "panel.profile-paper",
    layer: "profile",
    usage: "中央武将资料区水墨纸面参考底",
    godotNode: "TextureRect",
  });

  await svg({
    relativePath: "components/list/general-row-normal.svg",
    width: 342,
    height: 70,
    body: `<defs>
  <linearGradient id="row" x1="0" y1="0" x2="1" y2="0">
    <stop stop-color="#1a1712" stop-opacity=".82"/>
    <stop offset=".34" stop-color="#151511" stop-opacity=".72"/>
    <stop offset="1" stop-color="#0b0b0a" stop-opacity=".86"/>
  </linearGradient>
</defs>
<rect x="1" y="1" width="340" height="68" rx="3" fill="url(#row)" stroke="#524a38" stroke-opacity=".34"/>`,
    id: "list.row-normal",
    layer: "left-list",
    usage: "列表项普通态底图，不含文字",
    godotNode: "StyleBoxTexture",
    ninePatchMargin: { left: 8, top: 8, right: 8, bottom: 8 },
    states: ["normal"],
  });

  await svg({
    relativePath: "components/list/general-row-selected.svg",
    width: 342,
    height: 70,
    body: `<defs>
  <linearGradient id="row" x1="0" y1="0" x2="1" y2="0">
    <stop stop-color="#4a2615" stop-opacity=".88"/>
    <stop offset=".46" stop-color="#252018" stop-opacity=".84"/>
    <stop offset="1" stop-color="#15110d" stop-opacity=".92"/>
  </linearGradient>
</defs>
<rect x="1" y="1" width="340" height="68" rx="3" fill="url(#row)" stroke="#b9914f" stroke-opacity=".9"/>
<path d="M6 5H112C72 21 48 44 27 65H6V5Z" fill="#b14916" fill-opacity=".28"/>`,
    id: "list.row-selected",
    layer: "left-list",
    usage: "列表项选中态底图、金色描边和阵营氛围",
    godotNode: "StyleBoxTexture",
    ninePatchMargin: { left: 8, top: 8, right: 8, bottom: 8 },
    states: ["selected", "hover"],
  });

  const simpleSvgs = [
    {
      relativePath: "components/list/general-sort-badge.svg",
      width: 51,
      height: 30,
      body: `<path d="M7 1H44L50 7V23L44 29H7L1 23V7L7 1Z" fill="#2a2418" stroke="#9a7a3a" stroke-opacity=".82"/>`,
      id: "list.sort-badge",
      layer: "left-list",
      usage: "列表项右上排序徽标底图，不含文字",
      godotNode: "TextureRect",
      states: ["selected"],
    },
    {
      relativePath: "components/list/avatar-mask-frame.svg",
      width: 76,
      height: 62,
      body: `<path d="M1 1H75V61H1V1Z" fill="#000" fill-opacity=".18" stroke="#8c7650" stroke-opacity=".5"/>
<path d="M6 5H70V57H6V5Z" stroke="#0a0907" stroke-opacity=".72"/>`,
      id: "list.avatar-frame",
      layer: "left-list",
      usage: "头像遮罩和细描边",
      godotNode: "TextureRect",
    },
    {
      relativePath: "components/list/scrollbar-track.svg",
      width: 6,
      height: 782,
      body: `<rect x="2" y="0" width="2" height="782" fill="#726b5a" fill-opacity=".2"/>`,
      id: "list.scrollbar-track",
      layer: "left-list",
      usage: "滚动条轨道",
      godotNode: "TextureRect",
    },
    {
      relativePath: "components/list/scrollbar-thumb.svg",
      width: 6,
      height: 84,
      body: `<rect x="1" y="0" width="4" height="84" rx="2" fill="#a9986f" fill-opacity=".72"/>`,
      id: "list.scrollbar-thumb",
      layer: "left-list",
      usage: "滚动条滑块",
      godotNode: "TextureRect",
    },
    {
      relativePath: "components/dropdown/ink-dropdown-bg.svg",
      width: 160,
      height: 32,
      body: `<rect x="1" y="1" width="158" height="30" rx="2" fill="#10100f" fill-opacity=".72" stroke="#77705d" stroke-opacity=".7"/>`,
      id: "dropdown.background",
      layer: "left-list",
      usage: "筛选下拉框底图，不含文字",
      godotNode: "StyleBoxTexture",
      ninePatchMargin: { left: 6, top: 6, right: 24, bottom: 6 },
      states: ["normal", "hover", "disabled"],
    },
    {
      relativePath: "components/dropdown/caret.svg",
      width: 18,
      height: 18,
      body: `<path d="M4 6L9 11L14 6" stroke="#b7ae93" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`,
      id: "dropdown.caret",
      layer: "left-list",
      usage: "下拉箭头",
      godotNode: "TextureRect",
    },
    {
      relativePath: "components/buttons/return-button.svg",
      width: 82,
      height: 36,
      body: `<rect x="1" y="1" width="80" height="34" rx="1" fill="#151513" fill-opacity=".58" stroke="#b8b0a2" stroke-opacity=".72"/>
<rect x="4" y="4" width="74" height="28" stroke="#2f2d28" stroke-opacity=".8"/>`,
      id: "button.return",
      layer: "bottom-actions",
      usage: "返回按钮底图，不含文字",
      godotNode: "StyleBoxTexture",
      ninePatchMargin: { left: 6, top: 6, right: 6, bottom: 6 },
      states: ["normal", "hover", "pressed"],
    },
    {
      relativePath: "components/buttons/tag-button.svg",
      width: 56,
      height: 28,
      body: `<rect x="1" y="1" width="54" height="26" rx="1" fill="#e5e3dc" fill-opacity=".28" stroke="#1e1d1a" stroke-opacity=".72"/>`,
      id: "button.tag",
      layer: "profile",
      usage: "身份标签按钮底图，不含文字",
      godotNode: "StyleBoxTexture",
      ninePatchMargin: { left: 5, top: 5, right: 5, bottom: 5 },
      states: ["normal", "hover"],
    },
    {
      relativePath: "components/buttons/detail-button.svg",
      width: 84,
      height: 31,
      body: `<rect x="1" y="1" width="82" height="29" rx="1" fill="#1b1b19" fill-opacity=".72" stroke="#696255" stroke-opacity=".75"/>`,
      id: "button.detail",
      layer: "profile",
      usage: "查看详情按钮底图，不含文字",
      godotNode: "StyleBoxTexture",
      ninePatchMargin: { left: 6, top: 6, right: 6, bottom: 6 },
      states: ["normal", "hover"],
    },
    {
      relativePath: "components/icons/title-ornament-left.svg",
      width: 74,
      height: 14,
      body: `<path d="M0 7H58" stroke="#a57a36" stroke-width="1.3"/>
<path d="M57 7L63 3L69 7L63 11L57 7Z" stroke="#a57a36" fill="none"/>
<circle cx="72" cy="7" r="2" fill="#a57a36"/>`,
      id: "ornament.title-left",
      layer: "top-title",
      usage: "顶部标题左侧金色装饰线",
      godotNode: "TextureRect",
    },
    {
      relativePath: "components/icons/title-ornament-right.svg",
      width: 74,
      height: 14,
      body: `<path d="M74 7H16" stroke="#a57a36" stroke-width="1.3"/>
<path d="M17 7L11 3L5 7L11 11L17 7Z" stroke="#a57a36" fill="none"/>
<circle cx="2" cy="7" r="2" fill="#a57a36"/>`,
      id: "ornament.title-right",
      layer: "top-title",
      usage: "顶部标题右侧金色装饰线",
      godotNode: "TextureRect",
    },
    {
      relativePath: "components/icons/faction-wei.svg",
      width: 36,
      height: 36,
      body: `<rect x="5" y="5" width="26" height="26" rx="6" fill="#213a5f" stroke="#b9c7de"/>
<path d="M13 23C16 18 20 17 23 12M13 14C17 16 20 19 23 24" stroke="#eef4ff" stroke-width="2" stroke-linecap="round"/>`,
      id: "icon.faction-wei",
      layer: "profile",
      usage: "魏阵营徽章",
      godotNode: "TextureRect",
    },
    {
      relativePath: "components/icons/help.svg",
      width: 18,
      height: 18,
      body: `<circle cx="9" cy="9" r="7" stroke="#b7a47a" stroke-opacity=".72"/>
<path d="M7 7C7.3 5.7 8.2 5 9.5 5C10.9 5 12 5.8 12 7.1C12 8.3 11.3 8.8 10.3 9.4C9.6 9.8 9.2 10.3 9.2 11.2M9.2 14H9.3" stroke="#d0c19a" stroke-linecap="round"/>`,
      id: "icon.help",
      layer: "attributes",
      usage: "帮助问号图标",
      godotNode: "TextureRect",
    },
    {
      relativePath: "components/icons/trait-frame.svg",
      width: 54,
      height: 54,
      body: `<circle cx="27" cy="27" r="25" fill="#191916" fill-opacity=".82" stroke="#dad6cb" stroke-opacity=".65"/>
<circle cx="27" cy="27" r="21" stroke="#5e5a52" stroke-opacity=".82"/>
<path d="M16 31C21 20 28 18 38 23M19 19C24 27 30 31 38 35" stroke="#e8e5dc" stroke-opacity=".9" stroke-width="2" stroke-linecap="round"/>`,
      id: "icon.trait-frame",
      layer: "profile",
      usage: "武将特性圆形图标框和占位纹理",
      godotNode: "TextureRect",
    },
    {
      relativePath: "components/icons/skill-frame.svg",
      width: 64,
      height: 64,
      body: `<circle cx="32" cy="32" r="31" fill="#161616" fill-opacity=".62" stroke="#ded8cb" stroke-opacity=".72"/>
<circle cx="32" cy="32" r="26" stroke="#78705a" stroke-opacity=".7"/>`,
      id: "icon.skill-frame",
      layer: "attributes",
      usage: "初始技能圆形图标框",
      godotNode: "TextureRect",
    },
    {
      relativePath: "components/stat-bars/stat-track.svg",
      width: 168,
      height: 8,
      body: `<rect x="0" y="1" width="168" height="6" fill="#4f4f4b" fill-opacity=".72"/>
<rect x=".5" y="1.5" width="167" height="5" stroke="#8c8675" stroke-opacity=".28"/>`,
      id: "stat.track",
      layer: "attributes",
      usage: "属性进度条底",
      godotNode: "StyleBoxTexture",
      ninePatchMargin: { left: 2, top: 2, right: 2, bottom: 2 },
    },
    {
      relativePath: "components/stat-bars/stat-fill.svg",
      width: 168,
      height: 8,
      body: `<rect x="0" y="1" width="168" height="6" fill="#b9b8b2"/>`,
      id: "stat.fill",
      layer: "attributes",
      usage: "属性进度条填充，可按宽度缩放",
      godotNode: "TextureRect",
    },
  ];

  await Promise.all(simpleSvgs.map(svg));

  await svg({
    relativePath: "components/buttons/brush-primary.svg",
    width: 492,
    height: 82,
    body: `<defs>
  <linearGradient id="brush" x1="0" y1="0" x2="1" y2="0">
    <stop stop-color="#050403" stop-opacity="0"/>
    <stop offset=".08" stop-color="#080604"/>
    <stop offset=".52" stop-color="#070504"/>
    <stop offset=".92" stop-color="#080604"/>
    <stop offset="1" stop-color="#050403" stop-opacity="0"/>
  </linearGradient>
</defs>
<path d="M20 22C87 12 140 17 197 13C270 8 326 15 389 11C430 8 462 13 481 20C454 28 470 38 490 45C438 50 401 58 351 57C291 57 245 64 188 60C121 56 80 61 0 49C28 43 34 35 20 22Z" fill="url(#brush)"/>
<path d="M147 44H345" stroke="#9f7838" stroke-opacity=".72"/>
<path d="M180 34L171 40L180 46M312 34L321 40L312 46" stroke="#9f7838" stroke-width="1.4"/>`,
    id: "button.brush-primary",
    layer: "bottom-actions",
    usage: "开始游戏笔刷按钮底和金色装饰，不含文字",
    godotNode: "TextureButton",
    ninePatchMargin: { left: 70, top: 24, right: 70, bottom: 24 },
    states: ["normal", "hover", "pressed", "disabled"],
  });

  const statIcons = [
    {
      name: "leadership",
      body: `<circle cx="12" cy="12" r="8" fill="#cdbb91"/><path d="M12 5V19M5 12H19" stroke="#282015" stroke-width="2"/>`,
      usage: "统率属性图标",
    },
    {
      name: "attack",
      body: `<path d="M5 19L19 5M14 5H19V10" stroke="#cdbb91" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
      usage: "武力属性图标",
    },
    {
      name: "intellect",
      body: `<path d="M12 4L19 10L16 20H8L5 10L12 4Z" fill="#cdbb91"/><path d="M9 11H15M10 15H14" stroke="#282015" stroke-width="1.5"/>`,
      usage: "智力属性图标",
    },
    {
      name: "politics",
      body: `<path d="M7 20H17M8 8H16M9 8L7 17H17L15 8M12 4V20" stroke="#cdbb91" stroke-width="2" stroke-linecap="round"/>`,
      usage: "政治属性图标",
    },
    {
      name: "charm",
      body: `<path d="M12 21C8 16 5 13 5 9C5 6.8 6.7 5 8.8 5C10.1 5 11.2 5.7 12 6.8C12.8 5.7 13.9 5 15.2 5C17.3 5 19 6.8 19 9C19 13 16 16 12 21Z" fill="#cdbb91"/>`,
      usage: "魅力属性图标",
    },
  ];

  const unitIcons = [
    {
      name: "infantry",
      body: `<path d="M12 3L18 7V12C18 16 15.5 19 12 21C8.5 19 6 16 6 12V7L12 3Z" fill="#cdbb91"/><path d="M12 6V18" stroke="#262015" stroke-width="1.8"/>`,
      usage: "步兵适性图标",
    },
    {
      name: "cavalry",
      body: `<path d="M4 17C7 10 12 7 20 8C17 10 18 14 21 17H4Z" fill="#cdbb91"/><circle cx="8" cy="18" r="2" fill="#262015"/><circle cx="17" cy="18" r="2" fill="#262015"/>`,
      usage: "骑兵适性图标",
    },
    {
      name: "archer",
      body: `<path d="M6 4C13 8 13 16 6 20M5 12H19M15 8L19 12L15 16" stroke="#cdbb91" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
      usage: "弓兵适性图标",
    },
    {
      name: "spear",
      body: `<path d="M5 20L19 6M16 5L20 4L19 8" stroke="#cdbb91" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
      usage: "枪兵适性图标",
    },
    {
      name: "siege",
      body: `<path d="M5 17H19M7 17V9H17V17M9 9V6H15V9" stroke="#cdbb91" stroke-width="2" stroke-linecap="round"/><circle cx="8" cy="19" r="1.5" fill="#cdbb91"/><circle cx="16" cy="19" r="1.5" fill="#cdbb91"/>`,
      usage: "攻城适性图标",
    },
  ];

  await Promise.all([
    ...statIcons.map((icon) =>
      svg({
        relativePath: `components/icons/stat-${icon.name}.svg`,
        width: 24,
        height: 24,
        body: icon.body,
        id: `icon.stat.${icon.name}`,
        layer: "attributes",
        usage: icon.usage,
        godotNode: "TextureRect",
      }),
    ),
    ...unitIcons.map((icon) =>
      svg({
        relativePath: `components/icons/unit-${icon.name}.svg`,
        width: 24,
        height: 24,
        body: icon.body,
        id: `icon.unit.${icon.name}`,
        layer: "attributes",
        usage: icon.usage,
        godotNode: "TextureRect",
      }),
    ),
  ]);
}

async function writeManifest() {
  const manifest = {
    version: 1,
    name: "warrior-select-godot-ui",
    source: `${publicBase}/source/reference.png`,
    source_size: { width: 1672, height: 941 },
    target_engine: "Godot 4.x",
    text_policy:
      "All character names, labels, stats, button captions, list values, and descriptions are dynamic text. Do not bake gameplay text into image assets.",
    coordinate_space: "Original screenshot pixels, top-left origin",
    node_tree: [
      "Control/WarriorSelectScreen",
      "BackgroundLayer",
      "LeftListPanel",
      "CenterProfilePanel",
      "RightAttributePanel",
      "BottomActionBar",
    ],
    assets: assets.sort((a, b) => a.id.localeCompare(b.id)),
  };

  await fs.writeFile(path.join(out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

await ensureDirs();
await generateCrops();
await generateSvgComponents();
await writeManifest();

console.log(`Generated ${assets.length} warrior-select assets in ${out}`);
