import { cx } from "@emotion/css";
import { type FC, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Check, KeyRound, ShieldCheck, type LucideIcon, SlidersHorizontal } from "lucide-react";
import { RendererAgent } from "@/wins/agent/lib/agent";
import AppModal from "@/common/components/display/modal";
import AppToast from "@/common/components/display/toast";
import FormSelect, { type FormSelectOption } from "@/common/components/data-input/form-select";
import type { ModalRender } from "@/common/components/display/modal/modal-provider";
import type {
  ProviderConfigView,
  ProviderDescriptor,
  ProviderConfigInput
} from "@mahiru/agent/browser";

type ProviderConfigValue = number | string | boolean;
type ProviderFormValues = Record<string, ProviderConfigValue>;

type ProviderFieldType = "number" | "string" | "boolean" | "integer";

type ProviderConfigField = {
  key: string;
  title: string;
  format?: string;
  maximum?: number;
  minimum?: number;
  required: boolean;
  writeOnly?: boolean;
  description?: string;
  type: ProviderFieldType;
  examples: ProviderConfigValue[];
  defaultValue?: ProviderConfigValue;
  enumValues?: ProviderConfigValue[];
};

type AgentConfigForm = {
  name: string;
  provider: string;
  config: ProviderFormValues;
};

type AgentConfigModalProps = {
  defaultProvider?: string;
  providers: ProviderDescriptor[];
  initialConfig?: ProviderConfigView;
  onSaved: NormalFunc<[config: ProviderConfigView]>;
};

type ProviderFieldControlProps = {
  editing?: boolean;
  field: ProviderConfigField;
  value: undefined | ProviderConfigValue;
  onChange: NormalFunc<[value: ProviderConfigValue]>;
};

const SupportedFieldTypes = new Set<ProviderFieldType>(["string", "number", "integer", "boolean"]);

const inputClassName = `
  h-9 w-full rounded-lg border border-white/10 bg-white/5 px-2.5 text-[12px]
  text-white/82 outline-none transition-[border-color,background-color,box-shadow]
  placeholder:text-white/24 hover:bg-white/7 focus:border-primary/60 focus:bg-white/8
  focus:ring-2 focus:ring-primary/12 disabled:cursor-not-allowed disabled:opacity-40
`;

const isConfigValue = (value: unknown): value is ProviderConfigValue =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean";

const isSchemaObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readProviderFields = (provider?: ProviderDescriptor): ProviderConfigField[] => {
  const schema = isSchemaObject(provider?.configSchema) ? provider.configSchema : undefined;
  const properties = isSchemaObject(schema?.["properties"]) ? schema["properties"] : undefined;
  if (!properties) return [];

  const required = new Set(
    Array.isArray(schema?.["required"])
      ? schema["required"].filter((key): key is string => typeof key === "string")
      : []
  );
  return Object.entries(properties).flatMap(([key, rawSchema]) => {
    if (!isSchemaObject(rawSchema)) return [];

    const type = rawSchema["type"];
    if (typeof type !== "string" || !SupportedFieldTypes.has(type as ProviderFieldType)) return [];

    const rawEnum = rawSchema["enum"];
    const enumValues =
      Array.isArray(rawEnum) && rawEnum.length && rawEnum.every(isConfigValue)
        ? rawEnum
        : undefined;
    const examples = Array.isArray(rawSchema["examples"])
      ? rawSchema["examples"].filter(isConfigValue)
      : [];

    return [
      {
        key,
        examples,
        type: type as ProviderFieldType,
        required: required.has(key),
        title: typeof rawSchema["title"] === "string" ? rawSchema["title"] : key,
        ...(enumValues ? { enumValues } : {}),
        ...(isConfigValue(rawSchema["default"]) ? { defaultValue: rawSchema["default"] } : {}),
        ...(typeof rawSchema["description"] === "string"
          ? { description: rawSchema["description"] }
          : {}),
        ...(typeof rawSchema["format"] === "string" ? { format: rawSchema["format"] } : {}),
        ...(typeof rawSchema["writeOnly"] === "boolean"
          ? { writeOnly: rawSchema["writeOnly"] }
          : {}),
        ...(typeof rawSchema["minimum"] === "number" ? { minimum: rawSchema["minimum"] } : {}),
        ...(typeof rawSchema["maximum"] === "number" ? { maximum: rawSchema["maximum"] } : {})
      }
    ];
  });
};

