# AI+PBL 师生双向选择系统 — 前端

> 原生 HTML / CSS / JavaScript 实现，零构建、零依赖。覆盖学生端 / 教师端 / 管理端三端，完整呈现「第一轮录取 → 每轮后调剂分流 → 多轮补录 → 待选池」全流程。

---

## 一、技术栈

| 项 | 选型 |
|----|------|
| 结构 | 原生 HTML + CSS + 原生 JS（无框架） |
| 路由 | 自研轻量 SPA 状态分发（`js/app.js`） |
| 字体 | Chakra Petch（标题）+ IBM Plex Sans（正文）+ IBM Plex Mono（数据），Google Fonts CDN |
| 数据层 | 默认使用 `js/data.js` 中的模拟数据，可替换为后端 API 调用 |

无 `package.json`、无 Node 依赖。

---

## 二、目录结构

```
frontend/
├── index.html          # 应用入口：顶栏 + 角色切换 + 侧边栏 + 内容容器
├── css/
│   └── styles.css      # 完整设计系统（CSS 变量、组件、动画、响应式）
├── js/
│   ├── data.js         # 模拟数据（6 实训室 / 20 导师 / 学生 / 流程阶段）
│   ├── app.js          # 状态管理、路由、侧边栏、通用工具（toast / modal）
│   ├── student.js      # 学生端 5 个视图
│   ├── teacher.js      # 教师端 4 个视图
│   └── admin.js        # 管理端 5 个视图
└── README.md           # 本文档
```

---

## 三、运行方式

前端为纯静态页面，需通过 HTTP 服务器访问（避免 `file://` 下的字体与跨域限制）。

### 方式 1：Python 静态服务器（推荐）

```powershell
# 在 frontend 目录或项目根目录执行
python -m http.server 5500
```

浏览器访问：`http://localhost:5500/frontend/index.html`

> 端口建议使用 5500，避免与后端默认 8080 冲突。

### 方式 2：VS Code Live Server

安装 VS Code 插件 **Live Server**，右键 `index.html` → `Open with Live Server`。

### 方式 3：直接打开

双击 `index.html` 即可运行，但 `file://` 协议可能导致 Google Fonts 不加载，推荐方式 1。

---

## 四、功能模块

### 学生端
- **流程概览**：8 步垂直流程时间线 + 状态统计卡片
- **选择导师**：6 实训室导师卡片、跨室选 3 平行志愿、调剂意愿（实训室内 / 校内，可多选 / 单选 / 不选）
- **面试安排**：3 志愿导师面试时间表
- **最终确认**：≥2 位导师录取时自主选 1 位
- **录取结果**：录取结果展示 + 入组须知

### 教师端
- **招生概览**：名额进度条、流程节点、本轮候选 / 已选统计
- **我的候选生**：仅看选自己的学生、按名额上限选拔、面试评分
- **调剂选生**：每轮后从调剂范围（实训室内 / 全校）选生
- **录取名单**：含调剂生的最终名单

### 管理端
- **数据总览**：录取率环图、6 实训室录取进度、统计卡片
- **基础数据**：导师名额配置表
- **流程控制**：阶段开关、公布剩余名额、启动调剂分流
- **系统统筹**：两级优先级（实训室内 → 全院）、启动统筹
- **待选池**：约谈 + 人工安置

---

## 五、对接后端

后端为同项目下 `../backend`（Spring Boot 3 + MyBatis-Plus + MySQL），默认端口 **8080**。

### 5.1 全局约定

| 项 | 值 |
|----|----|
| API Base URL | `http://localhost:8080/api` |
| 认证方式 | JWT，请求头 `Authorization: Bearer <token>` |
| 统一响应格式 | `{ "code": 0, "message": "success", "data": {...} }` |
| 成功判断 | `code === 0` |
| 角色码 | `1`=学生，`2`=老师，`3`=管理员 |

### 5.2 接入步骤

#### 步骤 1：配置 API 基址与 token 存储

在 `js/app.js` 顶部添加：

```js
const API_BASE = "http://localhost:8080/api";
const TOKEN_KEY = "pbl_token";

function getToken() { return localStorage.getItem(TOKEN_KEY) || ""; }
function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
function clearToken() { localStorage.removeItem(TOKEN_KEY); }
```

#### 步骤 2：封装带鉴权的请求方法

```js
async function api(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + getToken(),
      ...(options.headers || {}),
    },
  });
  const json = await res.json();
  if (json.code === 401) { clearToken(); /* 跳转登录 */ }
  if (json.code !== 0) throw new Error(json.message || "请求失败");
  return json.data;
}
```

#### 步骤 3：替换模拟数据为接口调用

将 `js/data.js` 中对应的模拟数据替换为接口返回。例如学生端「选择导师」视图：

```js
// 原：const teachers = DATA.TEACHERS;
// 改为：
const teachers = await api("/public/teachers");
const rooms = await api("/public/rooms");
```

`GET /api/public/teachers` 返回 `TeacherCardVO` 列表（含 `remaining` 实时剩余名额），字段与 `DATA.TEACHERS` 结构对齐，可直接替换。

### 5.3 主要接口映射

