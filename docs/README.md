# AI+PBL 师生双向选择系统

> 面向 AI+PBL 实训项目的师生双向互选平台，覆盖**学生端 / 教师端 / 管理端**三端，完整呈现「第一轮录取 → 每轮后调剂分流 → 多轮补录 → 待选池」全流程。

---

## 目录结构

```
clone/
├── backend/         # 后端（Spring Boot 3.3.5 + MyBatis-Plus + MySQL 8 + JWT）
│   ├── src/
│   ├── test/        # e2e.ps1 端到端验证脚本
│   └── sql/         # schema.sql（建库建表）、seed_demo.sql（演示数据）
├── frontend/        # 前端（原生 HTML/CSS/JS，零构建）
│   ├── index.html
│   ├── css/styles.css
│   └── js/{app,api,data,student,teacher,admin}.js
└── docs/            # 本文档、需求文档、用户故事、API 接口文档、验证报告
```

---

## 一、前端运行

前端为纯静态页面，无需构建。

### 方式 1：本地静态服务器（推荐）

```powershell
# 在项目根目录执行（前端用 5500，避免与后端 8080 冲突）
python -m http.server 5500
```

浏览器访问 `http://localhost:5500/frontend/index.html`。

### 方式 2：直接打开

双击 `frontend/index.html` 即可（部分浏览器对 `file://` 字体加载有限制，推荐方式 1）。

> 前端默认使用模拟数据独立运行。对接后端见下文「前后端联调」。

---

## 二、后端运行

### 环境要求

| 依赖 | 版本 |
|------|------|
| JDK | 17+ |
| Maven | 3.9+ |
| MySQL | 8.0+ |

### 1. 准备数据库

```powershell
# 在项目根目录执行
mysql -uroot -p < backend/sql/schema.sql       # 建库建表（库名 leb-sele）
mysql -uroot -p < backend/sql/seed_demo.sql    # 可选：演示数据（12 老师 20 学生，密码均 123456）
```

### 2. 配置数据库连接（环境变量，无需改代码）

```powershell
# MySQL 密码（必填，按你的实际密码设置）
$env:DB_PASSWORD="你的MySQL密码"
# 可选覆盖：DB_HOST / DB_PORT / DB_NAME / DB_USERNAME / JWT_SECRET

# 首次运行需设置 JAVA_HOME（按你的 JDK 安装路径）
$env:JAVA_HOME="C:\Program Files\Java\jdk-17"
$env:PATH="$env:JAVA_HOME\bin;$env:PATH"
```

> **注意**：本项目 pom.xml 已将 Lombok 锁定为 `1.18.48` 以兼容较新的 JDK。若使用 JDK 17/21 可直接运行。

### 3. 启动后端

```powershell
cd backend
mvn spring-boot:run
```

启动成功后：
- 服务地址：`http://localhost:8080`
- Swagger 文档：`http://localhost:8080/swagger-ui.html`
- API 基址：`http://localhost:8080/api`

### 示范账号（密码统一 `123456`）

| 角色 | 账号 | 姓名 |
|------|------|------|
| 管理员 | `admin` | 超级管理员 |
| 教师 | `T-SD01` | 林工 |
| 学生（顺利匹配） | `S-A01` | 张一 |
| 学生（需终选） | `S-B01` | 赵四 |
| 学生（进待选池） | `S-G01` | 杨阳 |

---

## 三、前后端联调

### 全局约定

| 项 | 值 |
|----|----|
| 前端地址 | `http://localhost:5500/frontend/index.html` |
| 后端地址 | `http://localhost:8080` |
| API Base URL | `http://localhost:8080/api` |
| 认证 | JWT，请求头 `Authorization: Bearer <token>` |
| 统一响应 | `{ "code": 0, "message": "success", "data": {...} }` |
| 成功判断 | `code === 0` |

### 接入步骤

1. 在 `frontend/js/app.js` 中配置 `API_BASE = "http://localhost:8080/api"` 与 token 存储。
2. 封装带 `Authorization` 头的 `fetch` 请求方法，统一处理 `code !== 0` 的错误。
3. 将 `frontend/js/data.js` 中的模拟数据替换为对应接口返回（字段已与后端 VO 对齐）。

主要接口：`POST /api/auth/login`、`GET /api/public/rooms`、`GET /api/public/teachers`、`GET /api/student/status`、`POST /api/student/choices`、`GET /api/teacher/candidates`、`POST /api/teacher/picks`、`POST /api/teacher/diversion/picks`、`POST /api/admin/flow/rounds/{id}/diversion/system-place` 等。

完整接口契约见 `docs/API接口文档.md`。

### CORS 处理

前后端不同端口会触发跨域，需在后端开启 CORS（允许前端来源），或使用前端代理转发 `/api`。

---

## 四、功能一览

**学生端**：流程时间线、跨实训室选 3 平行志愿、调剂意愿设置（实训室内/校内，可多选/单选/不选）、面试安排、终选确认、录取结果。

**教师端**：名额概览、候选学生选拔（仅看选自己的学生）、面试安排与评分、调剂范围内选生、录取名单。

**管理端**：数据统计总览、基础数据与名额配置、流程阶段控制、系统统筹（实训室内→全院两级优先级）、待选池约谈与人工安置。

---

## 五、设计主题

**软件工程学院 · 深蓝学术 + 青色科技**

- 配色：深墨蓝底色 + 青色科技主调 + 琥珀高亮，配合四色步骤徽章（绿 / 橙 / 蓝 / 青）
- 字体：Chakra Petch（标题）+ IBM Plex Sans（正文）+ IBM Plex Mono（数据）
- 特色：点阵网格背景、玻璃拟态卡片、青色辉光、8 步垂直流程时间线
