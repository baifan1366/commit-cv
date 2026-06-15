<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# CommitCV - Your Resume Should Write Itself

CommitCV 是一个智能简历生成平台，通过分析 GitHub 活动自动构建动态简历。每次 commit 都成为你的职业证明。

View your app in AI Studio: https://ai.studio/apps/765c95df-2f9f-4182-81bc-83fad186ac1a

## 新功能：个性化简历链接 🚀

现在每个用户都有自己的专属简历链接！只需在网址后面输入 GitHub 用户名即可查看简历：

```
https://yoursite.com/[github_username]
```

### 使用方法

1. **生成简历**：在首页输入 GitHub 用户名生成简历
2. **获取链接**：简历生成后，点击 "Share Link" 按钮复制专属链接
3. **分享**：任何人都可以通过这个链接直接查看你的简历

### 示例

- `https://yoursite.com/octocat` - 查看 octocat 的简历
- `https://yoursite.com/torvalds` - 查看 torvalds 的简历
- `https://yoursite.com/gaearon` - 查看 gaearon 的简历

## 隐私设置：GitHub 个人资料可见性

### 如果 GitHub 个人资料是私密的

如果用户的 GitHub 个人资料设置为私密，系统会自动显示如何将个人资料设为公开的详细教程：

1. 登录 GitHub 账户
2. 进入 Settings → Profile
3. 取消勾选 "Make profile private and hide activity"
4. 保存更改并重新加载简历

### 为什么需要公开个人资料？

CommitCV 需要访问公开的 GitHub 活动、提交记录和代码库来生成简历。私密个人资料会阻止这些信息的访问。

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Features

- ✨ **AI-Powered Resume Generation** - 基于 Gemini AI 分析 GitHub 活动
- 🔄 **Real-time Updates** - 通过 Webhook 自动更新简历
- 🎨 **Beautiful UI** - 现代化的用户界面设计
- 🔗 **Shareable Links** - 每个用户都有专属的简历链接
- 🔒 **Privacy Aware** - 提供隐私设置指导
- 💬 **AI Chat Co-pilot** - 与 AI 对话编辑简历

## Tech Stack

- Next.js 15
- React 19
- Firebase Firestore
- Gemini AI
- Tailwind CSS
- TypeScript
