# 个人知识工作台

一个专属个人使用的 Web/PWA 应用，支持想法速记、知识库、Markdown 文档、Todo、附件上传和 Supabase 云同步。界面结构参考 Codex/ChatGPT：左侧导航，中间工作区，右侧上下文和 AI 预留入口。

## 本地运行

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。如果没有配置 Supabase，应用会进入本地演示模式。

## Supabase 配置

1. 新建 Supabase 项目。
2. 在 Supabase SQL Editor 中执行 `supabase/schema.sql`。
3. 复制 `.env.example` 为 `.env.local`，填入：

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

4. 重启开发服务器。

## 已实现范围

- Next.js App Router + TypeScript + Tailwind。
- PWA manifest 和安装基础配置。
- Supabase Auth 邮箱魔法链接登录。
- 个人数据表：spaces、notes、documents、todos、tags、attachments。
- Row Level Security：所有数据通过 `user_id` 隔离。
- Markdown 编辑 + 预览，支持 GFM 表格、代码块、链接、列表。
- 附件上传到 Supabase Storage bucket `workspace-files`。
- AI 助手入口为占位，不调用外部 API。

## 验证

```bash
npm run lint
npm run build
```
