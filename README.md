# 订阅兑换前端

## 获取代码与修改页面

克隆仓库并进入项目目录：

```bash
git clone https://github.com/easy-sub/redeem.git
cd redeem
```

要换页面名称或视频，在构建前编辑 `src/config/site.js`：

```js
export const siteConfig = {
  brandName: '你的品牌名',
  tutorialUrl: 'https://example.com/tutorial.mp4',
}
```

`tutorialUrl` 填可直接播放的 MP4 地址。暂时没有视频时留空，页面会显示“视频教程地址”占位文字。页面图标可替换 `public/icon.svg`。如果直接使用 Release 中的压缩包，显示的是该压缩包构建时填写的名称和视频。

## 方式一：宝塔或 1Panel

1. 在面板中创建静态网站，并填写自己的域名。宝塔选择「网站」→「添加站点」，PHP 版本选「纯静态」；1Panel 选择「网站」→「创建网站」→「静态网站」。

2. 从本仓库的 Release 下载 `redeem-web-dist.tar.gz`。在面板的文件管理中打开刚创建的网站目录，上传并解压压缩包，再把 `dist` 文件夹里的全部内容移动到网站根目录。完成后，网站根目录应直接包含 `index.html`、`assets` 和 `icon.svg`，而不是再套一层 `dist`。

   如果 Release 暂无压缩包，可以在已安装 Node.js 20 的机器上进入本项目目录，自行生成：

   ```bash
   corepack enable
   pnpm install --frozen-lockfile
   pnpm build
   tar -czf redeem-web-dist.tar.gz dist
   ```

3. 打开该网站的「配置文件」或「Nginx 配置」，在现有的 `server { ... }` 内加入下面的配置。若已有 `location /`，请替换原有的那一段，不要保留两个。把 `api.example.com` 换成自己的 API 域名：

   ```nginx
   location / {
       try_files $uri $uri/ /index.html;
   }

   location ^~ /api/ {
       proxy_pass https://api.example.com;
       proxy_http_version 1.1;
       proxy_ssl_server_name on;
       proxy_set_header Host $proxy_host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
   }
   ```

   API 域名需要能处理 `/api/...` 请求；`proxy_pass` 地址末尾不要加 `/`。

4. 在面板中保存配置并重载 Nginx/OpenResty。访问网站首页和 `/billing`，再在页面中尝试一次查询，确认 API 请求能正常到达后端。

## 方式二：Docker

在安装了 Docker 的机器上，进入克隆的 `redeem` 目录并运行：

```bash
docker build -t redeem-web .
docker run -d --name redeem-web --restart unless-stopped -p 8080:80 \
  -e API_UPSTREAM=https://api.example.com \
  redeem-web
```

把 `api.example.com` 换成自己的 API 域名。该域名需要能处理 `/api/...` 请求，地址末尾不要加 `/`。

用浏览器打开 `http://服务器地址:8080`，在页面中尝试一次查询。如果页面打不开，运行 `docker logs redeem-web` 查看启动信息；如果页面能打开但接口报错，检查 API 域名是否能从容器内访问。
