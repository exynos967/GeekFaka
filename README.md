# GeekFaka - 极客发卡系统

它专为独立开发者、创作者和数字商品卖家设计，提供从商品展示、下单购买、支付对接（易支付/支付宝/微信）到自动发货、邮件通知、优惠折扣的完整闭环。

## 📸 界面预览

### 前台首页 (Dark Mode)
![Index](images/index.png)

### 沉浸式购买弹窗
![Checkout](images/buy.png)

### 现代化仪表盘 (ECharts)
*(支持可视化收入趋势图、今日数据统计与缺货预警)*

### 智能公告系统
*(支持全屏自动弹窗、窄幅滚动条、Markdown 格式渲染)*

## ✨ 核心特性

- **🚀 双模式架构**：开发支持 **SQLite**，生产环境支持 **MySQL/PostgreSQL**，大文本内容自动优化。
- **🐳 Docker 一键部署**：内置 Dockerfile (Node.js 20) 与 Docker-compose，5分钟内完成全环境搭建。
- **🎨 极客 UI**：极致深色模式，毛玻璃质感，商品卡片悬停详情预览，全平台响应式适配。
- **📈 深度仪表盘**：集成 **ECharts** 趋势图，支持今日收入、订单统计（时区优化）及缺货预警。
- **💳 支付网关**：内置 **易支付 (EPay)** 适配器，支持 MD5 和 **RSA 高安全签名**。
- **🎫 优惠码系统**：支持**固定金额/百分比折扣**，可绑定特定商品或分类，内置**外部批量创建 API**。
- **📩 邮件发货**：集成 **Resend** 服务，支付成功后自动将格式化后的卡密发送至客户邮箱。
- **📑 内容管理 (CMS)**：内置文章管理系统，可轻松发布购买教程、常见问题、服务协议等页面。
- **📦 灵活发货格式**：支持普通卡密、账号(----密码)、虚拟卡(|)、代理IP(:)等多种格式的智能分割与展示。
- **🔐 安全加固**：后台采用 **JWT (JSON Web Token)** 认证，支持 API Key 保护，Session 稳定可靠。

## 🚀 快速开始

### 方式 A：Docker 部署 (推荐生产环境)

这是最简单且最安全的方式，自动配置环境。

1. **下载配置文件**：
   你只需要 `docker-compose.yml` 文件。
   ```bash
   wget https://raw.githubusercontent.com/exynos967/GeekFaka/main/docker-compose.yml
   ```

2. **配置参数**：
   修改 `docker-compose.yml` 中的数据库和站点地址，并在同目录的 `.env` 中配置 `ADMIN_PASSWORD`、`JWT_SECRET`。JWT_SECRET 必须是独立随机值，至少 32 字节；不再使用管理员密码或默认值作为回退。可选的 `COUPON_API_KEY` 也需使用至少 32 字节的独立随机值，留空则禁用批量优惠码 API。

3. **启动系统**：
   ```bash
   docker-compose up -d
   ```
   访问 `http://localhost:3000` 即可。

---

### 方式 B：本地源码运行 (适合开发)

1. **安装依赖**：
   ```bash
   yarn install
   ```

2. **环境配置**：
   复制 `.env.example` 为 `.env`：
   ```env
   DATABASE_URL="file:./dev.db"
   ADMIN_PASSWORD="请自行设置管理员密码"
   NEXT_PUBLIC_URL="http://localhost:3000"
   JWT_SECRET=""
   ```
   使用 `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` 生成随机密钥并填入 JWT_SECRET。需要批量优惠码 API 时，重新生成一个独立值填入 COUPON_API_KEY。

3. **初始化与运行**：
   ```bash
   npx prisma db push
   yarn dev
   ```

## 📖 功能指南

### 订单与优惠码
- 非零金额订单只预留优惠码，付款并发货成功后才核销；优惠码订单不自动释放，可在订单详情继续支付原订单。
- 重试同一优惠码时，须填写原联系方式并保持商品、数量一致，系统会返回原订单。支付初始化失败时不会创建订单或占用优惠码。
- 已有关联订单的优惠码不能编辑或删除；有关联订单或优惠码的商品请使用下架。
- 手续费由服务端计算并计入订单应付金额；继续支付沿用原订单金额。

### 邮件补发与升级
- 支付确认后等待邮件发送结果，邮件故障不撤销已经完成的发货。后台订单显示邮件发送状态，未发送的已支付订单可点击“补发邮件”重试；无需重新补单。
- 升级后旧的无有效期会话将失效，管理员需要重新登录。请替换旧的默认 JWT/API 密钥；本次修复没有新增数据库字段。

### 后台管理
- 地址：`/admin`
- 核心模块：仪表盘统计、商品分类管理、订单列表（带补单）、优惠码配置、文章发布。

### 邮件发货 (Resend)
1. 在 [Resend](https://resend.com) 获取 API Key。
2. 后台“系统设置” -> “邮件通知”中开启并填入 Key 和经验证的发件人邮箱。

### 批量创建优惠码 API
- 路径：`POST /api/v1/coupons/bulk`
- 鉴权：Header 携带 `X-API-KEY` (需在环境变量 `COUPON_API_KEY` 配置)。

## 🤝 参与贡献

欢迎提交 Issue 和 Pull Request！

## 📄 开源协议

本项目采用 [MIT License](LICENSE) 开源。
