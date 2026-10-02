# Campus Reserve 项目结构与功能说明

## 项目定位

Campus Reserve 是校园资源预约平台，支持自习空间、会议与活动室、实验室设备的预约、管理和通知。

项目当前不包含任何金钱业务：没有支付、退款、优惠券、积分、价格、费用、收入或消费统计。

## 技术栈

- 前端：React 18、TypeScript、React Router 6、Vite、原生 CSS。
- 后端：Node.js、Express、TypeScript、PostgreSQL。
- 工程能力：Zod 参数校验、JWT 认证、Nodemailer 邮件、npm Workspaces。

## 常用命令

- npm install：安装依赖。
- npm run dev：同时启动前端和后端开发服务。
- npm run build：构建前后端生产版本。
- npm run db:migrate：创建或升级数据库结构。
- npm run db:seed：清理并写入演示数据。
- npm run db:setup：执行迁移和演示数据初始化。

## 顶层目录

| 路径 | 作用 |
|---|---|
| client | React 前端应用。 |
| server | Express + PostgreSQL 后端应用。 |
| assets | 项目截图和演示素材。 |
| docs | 原有架构和功能资料。 |
| package.json | npm Workspaces、开发、构建和数据库脚本。 |
| README.md | 原始项目说明。 |
| LICENSE | 项目许可证。 |
| PROJECT_STRUCTURE.md | 当前结构和功能文档。 |

## 前端目录和文件

### 入口和基础设施

| 文件 | 作用 |
|---|---|
| client/index.html | 页面 HTML 入口、中文语言、页面标题和主题初始化。 |
| client/src/main.tsx | 创建 React 根节点并渲染 App。 |
| client/src/App.tsx | 定义用户端、账户端和管理端路由。 |
| client/src/api.ts | 封装 API 请求、Token、错误处理和 CSV 下载。 |
| client/src/types.ts | 定义资源、预约、用户、管理员、评价和时段类型。 |
| client/src/format.ts | 中文日期、时间、星期和预约状态格式化。 |
| client/src/theme.ts | 读取、保存和切换浅色/深色主题。 |
| client/src/index.css | 全局设计变量、组件样式、后台样式和移动端响应式样式。 |
| client/vite.config.ts | Vite 开发和生产构建配置。 |
| client/tsconfig.json | 前端 TypeScript 配置。 |
| client/package.json | 前端依赖和构建脚本。 |

### 用户端页面

| 文件 | 作用 |
|---|---|
| client/src/components/Layout.tsx | 用户端公共布局、导航、主题切换和页脚。 |
| client/src/pages/Home.tsx | 校园资源首页和三类资源入口。 |
| client/src/pages/Providers.tsx | 资源列表、资源类型筛选、搜索和收藏入口。 |
| client/src/pages/ProviderDetail.tsx | 资源详情、预约项目、日期、可用时段和预约信息填写。 |
| client/src/pages/Confirmation.tsx | 预约成功页、预约码和周期预约结果。 |
| client/src/pages/Manage.tsx | 通过预约码和邮箱查询、取消、改期和评价预约。 |

### 通用业务组件

| 文件 | 作用 |
|---|---|
| client/src/components/SlotPicker.tsx | 日期和可用时段选择，处理加载、失败和无时段状态。 |
| client/src/components/WaitlistForm.tsx | 没有可用时段时加入候补。 |
| client/src/components/RescheduleDialog.tsx | 改期弹窗和新时段提交。 |
| client/src/components/ReviewForm.tsx | 预约完成后的评分和评价表单。 |
| client/src/components/Stars.tsx | 星级展示、评分输入和平均评分徽章。 |
| client/src/components/ThemeToggle.tsx | 浅色和深色主题切换。 |

### 用户账户

| 文件 | 作用 |
|---|---|
| client/src/customer/Login.tsx | 用户注册和登录页面。 |
| client/src/customer/auth.ts | 用户会话、Token 和登录状态管理。 |
| client/src/customer/Account.tsx | 用户资料、预约记录、取消预约和收藏资源。 |
| client/src/customer/favorites.ts | 收藏资源的加载、添加和删除 Hook。 |

### 管理后台

