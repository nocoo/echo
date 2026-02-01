# 目录结构与模块

## 目录结构

- src/
  - index.ts：服务入口
  - server.ts：Hono 应用与路由
  - services/：查询与缓存逻辑
  - utils/：IP 解析与公共方法
- tests/：单元测试
- scripts/：构建/部署时的数据下载脚本
- docs/：项目文档

## 关键模块

- IP 解析：从请求头中提取真实 IP
- 查询器缓存：加载 xdb 并缓存 1 小时
- 查询服务：结构化解析 region 字段
- 路由层：对外暴露 RESTful API
