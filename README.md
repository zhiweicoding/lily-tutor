# Lily 英语外教 · 数字人老师

给两岁半宝宝用的手机网页：屏幕中央是 **Ready Player Me 真人 3D 数字人**（TalkingHead.js 驱动口型），用幼教方式慢慢教英语单词。

## 手机怎么打开

1. 用手机浏览器打开部署后的 HTTPS 链接（推荐 **Chrome**；iPhone 也可用 **Safari**）。
2. 第一次进入会看到「点这里开始」——必须先点一下，手机才允许发音。
3. 等 Lily 老师加载完成（需要一点网络），她会打招呼。
4. 点「小动物 / 水果 / 颜色…」大图，再点一个单词；Lily 会说英文 + 中文鼓励。
5. 「跟 Lily 说」：允许麦克风后，宝宝跟着说（无论说得怎样都会被夸奖）。
6. 「认东西」：允许摄像头，把苹果、香蕉、书、球、玩具小汽车等对准镜头。

### 添加到主屏幕（像 App）

- **安卓 Chrome**：菜单 →「添加到主屏幕」/「安装应用」
- **iPhone Safari**：分享按钮 →「添加到主屏幕」

## 权限说明

| 权限 | 用途 |
|------|------|
| 麦克风 | 「跟 Lily 说」跟读（可选） |
| 摄像头 | 「认东西」识别常见物品（可选） |

不给权限也能用学词和找一找。摄像头/麦克风**必须在 HTTPS 页面**里才会出现授权弹窗；本地直接打开 `file://` 常被系统拦住。

## 本地预览（电脑）

```bash
cd digital-tutor
npx --yes serve -l 5173
```

手机和电脑同一 Wi‑Fi 时，用电脑局域网 IP 访问；完整摄像头功能仍建议 HTTPS 部署。

## 技术说明

- **数字人**：TalkingHead.js + Ready Player Me GLB（brunette 女老师，含 ARKit / Oculus Visemes）
- **发音**：浏览器 Web Speech API（英文慢速 + 中文鼓励）；口型用估时 + `speakAudio` 驱动
- **识别**：TensorFlow.js COCO-SSD（CDN）
- **进度**：localStorage
- **形态**：竖屏 PWA（manifest + service worker）

## 升级音质（可选 API Key）

当前无需任何 Key。若要更像真人外教的声音与更准口型，可在 `js/tts.js` 的 `speakWithProvider()` 接入：

- **ElevenLabs**：更自然英文童趣声线 + 字级时间戳 → `head.speakAudio`
- **Azure Speech**：多语种 + viseme → 口型更准
- **Google Cloud TTS**：TalkingHead 原生 `speakText`（需服务端代理，勿把 Key 写进网页）

## 版权提示

示例数字人模型来自 Ready Player Me，非商业试用请遵守其与 TalkingHead 文档中的许可（CC BY-NC 等）。正式商用请自行更换已获授权的形象。


## 平台差异（实测预期）

| 能力 | Android Chrome | iOS Safari |
|------|----------------|------------|
| 3D 数字人 + 口型 | 好 | 好（首次加载 GLB 稍慢） |
| 英文/中文发音（Web Speech） | 好（音色因机型而异） | 可用，中文/英文声线取决于系统语言包 |
| 跟读（SpeechRecognition） | 支持（需麦克风权限） | **通常不可用**（Web Speech Recognition 未开放），按钮可能无效 |
| 摄像头认东西 | 需 HTTPS + 权限 | 需 HTTPS + 权限；建议用后置摄像头拍物品 |
| 添加到主屏幕 | 支持 | 分享 → 添加到主屏幕 |

本地 `file://` 打开时：学词/找一找一般可用；摄像头与麦克风常被系统禁止。

## 永久发布（当前阻塞）

本机已做好站点：`/workspace/digital-tutor/`。

尝试过的发布路径与结果：

1. **GitHub Pages**（目标：`https://zhiweicoding.github.io/lily-tutor/`）  
   - 账号 `zhiweicoding` 已通过 cursor-github MCP 连接，且对 `zhiweicoding.github.io` 有 push 权限。  
   - 但 MCP **没有**「写入文件 / 创建提交」工具；本机 `gh` **未登录**（`gh auth login`）。  
   - 脚本已备好：`./deploy-github-pages.sh`（登录后一键部署）。

2. **Cloudflare Quick Tunnel**  
   - 沙箱出网无法连通 Cloudflare edge 的 7844 端口，隧道 URL 无法真正对外服务。

3. **匿名网盘/临时文件站**  
   - 被安全策略拦截（不应上传源码到陌生公共站）。

**请家长任选其一完成永久 HTTPS：**

- 在本机执行 `gh auth login` 后让助手运行 `deploy-github-pages.sh`；或  
- 把 `/workspace/digital-tutor` 文件夹拖到 Netlify Drop / Vercel；或  
- 用已有 GitHub 网页把该目录推到 `zhiweicoding.github.io` 仓库的 `lily-tutor/` 路径。

本地预览（同一 Wi‑Fi 仅供试界面，完整权限仍要 HTTPS）：

```bash
cd /workspace/digital-tutor && python3 -m http.server 8765
```
