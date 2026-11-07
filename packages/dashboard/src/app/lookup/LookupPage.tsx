import { Button, Field, Input, LayerCard } from "@nocoo/basalt";
import { PageHeader } from "@nocoo/basalt/components/page-header";
import { Search } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { LookupResultSkeleton } from "../../components/island-skeleton";
import { ProviderCard } from "../../components/visual/ProviderCard";
import { apiClient } from "../../lib/api";
import { LookupHero } from "./LookupHero";
import { useLookup } from "./use-lookup";

const EXAMPLES = ["8.8.8.8", "1.1.1.1"];

export default function LookupPage() {
  const [ip, setIp] = useState("");
  const { loading, error, model, submit } = useLookup(apiClient);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit(ip);
  };

  return (
    <div className="space-y-basalt-layout-lg">
      <PageHeader title="IP 查询" description="使用管理台会话查询任意地址的四路数据源结果。" />

      <LayerCard>
        <form
          className="flex flex-col gap-basalt-layout md:flex-row md:items-end"
          onSubmit={onSubmit}
        >
          <Field label="目标地址" htmlFor="lookup-ip" className="flex-1">
            <Input
              id="lookup-ip"
              value={ip}
              placeholder="留空则查询当前 IP"
              onChange={(event) => setIp(event.target.value)}
            />
          </Field>
          <Button
            type="submit"
            loading={loading}
            icon={<Search className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
          >
            查询
          </Button>
        </form>
        <div className="mt-basalt-space-sm flex flex-wrap items-center gap-basalt-space-sm">
          <span className="text-basalt-xs text-basalt-muted-foreground">示例</span>
          {EXAMPLES.map((example) => (
            <Button key={example} variant="outline" size="sm" onClick={() => setIp(example)}>
              {example}
            </Button>
          ))}
        </div>
      </LayerCard>

      {error ? (
        <p className="rounded-basalt-md bg-basalt-danger-tint px-basalt-space-md py-basalt-space-sm text-basalt-sm text-basalt-danger">
          {error}
        </p>
      ) : null}

      {loading && !model ? <LookupResultSkeleton /> : null}

      {model ? (
        <>
          <LookupHero model={model} />
          <div className="grid auto-rows-fr gap-basalt-layout md:grid-cols-2 xl:grid-cols-4">
            {model.providers.map((provider) => (
              <ProviderCard key={provider.name} provider={provider} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