| 文件 | 作用 |
|---|---|
| client/src/admin/AdminLogin.tsx | 管理员登录。 |
| client/src/admin/AdminLayout.tsx | 后台侧边栏、导航、管理员信息和退出登录。 |
| client/src/admin/Dashboard.tsx | 预约数量、取消率、资源数量、趋势和高峰时段仪表盘。 |
| client/src/admin/Bookings.tsx | 预约筛选、状态变更、事件查看和 CSV 导出。 |
| client/src/admin/DayView.tsx | 日时间轴视图。 |
| client/src/admin/WeekView.tsx | 周预约视图。 |
| client/src/admin/Providers.tsx | 校园资源列表和资源状态管理。 |
| client/src/admin/ProviderEdit.tsx | 资源信息、预约项目、开放时间和临时不可用时间编辑。 |
| client/src/admin/Customers.tsx | 用户搜索、排序和用户列表。 |
| client/src/admin/CustomerDetail.tsx | 用户详情、预约历史和私密备注。 |
| client/src/admin/Reviews.tsx | 评价查询、隐藏和恢复。 |
| client/src/admin/Waitlist.tsx | 候补名单筛选和移除。 |
| client/src/admin/charts.tsx | 柱状图、热力图和横向条形图组件。 |

## 后端目录和文件

### 服务入口和中间件

| 文件 | 作用 |
|---|---|
| server/src/index.ts | 创建 Express 应用、注册路由、健康检查和通知分发器。 |
| server/src/config.ts | 读取端口、数据库、JWT、前端地址和邮件配置。 |
| server/src/middleware/auth.ts | 管理员和用户 JWT 签发、解析和权限校验。 |
| server/src/middleware/errors.ts | 异步路由包装和统一错误响应。 |
| server/src/tsconfig.json | 后端 TypeScript 配置。 |
| server/.env.example | 本地环境变量示例。 |
| server/package.json | 后端依赖、开发、构建和数据库脚本。 |

### 数据库

| 文件 | 作用 |
|---|---|
| server/src/db/pool.ts | 创建 PostgreSQL 连接池。 |
| server/src/db/schema.sql | 数据库表、索引、外键、排他约束和迁移逻辑。 |
| server/src/db/migrate.ts | 创建数据库并执行 schema.sql。 |
| server/src/db/seed.ts | 初始化校园资源、预约项目、排班、用户、评价、收藏和演示预约。 |

主要数据表：

- users：管理员账号。
- providers：校园资源，resource_type 为 study_room、meeting_room 或 equipment。
- services：资源下的预约项目，包含名称、描述、时长和准备缓冲。
- schedules：每周开放时间。
- breaks：固定休息或维护时间。
- time_off：临时不可预约时间。
- customers：预约用户和账户。
- bookings：预约、时间、状态、预约码和备注。
- booking_series：周期预约系列。
- waitlist：候补名单。
- reviews：预约评价。
- favorites：用户收藏。
- notifications：邮件通知 Outbox。
- booking_events：预约事件日志。

### API 路由

| 文件 | 作用 |
|---|---|
| server/src/routes/public.ts | 公共目录、资源详情、可用时段、普通预约、周期预约、候补、查询、取消、评价和改期接口。 |
| server/src/routes/customer.ts | 用户注册、登录、个人资料、用户预约、收藏、评价和改期接口。 |
| server/src/routes/admin.ts | 管理统计、预约管理、日/周视图、资源管理、排班、临时不可用时间、评价和候补接口。 |
| server/src/routes/adminAnalytics.ts | 预约趋势、时段热度、预约项目使用次数、状态和新老用户统计。 |
| server/src/routes/adminCustomers.ts | 用户列表、用户详情、预约记录和私密备注。 |

### 核心业务服务

| 文件 | 作用 |
|---|---|
| server/src/services/slots.ts | 根据开放时间、休息、临时不可用、已有预约、提前时间和预约范围计算时段。 |
| server/src/services/booking.ts | 创建、查询、改期和取消预约；负责事务、资源锁、冲突控制和预约事件。 |
| server/src/services/series.ts | 创建和取消每周/每两周周期预约。 |
| server/src/services/waitlist.ts | 加入候补，并在时段释放后通知候补用户。 |
| server/src/services/reviews.ts | 校验完成预约并保存评价，保证一次预约只能评价一次。 |
| server/src/services/ics.ts | 生成创建、改期和取消用的 ICS 日历邀请。 |

### 通知服务

