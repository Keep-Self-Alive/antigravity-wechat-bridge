# 🚀 Antigravity WeChat Bridge (微信 ↔ Google Antigravity IDE 智能网关)

<p align="center">
  <img src="https://img.shields.io/github/stars/Keep-Self-Alive/antigravity-wechat-bridge?style=social" alt="GitHub stars">
  <img src="https://img.shields.io/github/forks/Keep-Self-Alive/antigravity-wechat-bridge?style=social" alt="GitHub forks">
  <img src="https://img.shields.io/badge/Antigravity%20IDE-2.8.1+-blue.svg" alt="Antigravity Version">
  <img src="https://img.shields.io/badge/Tencent%20WeChat-iLink%20AI%20Bot-brightgreen.svg" alt="WeChat Bot">
  <img src="https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg" alt="TypeScript">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License">
</p>

> **让微信成为你的终极移动编程与执行终端。**
> 直连 **Google Antigravity IDE 本地 Language Server**，无需公开 API Key，通过腾讯微信官方 AI 通道实现 **7 大顶尖模型（Gemini 3.7 / Claude 4.6 / GPT-OSS）的手机端全自主调度、多会话管理、流式大文件传输与代码执行**。

---

## 🌟 核心特性 (Features)

* 🧠 **IDE 原生 Language Server 直连 (Connect RPC)**: 深度对接本地 Antigravity 核心引擎，0 成本调用 Gemini 3.7 Flash/Thinking、Claude Sonnet 4.6、Claude Opus 4.6 与 GPT-OSS 120B。
* ⚡ **动态端口 0 秒自愈 (Zero-Config Discovery)**: 独创 WMI + NetTCP 端口自愈探测，IDE 重启/端口漂移自动握手重连。
* 🔄 **智能会话状态机 (Session Orchestrator)**:
  * **500ms 滑动窗口防抖**: 手机微信误发、分多段发送自动聚合为单一语义 Prompt。
  * **抢占式硬件级打断**: 手机发送新消息自动中断上一轮长思考与死循环。
  * **多步骤上下文无缝拼接**: 自动合并前置对话与最终结论，杜绝丢字吞句。
* 📦 **Node.js Stream 流式大文件加密管道**: 支持数十 MB 至上百 MB 视频/图片/文档双向收发，内存占用恒定在 **20MB 左右**。
* 📎 **微信远程执行协议规范 (`[FILE_OUTPUT]`)**: 声明式文件交付，精准下发微信原生文件卡片，拒绝垃圾临时文件误发。
* 🖥️ **现代 Windows 托盘伴侣 (Tray App)**: 桌面右下角绿灯在线，支持一键看日志、一键重启与会话存档快速访问。

---

## 🚀 极速上手 (Quick Start)

## 🚀 快速上手 (Quick Start)

### 🥇 方式 1：🔥 克隆后交给 Antigravity 一键安装 (推荐)

1. **克隆项目并在 Antigravity IDE 中打开本项目文件夹**：
   ```bash
   git clone https://github.com/Keep-Self-Alive/antigravity-wechat-bridge.git
   ```
2. **在 Antigravity 聊天框中直接发送一句提示词**：
   > 💬 **“帮我配置并绑定微信”**
3. **AI 会自动执行依赖安装、弹出微信绑定二维码，并在你扫码确认后自动配置好后台守护与开机自启！**

---

### 🥈 方式 2：终端标准安装 (扫码即用)

```bash
# 1. 克隆并安装依赖
git clone https://github.com/Keep-Self-Alive/antigravity-wechat-bridge.git
cd antigravity-wechat-bridge
npm install

# 2. 运行一键扫码配置向导
npm run setup
```
> *(执行后会自动在浏览器弹出腾讯官方微信绑定二维码，手机扫码确认后全自动保存凭证并启动后台网关)*

---

### 🥉 方式 3：手动配置 (高级开发者)

1. 复制环境变量模板：`cp .env.example .env` 并填入 Token
2. 启动服务：`npm run wechat:live` 或 `python scripts/tray_companion.py`

---

## 📱 手机微信交互指令表 (Commands)

随时拿起手机打开微信对话框，直接发送以下指令：

| 用户微信发送 | 触发功能与效果 |
| :--- | :--- |
| **直接发文本 / 语音** | 编写代码、解答疑问、生成报表、分析方案或日常情感陪伴 |
| **直接发图片 / 附件** | 自动流式下载、解密并交由 IDE 模型进行深度多模态分析 |
| **`会话`** | 查看当前 IDE 最近 10 个历史会话列表及相对时间 |
| **`切换 1`**（或 2、3） | 切换到指定编号会话，无缝接续工作上下文 |
| **`新建`** | 在 IDE 中开辟全新独立会话并自动激活 |
| **`模型`** | 查看 7 大主流 AI 模型剩余配额与刷新倒计时 |
| **`模型 1`**（~ `模型 7`） | 快速切换底层执行模型（如切换至 Claude Sonnet 4.6） |
| **`状态`** | 查看 IDE 端口连接与本地同步状态 |

---

## 🛠️ 开机自启配置 (Windows)

运行以下脚本，即可将托盘伴侣与网关服务注册为 **Windows 用户级开机自启**（无黑窗口弹窗）：
```bash
python scripts/register-registry.py
```

---

## 📁 目录架构 (Architecture)

```text
├── src/
│   ├── antigravity-client.ts   # Antigravity Connect RPC 客户端
│   ├── discovery.ts            # 动态端口与 CSRF Token 自愈探测器
│   ├── session-orchestrator.ts # 500ms 防抖、抢占打断状态机
│   ├── remote-protocol.ts      # 微信会话级协议规范与文件交付契约
│   ├── media-bridge.ts         # Stream 流式加解密媒体管道
│   ├── wechat-formatter.ts     # 移动端排版美化与分卷引擎
│   ├── command-router.ts       # 微信中文指令路由器
│   └── wechat-live-daemon.ts   # 微信长轮询单例主守护进程
├── scripts/
│   ├── auto-setup.ts           # 一键扫码全自动装配向导
│   ├── tray_companion.py       # 现代系统托盘伴侣 (System Tray)
│   ├── register-registry.py    # Windows 注册表开机自启注入器
│   └── test-all-scenarios.ts   # 6 大业务场景端到端实景测试套件
└── .env.example                # 环境变量脱敏模板
```

---

## 📄 开源许可证 (License)

本项目基于 [MIT License](LICENSE) 开源协议。
