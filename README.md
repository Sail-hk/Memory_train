# 智忆 · 科学记忆力训练网站

专为 50+ 中老年群体设计的简洁、护眼、自适应认知与记忆训练网站，训练范式依据临床医学论文设计，支持外网登录与跨设备持久化记录。

## 五大科学训练模块

1. **火眼金睛 · 信息处理速度**（依据 ACTIVE 临床试验 / UFOV 视觉搜索范式）
2. **前瞻后顾 · N-Back 工作记忆**（依据 Jaeggi et al., *PNAS* 2008 / *Psychology and Aging* 2014）
3. **温故知新 · 间隔联想记忆**（依据 Camp et al. Spaced Retrieval 间隔提取范式 + SM-2 算法）
4. **步步为营 · 空间顺序记忆**（依据 Corsi Block-Tapping 神经心理学范式）
5. **去伪存真 · 抗干扰专注力**（依据 Stroop 色词抑制 / *Nature* 2013 认知控制研究）

## 本地启动

```bash
npm run build
npm start
```

启动后访问 `http://localhost:3001`。

## 如何做到外网可登录？

### 方式一：本地电脑运行 + Cloudflare Tunnel（零服务器费用，1分钟生成公网 HTTPS 网址）
1. 在本机运行 `npm run build && npm start`（监听 3001 端口）。
2. 安装 `cloudflared` 后运行：
   ```bash
   cloudflared tunnel --url http://localhost:3001
   ```
3. 命令行会输出一个 `https://xxx.trycloudflare.com` 公网地址，发给爸爸在手机/平板/电脑浏览器打开即可登录训练。

### 方式二：部署到云服务器（阿里云 / 腾讯云 / Railway / Fly.io 等）
使用内置的 Docker 配置一键启动：
```bash
docker compose up -d --build
```
记得修改 `docker-compose.yml` 中的 `JWT_SECRET`，并配置域名与 HTTPS 反向代理（如 Caddy / Nginx）。