| 文件 | 作用 |
|---|---|
| server/src/services/notify/types.ts | 通知模板、通知渠道、通知记录和渲染结果类型。 |
| server/src/services/notify/outbox.ts | 将通知写入数据库，解耦预约事务和邮件发送。 |
| server/src/services/notify/dispatcher.ts | 领取待发送通知、发送、重试和清理。 |
| server/src/services/notify/channels.ts | 邮件发送渠道配置。 |
| server/src/services/notify/templates.ts | 预约确认、取消、改期、提醒、周期预约和候补通知模板。 |

## 业务功能

### 用户端

1. 查看校园资源类型。
2. 浏览自习空间、会议与活动室、实验室设备。
3. 搜索资源并查看开放时间、评价和预约项目。
4. 按日期查看实时可用时段。
5. 创建单次预约。
6. 创建每周或每两周周期预约。
7. 通过预约码和邮箱查询预约。
8. 取消预约或修改预约时间。
9. 加入候补名单。
10. 对已完成预约进行评分和评价。
11. 注册账户、管理个人资料和查看预约历史。
12. 收藏常用校园资源。
13. 切换浅色和深色主题。

### 管理端

1. 管理员登录和权限控制。
2. 查看预约数量、取消率、资源数和用户数。
3. 查看预约趋势、热门时段和预约项目使用次数。
4. 查看预约列表、日视图和周视图。
5. 导出预约 CSV。
6. 修改预约状态为已完成、已取消或爽约。
7. 创建、编辑、启用和停用校园资源。
8. 编辑预约项目、时长、准备缓冲和开放时间。
9. 配置固定休息和临时不可用时间。
10. 管理用户和用户私密备注。
11. 审核、隐藏和恢复评价。
12. 查看和处理候补名单。

## 核心预约流程

1. 用户选择资源类型和具体资源。
2. 选择预约项目和日期。
3. SlotPicker 请求后端计算可用时段。
4. 用户填写联系人和预约备注。
5. 后端开启事务并锁定资源。
6. 后端再次验证时段是否仍然可用。
7. 创建预约和预约事件。
8. 写入确认通知和提醒通知。
9. 前端展示预约成功页和预约码。

系统使用三层冲突保护：

- 前端只展示后端返回的可用时段。
- 预约事务使用 PostgreSQL advisory lock。
- bookings 表使用 GiST 排他约束，禁止同一资源的有效预约时间重叠。

## 前端路由

| 路径 | 页面 |
|---|---|
| / | 校园资源首页 |
| /browse/:type | 资源列表 |
| /provider/:id | 资源详情和预约 |
| /confirmation | 预约成功 |
| /manage | 查询和管理预约 |
| /account/login | 用户登录和注册 |
| /account | 用户账户 |
| /admin/login | 管理员登录 |
| /admin | 管理仪表盘 |
| /admin/bookings | 预约管理 |
| /admin/day | 日视图 |
| /admin/week | 周视图 |
| /admin/providers | 资源管理 |
| /admin/providers/:id | 资源编辑 |
| /admin/reviews | 评价管理 |
| /admin/waitlist | 候补管理 |
| /admin/customers | 用户管理 |
| /admin/customers/:id | 用户详情 |

## 状态处理

前端对关键业务统一处理以下状态：

- Loading：资源、预约项目、时段、账户和后台数据加载时展示加载反馈。
- Empty：没有资源、没有项目、没有时段、没有评价和没有候补数据时展示空状态。
- Error：接口失败、预约冲突、查询失败和提交失败时展示错误提示。
- Success：预约、改期、取消、评价和后台保存成功后展示反馈。
- Disabled：提交期间禁用按钮，避免重复提交。

## 适合面试介绍的技术点

- React Router 多角色路由和页面组织。
- TypeScript 领域类型建模。
- 预约流程组件化和状态拆分。
- Loading、Error、Empty、Success 状态设计。
- 自定义 Hook 管理用户会话和收藏。
- 移动端响应式布局和时间选择横向滚动。
- 管理后台表格、时间轴、周视图和数据图表。
- Zod 运行时参数校验。
- JWT 认证和管理员/用户权限隔离。
- 数据库事务、advisory lock 和 GiST 排他约束。
- Outbox 模式和邮件通知重试。
- 周期预约、候补和 ICS 日历邀请。

## 不包含的业务

- 在线支付
- 退款
- 优惠券
- 积分
- 价格和费用
- 收入和消费统计

该项目的核心是校园资源调度、时间冲突控制、预约状态管理、候补和通知协作。
