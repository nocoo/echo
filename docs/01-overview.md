# 概览

本项目是一个仅提供 API 的 IP 查询服务，目标部署到 Vercel 与 Railway。

## 目标

- 提供 RESTful API，返回客户端 IP、IP 库信息、服务端延迟
- 仅 API 访问，无前端页面
- IP 数据在构建/部署阶段下载，不进入 Git
- 速度优先，Bun + TypeScript
- 严格 TDD，UT 覆盖率目标 90%+，lint 0 warning/error

## 文档结构

- 02-features.md：主要功能说明
- 03-architecture.md：目录结构与关键模块
- 04-development.md：本地开发与运行
- 05-testing.md：测试与覆盖率要求
- 06-docs-rules.md：文档与提交规范
