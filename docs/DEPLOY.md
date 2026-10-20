# My Tools 部署文档（宝塔 + CentOS + 阿里云）

项目：FastAPI + Node.js(sharp) 混合应用
部署目录：`/www/wwwroot/my-tools`

---

## 架构说明

```
浏览器 ──► Nginx（80/443，账号密码校验）──► uvicorn（127.0.0.1:6666，仅本机可访问）
```

- **Nginx**：宝塔管理的站点，负责账号密码校验（HTTP Basic Auth）、反向代理、HTTPS
- **Python 端**：`web_ui/main.py`（FastAPI），依赖 `fastapi uvicorn python-multipart openpyxl Faker python-docx`
- **Node 端**：`js-image-cropper`（sharp 图片处理，Node ≥ 18，通过子进程调用）
- uvicorn 只监听 `127.0.0.1:6666`，外网**不能**直接访问 6666，只能经过 Nginx，所以绕不过密码
- 注意：本地的 `run.py` / `run.bat` 是 Windows 专用，服务器上不使用

---

## 1. 端口

### 1.1 阿里云安全组

阿里云控制台 → ECS 实例 → 安全组 → 配置规则 → 入方向，确认放行：

| 协议 | 端口 | 授权对象 | 说明 |
|------|------|---------|------|
| TCP  | 80   | 0.0.0.0/0 | HTTP |
| TCP  | 443  | 0.0.0.0/0 | HTTPS（有域名并配置证书时） |

> **不要**放行 6666。如果之前放行过，删掉这条规则。

### 1.2 宝塔防火墙

宝塔面板 → 安全 → 防火墙：确认 80 / 443 已放行；6666 **不要**放行（已放行的删除）。

### 1.3 确认端口空闲

```bash
ss -tlnp | grep 6666
# 无输出 = 空闲；有输出说明被占用，先处理
```

---

## 2. 上传代码

### 方式一：Git（推荐）

```bash
yum install git -y
cd /www/wwwroot
git clone <你的仓库地址> my-tools
```

### 方式二：宝塔文件面板上传

本地**用最新代码重新打包** zip（**排除以下文件/目录**），在宝塔「文件」面板上传到 `/www/wwwroot` 后解压并重命名为 `my-tools`：

```
node_modules/      # sharp 是平台相关二进制，必须在服务器上重装
.venv/
__pycache__/
web_ui/uploads/*   # 保留空目录
web_ui/outputs/*   # 保留空目录
test_image.jpg
docs/              # 可选
```

> 目录结构必须保持原样，`main.py` 通过相对路径引用兄弟目录。

---

## 3. 安装 Node.js 依赖

宝塔 → 软件商店 → 安装「Node.js版本管理器」→ 安装 Node 18 或 20。

```bash
cd /www/wwwroot/my-tools/js-image-cropper

# 国内服务器必须用镜像源，否则 sharp 二进制下载超时
npm install --registry=https://registry.npmmirror.com

# 验证 sharp 可用
node -e "import('sharp').then(()=>console.log('sharp ok'))"
```

---

## 4. 安装 Python 依赖

```bash
cd /www/wwwroot/my-tools

# CentOS 自带 python3 若低于 3.10，先在宝塔安装高版本 Python
python3 --version

python3 -m venv .venv
source .venv/bin/activate

pip install fastapi uvicorn python-multipart openpyxl Faker python-docx \
    -i https://mirrors.aliyun.com/pypi/simple/
```

---

## 5. 手动测试启动

```bash
cd /www/wwwroot/my-tools
source .venv/bin/activate
PYTHONPATH=/www/wwwroot/my-tools uvicorn web_ui.main:app --host 127.0.0.1 --port 6666
```

另开一个 SSH 窗口，在服务器上验证：

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:6666/
# 输出 200 即正常
```

确认后回到第一个窗口 `Ctrl+C` 停止，进入下一步配置常驻运行。

---

## 6. 配置常驻运行（二选一）

### 方式一：systemd（推荐，稳定可控）

```bash
cat > /etc/systemd/system/mytools.service << 'EOF'
[Unit]
Description=My Tools Web UI
After=network.target

