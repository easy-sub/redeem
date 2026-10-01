# 鹈鹕骑行

一个使用 Vue 3 和 SVG 制作的鹈鹕骑行介绍页。页面用一只骑单车的鹈鹕作为轻量测试场景，展示骑行、车轮、云、树和路面的动画，可手动暂停或播放，并遵循系统的减少动态效果设置。

## 本地开发

需要 Node.js 20 和 pnpm 10。

```bash
pnpm install --frozen-lockfile
pnpm dev
```

默认访问 `http://localhost:5175`。使用 `VITE_API_PROXY_TARGET` 可指定开发环境中的 API 上游，默认值为 `http://127.0.0.1:8088`。

## 构建与部署

```bash
pnpm build
```

构建结果位于 `dist/`。Docker 镜像会用 Nginx 提供静态页面，并通过 `API_UPSTREAM` 转发 `/api/` 请求：

```bash
docker build -t pelican-ride .
docker run -p 8080:80 -e API_UPSTREAM=https://api.example.com pelican-ride
```

API 上游须能处理原路径 `/api/v1/sub/...`。`proxy_pass` 地址末尾不加 `/`，以保留原始请求路径。静态站点自行部署时，也应保留同样的 `/api/` 转发规则；不要把 API 请求回退到 `index.html`。

现有 API 请求模块保留在 `src/services/api.js`，但介绍页不发起兑换请求。
