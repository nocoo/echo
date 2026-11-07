import {
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  toast,
  useConfirm,
} from "@nocoo/basalt";
import { DataTable, type DataTableColumn } from "@nocoo/basalt/components/data-table";
import { PageHeader } from "@nocoo/basalt/components/page-header";
import { KeyRound } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { StatusDot } from "../../components/visual/StatusDot";
import { type ApiKey, apiClient } from "../../lib/api";
import { formatTimestamp } from "../../lib/format";
import { statusTone } from "../../lib/visual";
import { useKeys } from "./use-keys";

export default function KeysPage() {
  const { loading, error, model, creating, revoking, create, revoke } = useKeys(apiClient);
  const { confirm, dialogProps } = useConfirm();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [secret, setSecret] = useState<string | null>(null);

  const columns: DataTableColumn<ApiKey>[] = [
    { id: "name", header: "名称", accessor: (row) => row.name },
    {
      id: "prefix",
      header: "前缀",
      accessor: (row) => <span className="font-mono text-xs">{row.key_prefix}</span>,
    },
    {
      id: "status",
      header: "状态",
      accessor: (row) => (
        <span className="flex items-center gap-basalt-space-xs">
          <StatusDot tone={statusTone(row.status === "active" ? "ok" : "idle")} />
          <Badge variant={row.status === "active" ? "success" : "secondary"}>
            {row.status === "active" ? "有效" : "已撤销"}
          </Badge>
        </span>
      ),
    },
    {
      id: "createdAt",
      header: "创建时间",
      accessor: (row) => (
        <span className="font-mono text-xs">{formatTimestamp(row.created_at)}</span>
      ),
    },
    {
      id: "lastUsedAt",
      header: "最近使用",
      accessor: (row) => (
        <span className="font-mono text-xs">{formatTimestamp(row.last_used_at)}</span>
      ),
    },
    {
      id: "actions",
      header: "操作",
      accessor: (row) => (
        <Button
          variant="outline"
          size="sm"
          disabled={row.status === "revoked" || revoking}
          onClick={async () => {
            const confirmed = await confirm({
              title: "撤销该 API key？",
              description: `${row.name} 撤销后立即失效，使用该 key 的请求会回落到访客 IP。`,
              confirmLabel: "撤销",
              variant: "destructive",
            });
            if (confirmed) {
              await revoke(row.id);
            }
          }}
        >
          撤销
        </Button>
      ),
    },
  ];

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const created = await create(name.trim());
    if (!created) return;
    setSecret(created.secret);
    setName("");
  };

  const copySecret = () => {
    if (!secret) return;
    void navigator.clipboard
      .writeText(secret)
      .then(() => toast.success("密钥已复制"))
      .catch(() => toast.error("复制失败，请手动选择"));
  };

  const closeDialog = () => {
    if (creating) return;
    setDialogOpen(false);
    setSecret(null);
    setName("");
  };

  return (
    <div className="space-y-basalt-layout-lg">
      <PageHeader
        title="API key"
        description="用于通过 ?ip= 查询指定地址；明文只在创建时显示一次。"
        actions={<Button onClick={() => setDialogOpen(true)}>新建 key</Button>}
      />

      {error ? (
        <p className="rounded-basalt-md bg-basalt-danger-tint px-basalt-space-md py-basalt-space-sm text-basalt-sm text-basalt-danger">
          {error}
        </p>
      ) : null}

      <DataTable
        aria-label="API key 列表"
        data={model?.keys ?? []}
        columns={columns}
        loading={loading}
        empty={
          <span className="flex flex-col items-center gap-basalt-space-xs text-basalt-muted-foreground">
            <KeyRound className="h-6 w-6" strokeWidth={1.5} aria-hidden="true" />
            <span>还没有 API key，新建一个即可查询指定地址。</span>
          </span>
        }
        getRowId={(row) => row.id}
      />

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{secret ? "密钥已生成" : "新建 API key"}</DialogTitle>
            <DialogDescription>
              {secret
                ? "明文只显示这一次，关闭后无法再次查看。"
                : "为这个 key 起一个名字，方便在列表中识别。"}
            </DialogDescription>
          </DialogHeader>

          {secret ? (
            <div className="space-y-basalt-layout">
              <code className="block break-all rounded-basalt-md bg-basalt-secondary px-basalt-space-md py-basalt-space-sm font-mono text-basalt-sm">
                {secret}
              </code>
              <Button variant="outline" onClick={copySecret}>
                复制密钥
              </Button>
            </div>
          ) : (
            <form className="space-y-basalt-layout" onSubmit={submit}>
              <Field label="名称" htmlFor="key-name" required>
                <Input
                  id="key-name"
                  value={name}
                  placeholder="CI 发布流水线"
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
              <DialogFooter>
                <Button variant="ghost" onClick={closeDialog} disabled={creating}>
                  取消
                </Button>
                <Button
                  type="submit"
                  loading={creating}
                  disabled={name.trim().length === 0 || creating}
                >
                  创建
                </Button>
              </DialogFooter>
            </form>
          )}

          {secret ? (
            <DialogFooter>
              <Button onClick={closeDialog} disabled={creating}>
                完成
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