const readUnsupportedRequiredFields = (
  provider: undefined | ProviderDescriptor,
  fields: ProviderConfigField[]
) => {
  const supported = new Set(fields.map((field) => field.key));
  const schema = isSchemaObject(provider?.configSchema) ? provider.configSchema : undefined;
  const required = Array.isArray(schema?.["required"])
    ? schema["required"].filter((key): key is string => typeof key === "string")
    : [];
  return required.filter((key) => !supported.has(key));
};

const createDefaultConfig = (provider?: ProviderDescriptor): ProviderFormValues => {
  return Object.fromEntries(
    readProviderFields(provider).map((field) => {
      const value =
        field.defaultValue ?? field.enumValues?.[0] ?? (field.type === "boolean" ? false : "");
      return [field.key, value];
    })
  );
};

const createDefaultForm = (provider?: ProviderDescriptor): AgentConfigForm => ({
  name: provider?.label ?? "",
  provider: provider?.id ?? "",
  config: createDefaultConfig(provider)
});

const createEditForm = (
  provider: Undefinable<ProviderDescriptor>,
  snapshot: ProviderConfigView
): AgentConfigForm => {
  const defaults = createDefaultConfig(provider);
  const fields = readProviderFields(provider);
  const snapshotConfig: ProviderFormValues = {
    model: snapshot.model,
    apiKey: "",
    contextSize: snapshot.contextSize,
    thinking: snapshot.thinking,
    ...(snapshot.baseUrl ? { baseUrl: snapshot.baseUrl } : {})
  };
  return {
    name: snapshot.name,
    provider: snapshot.provider,
    config: Object.fromEntries(
      fields.map((field) => [
        field.key,
        field.writeOnly ? "" : (snapshotConfig[field.key] ?? defaults[field.key] ?? "")
      ])
    )
  };
};

const isEmptyFieldValue = (value: undefined | ProviderConfigValue) =>
  value === undefined || (typeof value === "string" && !value.trim());

const normalizeProviderConfig = (
  fields: ProviderConfigField[],
  values: ProviderFormValues
): ProviderFormValues => {
  return Object.fromEntries(
    fields.flatMap((field) => {
      const value = values[field.key];
      if (value === undefined || isEmptyFieldValue(value)) return [];
      if (field.type === "number" || field.type === "integer") {
        const number = typeof value === "number" ? value : Number(value);
        return Number.isFinite(number) ? [[field.key, number] as const] : [];
      }
      return [[field.key, typeof value === "string" ? value.trim() : value] as const];
    })
  );
};

const enumValueKey = (value: ProviderConfigValue) => `${typeof value}:${String(value)}`;

const enumValueLabel = (value: ProviderConfigValue) => {
  if (typeof value === "boolean") return value ? "启用" : "关闭";
  if (typeof value === "number") return String(value);
  return value
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
};

const isWideProviderField = (field: ProviderConfigField) =>
  field.key === "baseUrl" ||
  (field.type === "string" && field.key !== "model" && !field.enumValues?.length);

export function createAgentConfigModal(props: AgentConfigModalProps): ModalRender {
  const editing = !!props.initialConfig;
  return {
    width: 560,
    className: "agent-config-modal",
    title: editing ? "编辑模型配置" : "添加模型配置",
    subTitle: editing ? "更新连接信息" : "连接模型服务",
    contentClassName: "agent-config-modal-scroll agent-scroll",
    content: <AgentConfigFormContent {...props} />
  };
}