[Service]
WorkingDirectory=/www/wwwroot/my-tools
Environment=PYTHONPATH=/www/wwwroot/my-tools
# 资源限制（均可省略，括号内为默认值）
# 单个上传文件上限 MB（20）、批量最多文件数（50）、Excel 最多行数（10000）
Environment=MAX_UPLOAD_MB=20
Environment=MAX_BATCH_FILES=50
Environment=MAX_EXCEL_ROWS=10000
# outputs/ 与 uploads/ 中超过 N 小时的文件自动删除（默认 0 = 不清理，服务器上建议开启）
Environment=OUTPUT_TTL_HOURS=24
# 只监听本机，外网必须经过 Nginx（带密码）访问
ExecStart=/www/wwwroot/my-tools/.venv/bin/uvicorn web_ui.main:app --host 127.0.0.1 --port 6666
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now mytools
systemctl status mytools
```

常用命令：

```bash
systemctl restart mytools   # 重启
systemctl stop mytools      # 停止
journalctl -u mytools -f    # 查看实时日志
```

> 修改了 service 文件（比如调整限制参数）后，要先 `systemctl daemon-reload` 再 `systemctl restart mytools`。

### 方式二：宝塔「Python项目管理器」

软件商店安装「Python项目管理器」→ 添加项目：

- 项目路径：`/www/wwwroot/my-tools`
- 虚拟环境：`/www/wwwroot/my-tools/.venv`
- 启动方式：uvicorn
- 启动命令：`uvicorn web_ui.main:app --host 127.0.0.1 --port 6666`（**host 必须是 127.0.0.1**）
- 端口：`6666`（**不要**勾选"放行端口"）
- 环境变量：按需添加 `PYTHONPATH=/www/wwwroot/my-tools`、`OUTPUT_TTL_HOURS=24` 等（含义同方式一）

---

## 7. Nginx 站点 + 反向代理

### 7.1 添加站点

宝塔 → 网站 → 添加站点：

- **域名**：
  - 有域名：填域名（如 `tools.example.com`），并在域名解析里加一条 A 记录指向服务器 IP
  - 没有域名：直接填服务器公网 IP
- PHP 版本：纯静态
- 数据库：不创建

> ⚠️ **阿里云中国大陆服务器**：域名必须完成 ICP 备案，否则通过域名访问 80/443 会被阿里云拦截。
> 未备案时只能用 IP 访问，且无法申请 HTTPS 证书（见 7.4 的风险说明）。

### 7.2 配置反向代理

站点设置 → 反向代理 → 添加反向代理：

- 代理名称：`mytools`
- 目标 URL：`http://127.0.0.1:6666`
- 发送域名：`$host`

### 7.3 调整上传大小与超时（必须做）

Nginx 默认只允许 1MB 的请求体（宝塔一般改成了 50MB），批量上传图片会直接报 `413 Request Entity Too Large`；批量转换耗时较长也可能超时。

站点设置 → 配置文件，在 `server { ... }` 里面（任意位置，建议放在 `server_name` 那一行下面）加上：

```nginx
    # 单次请求最大体积：批量上传多张图片时需要足够大
    client_max_body_size 200m;
    # 批量转换可能需要较长时间
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
```

保存即生效（宝塔会自动检查语法并重载）。

> `client_max_body_size` 是整次请求的上限，应用自己还有单文件上限 `MAX_UPLOAD_MB`（默认 20MB）和批量文件数上限 `MAX_BATCH_FILES`（默认 50），两者都会生效。

### 7.4 HTTPS（有已备案域名时强烈建议）

站点设置 → SSL → Let's Encrypt → 勾选域名 → 申请；申请成功后打开「强制 HTTPS」。

> 不开 HTTPS 时，Basic Auth 的账号密码在网络上是**明文**传输的（只是 Base64 编码）。
> 用 IP 访问、无法配证书时，请至少使用一个**只用于这里的独立密码**，不要和其他账号共用。

---

## 8. 账号密码访问（Basic Auth）

以下两种方式**选一种**即可。推荐先试方式一，按 8.3 验证；如果验证不通过（打开页面没有弹密码框），改用方式二。

### 8.1 方式一：宝塔面板「加密访问」

站点设置 → 访问限制 → 加密访问 → 添加：

- 名称：`mytools`
- 加密访问目录：`/`
- 用户名 / 密码：自己设定

> 部分宝塔版本中，「加密访问」与「反向代理」同时使用时不生效（请求直接被代理走，不弹密码框）。
> 务必按 8.3 验证，不生效就删掉这条加密访问，改用方式二。

### 8.2 方式二：手动配置（任何版本都可靠）

**① 生成密码文件**（SSH 执行，把 `admin` 换成你想要的用户名，回车后按提示输入两次密码）：

```bash
printf "admin:$(openssl passwd -apr1)\n" > /www/server/nginx/conf/mytools.htpasswd
chmod 644 /www/server/nginx/conf/mytools.htpasswd
cat /www/server/nginx/conf/mytools.htpasswd   # 应看到 admin:$apr1$... 一行
```

**② 在站点配置里启用**：站点设置 → 配置文件，在 `server { ... }` 里面（与 7.3 加的内容放在一起即可）加上：

```nginx
    # 整个站点需要账号密码；写在 server 级别，对反向代理同样生效
    auth_basic "My Tools";
    auth_basic_user_file /www/server/nginx/conf/mytools.htpasswd;
```

保存即生效。

> 注意：如果申请 Let's Encrypt 证书时提示验证失败，先临时注释掉这两行（行首加 `#`），申请成功后再恢复。

