# 🚀 实时简历更新功能 (Real-time Resume Updates)

## ✨ 新功能概述

现在 CommitCV 支持通过 GitHub Webhooks 实现**每次 push 自动更新简历**！

### 功能特性

- ✅ **OAuth 授权后一键启用**: 用户授权后，点击"启用实时更新"按钮即可
- ✅ **自动配置所有仓库**: 系统会自动为用户的所有仓库配置 Webhooks
- ✅ **AI 智能分析**: 每次 push 时，AI 自动分析 commit message 提取新技能
- ✅ **实时更新**: 通过 Firestore real-time listener，前端立即显示更新
- ✅ **状态显示**: 实时显示 webhook 启用状态和覆盖率

---

## 🔧 实现细节

### 1. OAuth Scope 增强

在 `server.ts` 中，OAuth 授权时请求了新的权限：

```typescript
scope=repo,user,admin:repo_hook
```

- `admin:repo_hook`: 允许创建和管理仓库的 webhooks

### 2. 新增 API 端点

#### `POST /api/webhook/setup`
为用户的所有仓库自动配置 webhooks

**请求参数:**
```json
{
  "token": "GitHub OAuth Token",
  "username": "GitHub Username"
}
```

**响应:**
```json
{
  "success": true,
  "message": "Configured webhooks for 15 repositories",
  "totalRepos": 15,
  "successCount": 15,
  "failureCount": 0,
  "results": [...]
}
```

#### `GET /api/webhook/status`
检查当前 webhook 配置状态

**参数:** `?token=GitHub_Token`

**响应:**
```json
{
  "enabled": true,
  "totalRepos": 15,
  "reposWithWebhook": 15,
  "coverage": 100
}
```

### 3. Webhook 处理端点

#### `POST /api/webhook/github?username=xxx`
接收 GitHub push 事件并更新简历

**GitHub Webhook 配置:**
- Payload URL: `https://your-app.com/api/webhook/github?username={username}`
- Content type: `application/json`
- Events: `push`

**工作流程:**
1. GitHub 发送 push 事件到 webhook URL
2. 服务器提取 commit messages
3. AI (OpenRouter) 分析 commits 提取新技能
4. 更新 Firestore 中的 resume 数据
5. 前端通过 real-time listener 立即收到更新

---

## 🎨 前端 UI 更新

### 新增状态管理

```typescript
const [webhookEnabled, setWebhookEnabled] = useState<boolean>(false);
const [webhookStatus, setWebhookStatus] = useState<{...}>(null);
const [settingUpWebhook, setSettingUpWebhook] = useState<boolean>(false);
const [showWebhookModal, setShowWebhookModal] = useState<boolean>(false);
```

### 新增函数

1. **`checkWebhookStatus()`**: 检查 webhook 状态
2. **`setupWebhooks()`**: 一键配置所有仓库的 webhooks
3. **自动检查**: OAuth 授权后自动检查 webhook 状态

### UI 组件

#### 1. 状态指示器（顶部导航栏）

**未启用时:**
```jsx
<button onClick={() => setShowWebhookModal(true)}>
  <Sparkles /> 启用实时更新
</button>
```

**已启用时:**
```jsx
<div className="bg-emerald-950/30">
  <span className="pulse">●</span>
  实时更新已启用
  <span>{reposWithWebhook}/{totalRepos} repos</span>
</div>
```

#### 2. Webhook 设置模态框

精美的模态框包含：
- ✨ 渐变背景和动画效果
- 📊 功能特性展示网格
- 📝 工作原理说明
- 🔒 安全说明
- 🎯 一键启用按钮

---

## 📋 使用流程

### 用户视角

1. **授权登录**: 用户通过 GitHub OAuth 授权
2. **查看提示**: 授权成功后看到"启用实时更新"按钮
3. **点击启用**: 打开模态框，了解功能详情
4. **一键配置**: 点击"立即启用"，系统自动配置所有仓库
5. **实时生效**: push 代码后，简历自动更新！

### 技术流程

```
OAuth Authorization
    ↓
Get GitHub Token (with admin:repo_hook)
    ↓
POST /api/webhook/setup
    ↓
For each repository:
  - Check existing webhooks
  - Create new webhook if not exists
  - Configure: URL, Events (push), Secret
    ↓
Display Status: ✅ X/Y repos configured
    ↓
User pushes code to GitHub
    ↓
GitHub → POST /api/webhook/github
    ↓
AI analyzes commits → Extract skills
    ↓
Update Firestore
    ↓
Frontend real-time listener receives update
    ↓
UI shows notification + updated resume
```

---

## 🔐 安全考虑

1. **Webhook 验证**: 可以添加 GitHub Secret 验证 webhook 请求的真实性
2. **权限控制**: 只请求必要的 OAuth 权限
3. **数据保护**: Webhook 只接收 push 事件元数据，不访问代码内容
4. **用户控制**: 用户可随时在 GitHub 仓库设置中禁用 webhooks

---

## 🎯 两种方式对比

### Public Username Scan（公开扫描）
- ❌ 无需授权
- ❌ 只能访问公开数据
- ❌ 一次性分析
- ❌ 无法自动更新

### OAuth Sign-In + Webhooks（授权 + 实时更新）
- ✅ 需要授权
- ✅ 可访问私有仓库
- ✅ 一次性初始分析
- ✅ **每次 push 自动更新** ⚡
- ✅ AI 实时分析新技能
- ✅ 简历始终保持最新

---

## 🚀 未来改进

1. **选择性配置**: 允许用户选择特定仓库启用 webhook
2. **Webhook 管理**: 提供禁用/重新配置 webhook 的界面
3. **更多事件**: 支持 PR、Issue 等其他 GitHub 事件
4. **通知设置**: 允许用户自定义更新通知方式
5. **历史记录**: 显示所有 webhook 触发的历史记录

---

## 📝 环境变量要求

确保配置以下环境变量：

```env
# GitHub OAuth (必需)
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret

# OpenRouter AI (必需，用于分析 commits)
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=nex-agi/nex-n2-pro:free

# App URL (必需，用于 webhook URL)
APP_URL=https://your-app-url.com
```

---

## ✅ 完成状态

- ✅ OAuth scope 增强 (`admin:repo_hook`)
- ✅ Webhook 配置 API (`/api/webhook/setup`)
- ✅ Webhook 状态检查 API (`/api/webhook/status`)
- ✅ 前端状态管理和 UI
- ✅ 精美的设置模态框
- ✅ 自动状态检查
- ✅ 实时更新提示
- ✅ 类型定义 (TypeScript)

---

**🎉 现在你的简历会随着每次 commit 自动进化！**
