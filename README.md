# 智忆 · 科学记忆力训练网站

专为 50+ 中老年群体设计的简洁、护眼、自适应认知与记忆训练网站。训练范式依据临床医学论文设计，支持外网登录、管理员后台查看进度以及家属只读链接远程查看。

## 五大科学训练模块（每项均内置玩法说明与论文依据）

1. **火眼金睛 · 信息处理速度**（依据 ACTIVE 临床试验 / UFOV 视觉搜索范式）
2. **前瞻后顾 · N-Back 工作记忆**（依据 Jaeggi et al., *PNAS* 2008 / *Psychology and Aging* 2014）
3. **温故知新 · 间隔联想记忆**（依据 Camp et al. Spaced Retrieval 间隔提取范式 + SM-2 算法）
4. **步步为营 · 空间顺序记忆**（依据 Corsi Block-Tapping 神经心理学范式）
5. **去伪存真 · 抗干扰专注力**（依据 Stroop 色词抑制 / *Nature* 2013 认知控制研究）

## 训练效果查看与管理权限

- **管理员后台**：默认管理员账号 `admin`，初始密码 `admin123456`（建议部署时通过环境变量 `ADMIN_PASSWORD` 修改）。登录后顶部有「管理后台」，可查看所有用户的训练效果对比与曲线，或重置密码。
- **家属远程查看**：个人「训练报告」页面支持一键生成只读分享链接（`/share/<token>`），家人无需登录即可在手机上实时查看训练进展。

## 外网部署方式

### 方式一：Render 免费云托管（无需买服务器和域名）
仓库已内置 [render.yaml](render.yaml) 与 [Dockerfile](Dockerfile)，在 Render 中选择 **New + → Blueprint** 关联本仓库即可自动部署并获得 `https://` 公网地址。

### 方式二：本地运行 + Cloudflare Tunnel（零成本，数据存在本地）
1. 双击 [启动网站.bat](启动网站.bat)（或运行 `npm run build && npm start`）启动本地服务 `http://localhost:3001`。
2. 运行 `cloudflared tunnel --url http://localhost:3001` 即可生成临时公网 `https://` 地址。

### 方式三：自有云服务器 Docker 部署
```bash
docker compose up -d --build
```
部署前请修改 `docker-compose.yml` 中的 `JWT_SECRET`。