### 8.3 验证鉴权是否生效

在**自己电脑**上执行（把地址换成你的域名或 IP；Windows 可用 Git Bash 或 PowerShell 里的 `curl.exe`）：

```bash
# 1. 不带密码：应返回 401
curl -s -o /dev/null -w '%{http_code}\n' http://你的域名或IP/

# 2. 带正确密码：应返回 200
curl -s -o /dev/null -w '%{http_code}\n' -u admin:你的密码 http://你的域名或IP/

# 3. 直接访问 6666：应连接失败或超时（说明外网绕不过 Nginx）
curl -s -m 5 -o /dev/null -w '%{http_code}\n' http://服务器IP:6666/
```

三项都符合预期才算配置完成。然后用浏览器打开，应该会弹出用户名/密码框，输入一次后浏览器会记住。

### 8.4 日后管理账号（方式二）

```bash
# 修改密码（覆盖原文件，只保留这一个账号）
printf "admin:$(openssl passwd -apr1)\n" > /www/server/nginx/conf/mytools.htpasswd

# 增加一个账号（追加，注意是 >>）
printf "zhangsan:$(openssl passwd -apr1)\n" >> /www/server/nginx/conf/mytools.htpasswd

# 删除某个账号
sed -i '/^zhangsan:/d' /www/server/nginx/conf/mytools.htpasswd

# 查看现有账号
cut -d: -f1 /www/server/nginx/conf/mytools.htpasswd
```

改密码文件后**无需重启**，下次请求即生效（浏览器可能缓存了旧密码，关掉浏览器重新打开即可）。

如果用的是方式一（宝塔加密访问），在 站点设置 → 访问限制 里直接编辑即可。

---

## 9. 验证功能

浏览器访问 `https://你的域名`（或 `http://服务器IP`），输入账号密码后依次测试：

| 功能 | 验证点 |
|------|--------|
| 图片格式转换 | 验证 Node / sharp 正常 |
| 批量转换（选多张图） | 验证 Nginx 上传大小与超时配置 |
| Excel 生成 | 验证 openpyxl / Faker |
| Word 删除线清理 | 验证 python-docx |
| Word 转 Markdown | 验证 python-docx |

---

## 10. 日常维护

### 更新代码

```bash
cd /www/wwwroot/my-tools
git pull
# 如果依赖有变化：
source .venv/bin/activate && pip install <新依赖>
cd js-image-cropper && npm install --registry=https://registry.npmmirror.com
systemctl restart mytools
```

### 清理上传/输出文件

已由应用自动处理：设置了 `OUTPUT_TTL_HOURS=24`（见第 6 步）后，`uploads/`、`outputs/` 中超过 24 小时的文件会被自动删除，无需再配计划任务。

### 排查问题

```bash
# 应用是否在监听（应显示 127.0.0.1:6666）
ss -tlnp | grep 6666

# 应用状态与日志
systemctl status mytools
journalctl -u mytools -n 100 --no-pager

# 绕过 Nginx 直接测应用（在服务器上执行）
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:6666/

# Nginx 错误日志（宝塔默认路径，文件名为站点名）
tail -n 50 /www/wwwlogs/你的站点名.error.log
```

| 现象 | 可能原因 |
|------|---------|
| 502 Bad Gateway | 应用没启动或崩溃 → `systemctl status mytools` |
| 413 Request Entity Too Large | 未做 7.3，或 `client_max_body_size` 太小 |
| 504 Gateway Timeout | 批量转换太久 → 调大 7.3 中的 `proxy_read_timeout` |
| 不弹密码框直接能访问 | 鉴权没生效 → 按 8.3 排查，改用 8.2 方式二 |
| 一直弹密码框、密码正确也进不去 | 密码文件路径写错或权限不对 → 检查 8.2 ① 的 `cat` 输出与 `chmod` |
| 返回 `{"detail":"File too large ..."}` | 超过应用的单文件上限 → 调大 `MAX_UPLOAD_MB` |

---

## 常见坑

1. **sharp 装不上**：必须 `npm install --registry=https://registry.npmmirror.com`；不要从 Windows 拷贝 `node_modules`。
2. **Python 版本**：需要 ≥ 3.10；CentOS 7 自带源已停止维护，可能需要切换 vault 或阿里镜像源。
3. **改了代码不生效**：忘记 `systemctl restart mytools`。
4. **外网访问不通**：依次检查 应用状态 → Nginx 站点 → 宝塔防火墙（80/443）→ 阿里云安全组（80/443）。
5. **域名打不开但 IP 能打开**：大陆服务器域名未备案，被阿里云拦截。
6. **uvicorn 写成了 `--host 0.0.0.0`**：外网可直接访问 6666 绕过密码。务必用 `127.0.0.1`，并按 8.3 第 3 条验证。