| 前端模块 | 接口 | 说明 |
|----------|------|------|
| 登录 | `POST /api/auth/login` | `{username, password}` → `{token, user}` |
| 当前用户 | `GET /api/auth/me` | 含角色与扩展字段 |
| 实训室列表 | `GET /api/public/rooms` | 6 个实训室 |
| 导师列表 | `GET /api/public/teachers?roomId=` | 含实时剩余名额 |
| 流程总览 | `GET /api/public/flow` | 当前轮次与阶段 |
| **学生端** | | |
| 综合状态 | `GET /api/student/status` | 学生首页聚合数据 |
| 提交志愿 | `POST /api/student/choices` | `{teacherIds, allowInternal, allowCrossRoom}` |
| 我的面试 | `GET /api/student/interviews` | 面试时间表 |
| 选中我的老师 | `GET /api/student/pickers` | 终选依据 |
| 学生终选 | `POST /api/student/final-choice` | `{teacherId}` |
| 录取结果 | `GET /api/student/result` | 含分流历史 |
| **教师端** | | |
| 我的档案 | `GET /api/teacher/profile` | 名额 / 剩余名额 |
| 候选学生 | `GET /api/teacher/candidates?roundId=` | 选我做志愿的学生 |
| 安排面试 | `POST /api/teacher/interviews` | 面试时间 |
| 录入面试成绩 | `PUT /api/teacher/interviews/{id}` | 成绩与评价 |
| 选择学生 | `POST /api/teacher/picks` | 暂选（阶段③） |
| 调剂候选 | `GET /api/teacher/diversion/candidates` | 分流阶段 |
| 调剂选生 | `POST /api/teacher/diversion/picks` | 立即录取 |
| 录取名单 | `GET /api/teacher/students` | 含调剂来源 |
| **管理端** | | |
| 数据总览 | `GET /api/admin/stats/summary` | 录取统计 |
| 各实训室统计 | `GET /api/admin/stats/by-room` | |
| 导师管理 | `GET/POST/PUT /api/admin/teachers` | 含名额设置 |
| 启动轮次 | `POST /api/admin/flow/rounds/{id}/start` | |
| 推进阶段 | `POST /api/admin/flow/rounds/{id}/next-stage` | 自动处理终选 / 分流收尾 |
| 系统统筹 | `POST /api/admin/flow/rounds/{id}/diversion/system-place` | 两级优先级 |
| 待选池 | `GET /api/admin/wait-pool` | |
| 人工安置 | `POST /api/admin/wait-pool/{studentId}/settle` | `{teacherId, remark}` |
| 导出 | `GET /api/admin/stats/export` | CSV |

完整接口契约见 `../docs/API接口文档.md`。

### 5.4 CORS 处理

前后端不同端口会触发跨域。后端已在 `SecurityConfig` 中配置 CORS（`allowedOriginPatterns("*")`），前端可直接调用 `http://localhost:8080/api`。

若使用 Vite / Webpack 等构建工具，可配置 `proxy` 转发 `/api` 到 `http://localhost:8080`，避免 CORS。

### 5.5 角色切换改造

当前顶栏「学生端 / 教师端 / 管理端」为直接切换视图。对接后端后应改为：

- 登录后根据 `/api/auth/me` 返回的 `role` 字段自动进入对应工作台；
- 顶栏保留角色标识，不再允许自由切换（需退出重新登录）。

---

## 六、示范账号

后端导入 `../backend/sql/seed_demo.sql` 后，以下账号密码统一为 `123456`：

| 角色 | 账号 | 姓名 |
|------|------|------|
| 管理员 | `admin` | 超级管理员 |
| 教师 | `T-SD01` | 林工 |
| 教师 | `T-AI01` | 李大模型 |
| 学生（顺利匹配） | `S-A01` | 张一 |
| 学生（需终选） | `S-B01` | 赵四 |
| 学生（进待选池） | `S-G01` | 杨阳 |

---

## 七、设计主题

**软件工程学院 · 深蓝学术 + 青色科技**

- 配色：深墨蓝底色 + 青色科技主调 + 琥珀高亮，配合四色步骤徽章（绿 / 橙 / 蓝 / 青）
- 字体：Chakra Petch（标题）+ IBM Plex Sans（正文）+ IBM Plex Mono（数据）
- 特色：点阵网格背景、玻璃拟态卡片、青色辉光、8 步垂直流程时间线、录取结果印章

---

## 八、常见问题

**Q：打开页面字体没生效？**
A：需联网加载 Google Fonts；离线环境可将字体下载到本地并在 `index.html` 中改为本地引用。

**Q：对接后端后所有接口返回 401？**
A：检查 `Authorization` 请求头是否携带 `Bearer <token>`，确认登录成功后 token 已存入 `localStorage`。

**Q：跨域报错 `CORS policy`？**
A：后端已开启 CORS（`allowedOriginPatterns("*")`）。若仍报错，确认前端调用地址为 `http://localhost:8080/api` 且后端已启动。

**Q：导师剩余名额显示不对？**
A：`remaining` 由后端实时计算（名额上限 − 已录取 − 本轮暂选），请调用 `GET /api/public/teachers` 获取最新值，不要使用本地缓存。

**Q：后端启动失败提示 Lombok 报错？**
A：本项目 pom.xml 已将 Lombok 锁定为 `1.18.48` 以兼容较新 JDK。使用 JDK 17 / 21 可直接运行。
