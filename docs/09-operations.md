# 09 · IP 与 DNS 服务运维

从原 CLAUDE.md 移入的部署资料。只有在发布或运维任务授权范围内执行；测试入口与隔离要求以根手册为准。IP 服务命令的工作目录是 `packages/ip-service/`。



### Components

| Component | Location | Address |
|-----------|----------|---------|
| dns-probe | jp2.nocoo.cloud (Docker) | 74.226.88.37:53/UDP |
| collector | Cloudflare Worker | echo-collector.worker.hexly.ai |
| NS delegation | Cloudflare DNS | `d.echo.nocoo.cloud` → `ns1.echo.nocoo.cloud` |

### dns-probe Maintenance (jp2)

```bash
# SSH access
ssh -p 52722 nocoo@jp2.nocoo.cloud

# Logs
cd ~/echo/packages/dns-probe
docker compose logs -f

# Update code and rebuild
cd ~/echo && git pull
cd packages/dns-probe && docker compose up -d --build

# Restart without rebuild
docker compose restart

# Status check
docker compose ps
```

- Container has `restart: unless-stopped` — survives VPS reboot
- `systemd-resolved` stub listener disabled (`DNSStubListener=no` in `/etc/systemd/resolved.conf`)
- UFW rule: `53/udp ALLOW` (comment: DNS-probe)
- WORKER_URL: `https://echo-collector.worker.hexly.ai`

### collector Worker Maintenance

```bash
# Deploy (from packages/collector/)
cd packages/collector && npx wrangler deploy

# Tail logs
npx wrangler tail echo-collector

# KV inspection
npx wrangler kv key list --binding ECHO
npx wrangler kv key get --binding ECHO "dns:<token>"
```

- KV namespace: `echo` (id: `c8b08f1809d2416db8f2c0270c0a04a9`)
- TTL: 300s per token entry

### NS Records (Cloudflare)

| Type | Name | Value | Proxy |
|------|------|-------|-------|
| NS | `d` | `ns1.echo.nocoo.cloud` | Off |
| A | `ns1` | `74.226.88.37` | Off |

If jp2 IP changes, update both the `ns1` A record and Uptime Kuma monitoring.
