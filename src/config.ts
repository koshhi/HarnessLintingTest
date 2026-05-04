import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

import { parse as parseYaml } from "yaml";

export type ToggleRuleConfig = {
  enabled?: boolean;
};

export type MetadataRequiredNonEmptyRuleConfig = ToggleRuleConfig & {
  field?: string;
};

export type LintConfig = {
  rules?: {
    "metadata-required-non-empty"?: MetadataRequiredNonEmptyRuleConfig;
    "no-trailing-spaces"?: ToggleRuleConfig;
    "no-multiple-blank-lines"?: ToggleRuleConfig;
  };
};

export type ResolvedLintConfig = {
  rules: {
    "metadata-required-non-empty": {
      enabled: boolean;
      field: string;
    };
    "no-trailing-spaces": {
      enabled: boolean;
    };
    "no-multiple-blank-lines": {
      enabled: boolean;
    };
  };
};

const DEFAULT_REQUIRED_METADATA_FIELD = "title";
const DEFAULT_CONFIG_FILE_NAMES = [
  "markdown-lint.config.json",
  "markdown-lint.config.yaml",
  "markdown-lint.config.yml",
];

export function resolveLintConfig(config?: LintConfig): ResolvedLintConfig {
  return {
    rules: {
      "metadata-required-non-empty": {
        enabled: config?.rules?.["metadata-required-non-empty"]?.enabled ?? true,
        field:
          config?.rules?.["metadata-required-non-empty"]?.field ??
          DEFAULT_REQUIRED_METADATA_FIELD,
      },
      "no-trailing-spaces": {
        enabled: config?.rules?.["no-trailing-spaces"]?.enabled ?? true,
      },
      "no-multiple-blank-lines": {
        enabled: config?.rules?.["no-multiple-blank-lines"]?.enabled ?? true,
      },
    },
  };
}

export async function loadLintConfig(options: {
  cwd: string;
  configPath?: string;
}): Promise<LintConfig> {
  const configPath = options.configPath
    ? options.configPath
    : await findDefaultConfigPath(options.cwd);

  if (!configPath) {
    return {};
  }

  const content = await readConfigFile(configPath);
  return parseLintConfig(configPath, content);
}

async function findDefaultConfigPath(cwd: string): Promise<string | null> {
  for (const fileName of DEFAULT_CONFIG_FILE_NAMES) {
    const candidate = join(cwd, fileName);

    try {
      await access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
}

async function readConfigFile(configPath: string): Promise<string> {
  try {
    return await readFile(configPath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read config "${configPath}": ${message}`);
  }
}

function parseLintConfig(configPath: string, content: string): LintConfig {
  const lowerCasePath = configPath.toLowerCase();

  try {
    if (lowerCasePath.endsWith(".json")) {
      return normalizeLintConfig(JSON.parse(content));
    }

    if (lowerCasePath.endsWith(".yaml") || lowerCasePath.endsWith(".yml")) {
      return normalizeLintConfig(parseYaml(content));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse config "${configPath}": ${message}`);
  }

  throw new Error(
    `Unsupported config format for "${configPath}". Use .json, .yaml, or .yml.`,
  );
}

function normalizeLintConfig(input: unknown): LintConfig {
  if (input === undefined || input === null) {
    return {};
  }

  if (!isRecord(input)) {
    throw new Error("Config root must be an object.");
  }

  const rules = isRecord(input.rules) ? input.rules : undefined;

  return {
    rules: {
      "metadata-required-non-empty": normalizeMetadataRule(
        rules?.["metadata-required-non-empty"],
      ),
      "no-trailing-spaces": normalizeToggleRule(rules?.["no-trailing-spaces"]),
      "no-multiple-blank-lines": normalizeToggleRule(
        rules?.["no-multiple-blank-lines"],
      ),
    },
  };
}

function normalizeMetadataRule(input: unknown): MetadataRequiredNonEmptyRuleConfig | undefined {
  if (input === undefined) {
    return undefined;
  }

  if (!isRecord(input)) {
    throw new Error('Rule "metadata-required-non-empty" must be an object.');
  }

  const result: MetadataRequiredNonEmptyRuleConfig = {};

  if (typeof input.enabled === "boolean") {
    result.enabled = input.enabled;
  }

  if (typeof input.field === "string") {
    result.field = input.field;
  }

  return result;
}

function normalizeToggleRule(input: unknown): ToggleRuleConfig | undefined {
  if (input === undefined) {
    return undefined;
  }

  if (!isRecord(input)) {
    throw new Error("Rule config must be an object.");
  }

  const result: ToggleRuleConfig = {};

  if (typeof input.enabled === "boolean") {
    result.enabled = input.enabled;
  }

  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
