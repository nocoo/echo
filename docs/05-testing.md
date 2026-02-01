# 测试与覆盖率

## 测试执行

```bash
bun run test
bun run test:e2e
bun run test:all
```

## 覆盖率目标

- 单元测试覆盖率目标：90%+

## E2E 要求

- 通过真实启动服务进行 API 校验
- pre-push 阶段运行 UT + E2E + lint
- E2E 依赖本地已下载 xdb

## Lint 要求

```bash
bun run lint
```

- 0 warning / 0 error