// eslint-disable-next-line react-refresh/only-export-components
const AgentConfigFormContent: FC<AgentConfigModalProps> = ({
  onSaved,
  providers,
  initialConfig,
  defaultProvider
}) => {
  const editing = !!initialConfig;
  const initialProvider =
    providers.find((provider) => provider.id === (initialConfig?.provider ?? defaultProvider)) ??
    providers[0];
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() =>
    initialConfig
      ? createEditForm(initialProvider, initialConfig)
      : createDefaultForm(initialProvider)
  );
  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.id === form.provider),
    [form.provider, providers]
  );
  const fields = useMemo(() => readProviderFields(selectedProvider), [selectedProvider]);
  const unsupportedRequiredFields = useMemo(
    () => readUnsupportedRequiredFields(selectedProvider, fields),
    [fields, selectedProvider]
  );
  const providerOptions = useMemo<FormSelectOption[]>(
    () =>
      providers.map((provider) => ({
        value: provider.id,
        label: provider.label,
        description: provider.description,
        title: provider.description
      })),
    [providers]
  );

  const requiredFieldMissing = fields.some(
    (field) =>
      field.required && !(editing && field.writeOnly) && isEmptyFieldValue(form.config[field.key])
  );
  const disabled =
    saving ||
    !selectedProvider ||
    !form.name.trim() ||
    requiredFieldMissing ||
    unsupportedRequiredFields.length > 0;

  const selectProvider = (providerID: string) => {
    if (editing) return;
    const provider = providers.find((item) => item.id === providerID);
    setForm(createDefaultForm(provider));
  };

  const updateConfigValue = (key: string, value: ProviderConfigValue) => {
    setForm((current) => ({
      ...current,
      config: { ...current.config, [key]: value }
    }));
  };

  const credentialFields = fields.filter((field) => field.writeOnly);
  const advancedFields = fields.filter((field) => ["contextSize", "thinking"].includes(field.key));
  const primaryFields = fields.filter(
    (field) => !field.writeOnly && !advancedFields.includes(field)
  );

  const saveConfig = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled || !selectedProvider) return;

    setSaving(true);
    try {
      const values = normalizeProviderConfig(fields, form.config);
      const payload: ProviderConfigInput = {
        name: form.name.trim(),
        provider: selectedProvider.id,
        model: String(values["model"] ?? "").trim(),
        apiKey: String(values["apiKey"] ?? ""),
        contextSize: String(values["contextSize"] ?? "128K").trim(),
        default: initialConfig?.default ?? false,
        thinking: values["thinking"] === true,
        ...(typeof values["baseUrl"] === "string" && values["baseUrl"].trim()
          ? { baseUrl: values["baseUrl"].trim() }
          : {}),
        ...(initialConfig?.headers ? { headers: initialConfig.headers } : {}),
        ...(initialConfig?.other !== undefined ? { other: initialConfig.other } : {})
      };
      const result = initialConfig
        ? await RendererAgent.updateConfig({ id: initialConfig.id, config: payload })
        : await RendererAgent.createConfig(payload);
      if (!result.ok) {
        AppToast.show({ type: "error", text: result.reason.message });
        return;
      }

      onSaved(result.data);
      AppToast.show({ type: "success", text: editing ? "配置已更新" : "配置已创建" });
      AppModal.close();
    } catch (error) {
      AppToast.show({
        type: "error",
        text: `${editing ? "更新" : "创建"}配置失败：${String(error)}`
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="agent-config-form grid gap-3 text-[12px]" onSubmit={saveConfig}>
      <section className="grid gap-2.5 rounded-xl border border-white/8 bg-white/[0.025] p-3">
        <SectionHeading title="基础信息" description="为这组连接设置一个容易识别的名称" />
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <FieldLabel title="Provider" required>
            <FormSelect
              label="Provider"
              value={form.provider}
              options={providerOptions}
              disabled={editing || !providers.length}
              placeholder={providers.length ? "选择 Provider" : "暂无 Provider"}
              onChange={selectProvider}
            />
          </FieldLabel>
          <FieldLabel title="配置名称" required>
            <input
              className={inputClassName}
              value={form.name}
              placeholder="例如：DeepSeek 日常"
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              autoFocus
            />
          </FieldLabel>
        </div>
        {selectedProvider?.description && (
          <p className="text-[10px] leading-4 text-white/32">{selectedProvider.description}</p>
        )}
      </section>

      {unsupportedRequiredFields.length > 0 && (
        <div className="rounded-lg border border-amber-300/18 bg-amber-300/7 px-3 py-2 text-[10px] leading-4 text-amber-100/72">
          当前界面暂不支持必填字段：{unsupportedRequiredFields.join("、")}
        </div>
      )}

      {primaryFields.length > 0 && (
        <section className="grid gap-2.5">
          <SectionHeading title="模型与接口" description="选择调用方式和兼容服务地址" />
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {primaryFields.map((field) => (
              <div
                key={field.key}
                className={cx(isWideProviderField(field) ? "sm:col-span-2" : undefined)}>
                <ProviderFieldControl
                  field={field}
                  value={form.config[field.key]}
                  onChange={(value) => updateConfigValue(field.key, value)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {credentialFields.length > 0 && (
        <section className="grid gap-2.5 rounded-xl border border-white/8 bg-black/8 p-3">
          <SectionHeading
            title="访问凭据"
            icon={ShieldCheck}
            description={editing ? "密钥已经安全保存；留空不会修改" : "密钥只会交给主进程保存"}
          />
          {credentialFields.map((field) => (
            <ProviderFieldControl
              key={field.key}
              field={field}
              editing={editing}
              value={form.config[field.key]}
              onChange={(value) => updateConfigValue(field.key, value)}
            />
          ))}
        </section>
      )}

      {advancedFields.length > 0 && (
        <details className="group rounded-xl border border-white/8 bg-white/[0.02]">
          <summary className="flex h-10 cursor-pointer list-none items-center gap-2 px-3 text-[11px] font-medium text-white/55 outline-none hover:text-white/76 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/35">
            <SlidersHorizontal className="size-3.5 text-white/34" />
            高级设置
            <span className="ml-auto text-[9px] font-normal text-white/24">上下文窗口与超时</span>
          </summary>
          <div className="grid grid-cols-1 gap-2.5 border-t border-white/7 p-3 sm:grid-cols-2">
            {advancedFields.map((field) => (
              <ProviderFieldControl
                key={field.key}
                field={field}
                value={form.config[field.key]}
                onChange={(value) => updateConfigValue(field.key, value)}
              />
            ))}
          </div>
        </details>
      )}

      {!fields.length && selectedProvider && (
        <div className="rounded-lg border border-white/8 bg-white/[0.025] px-3 py-3 text-center text-[11px] text-white/38">
          该 Provider 没有可编辑字段。
        </div>
      )}

      <div className="sticky -bottom-4 z-10 -mx-1 flex items-center justify-between gap-3 border-t border-white/8 bg-black/35 px-1 pt-3 pb-0.5 backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-1.5 text-[9px] text-white/30">
          <KeyRound className="size-3.5 shrink-0" />
          <span className="truncate">凭据由 Rust Agent 加密保存</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            className="h-8 cursor-pointer rounded-lg px-3 text-[11px] font-medium text-white/48 outline-none hover:bg-white/6 hover:text-white/72 focus-visible:ring-2 focus-visible:ring-white/35"
            type="button"
            onClick={() => AppModal.close()}>
            取消
          </button>
          <button
            className={cx(
              "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-[11px] font-medium outline-none transition-all focus-visible:ring-2 focus-visible:ring-primary/35 disabled:pointer-events-none disabled:opacity-35",
              disabled
                ? "bg-white/8 text-white/40"
                : "bg-primary text-primary-text hover:brightness-105"
            )}
            type="submit"
            disabled={disabled}>
            <Check className="size-3.5" />
            {saving ? "保存中…" : editing ? "保存更改" : "添加配置"}
          </button>
        </div>
      </div>
    </form>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
const ProviderFieldControl: FC<ProviderFieldControlProps> = ({
  onChange,
  field,
  value,
  editing
}) => {
  if (field.enumValues?.length) {
    const options = field.enumValues.map((item) => ({
      value: enumValueKey(item),
      label: enumValueLabel(item)
    }));
    return (
      <FieldLabel title={field.title} required={field.required} description={field.description}>
        <FormSelect
          options={options}
          label={field.title}
          placeholder={`选择${field.title}`}
          value={value === undefined ? "" : enumValueKey(value)}
          onChange={(key) => {
            const next = field.enumValues?.find((item) => enumValueKey(item) === key);
            if (next !== undefined) onChange(next);
          }}
        />
      </FieldLabel>
    );
  }

  if (field.type === "boolean") {
    const checked = value === true;
    return (
      <FieldLabel title={field.title} required={field.required} description={field.description}>
        <button
          className="flex h-9 w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-2.5 text-left outline-none transition-colors hover:bg-white/8 focus-visible:ring-2 focus-visible:ring-primary/30"
          role="switch"
          type="button"
          aria-checked={checked}
          onClick={() => onChange(!checked)}>
          <span className="text-[11px] font-medium text-white/60">
            {checked ? "已启用" : "已关闭"}
          </span>
          <span
            className={cx(
              "relative h-5 w-9 rounded-full transition-colors",
              checked ? "bg-primary" : "bg-white/15"
            )}>
            <span
              className={cx(
                "absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform",
                checked ? "translate-x-[18px]" : "translate-x-0.5"
              )}
            />
          </span>
        </button>
      </FieldLabel>
    );
  }

  const numeric = field.type === "number" || field.type === "integer";
  const example = field.examples[0];
  const inputType = field.writeOnly || field.format === "password" ? "password" : "text";
  return (
    <FieldLabel title={field.title} required={field.required} description={field.description}>
      <input
        className={inputClassName}
        type={inputType}
        max={field.maximum}
        min={field.minimum}
        inputMode={numeric ? "numeric" : undefined}
        step={field.type === "integer" ? 1 : undefined}
        value={value === undefined ? "" : String(value)}
        aria-required={field.required && !(editing && field.writeOnly)}
        autoComplete={inputType === "password" ? "new-password" : "off"}
        onChange={(event) => onChange(event.target.value)}
        placeholder={
          editing && field.writeOnly
            ? "留空保留当前密钥"
            : example === undefined
              ? `输入${field.title}`
              : String(example)
        }
      />
    </FieldLabel>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
const FieldLabel: FC<{
  title: string;
  required?: boolean;
  children: ReactNode;
  description?: string;
}> = ({ title, children, required, description }) => (
  <label className="grid min-w-0 gap-1">
    <span className="flex items-center gap-1 text-[10px] font-medium text-white/52">
      {title}
      {required && <span className="text-primary/80">*</span>}
    </span>
    {children}
    {description && <span className="text-[9px] leading-4 text-white/28">{description}</span>}
  </label>
);

// eslint-disable-next-line react-refresh/only-export-components
const SectionHeading: FC<{
  title: string;
  icon?: LucideIcon;
  description: string;
}> = ({ title, icon: Icon, description }) => (
  <div className="flex min-w-0 items-start gap-2">
    {Icon && (
      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg border border-white/8 bg-white/4">
        <Icon className="size-3.5 text-white/40" />
      </span>
    )}
    <div className="min-w-0">
      <div className="text-[11px] font-medium text-white/67">{title}</div>
      <div className="mt-px text-[9px] leading-4 text-white/27">{description}</div>
    </div>
  </div>
);
