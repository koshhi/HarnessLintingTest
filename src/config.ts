import { access, readFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { parse as parseYaml } from "yaml";

export type ToggleRuleConfig = {
  enabled?: boolean;
};

export type MetadataRequiredNonEmptyRuleConfig = ToggleRuleConfig & {
  field?: string;
  fields?: string[];
};

export type RequireLinksRuleConfig = ToggleRuleConfig;

export type RuleSetConfig = {
  "metadata-required-non-empty"?: MetadataRequiredNonEmptyRuleConfig;
  "no-trailing-spaces"?: ToggleRuleConfig;
  "no-multiple-blank-lines"?: ToggleRuleConfig;
  "require-links"?: RequireLinksRuleConfig;
};

export type LintOverrideConfig = {
  files: string[];
  rules?: RuleSetConfig;
};

export type LintConfig = {
  rules?: RuleSetConfig;
  overrides?: LintOverrideConfig[];
};

export type ResolvedLintConfig = {
  rules: {
    "metadata-required-non-empty": {
      enabled: boolean;
      fields: string[];
    };
    "no-trailing-spaces": {
      enabled: boolean;
    };
    "no-multiple-blank-lines": {
      enabled: boolean;
    };
    "require-links": {
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
  return resolveLintConfigForFile(config);
}

export function resolveLintConfigForFile(
  config?: LintConfig,
  filePath?: string,
): ResolvedLintConfig {
  const normalizedConfig = normalizeLintConfig(config);
  const overrideRules = filePath
    ? collectOverrideRules(normalizedConfig.overrides, filePath)
    : undefined;
  const mergedRules = mergeRuleSets(normalizedConfig.rules, overrideRules);

  return {
    rules: {
      "metadata-required-non-empty": {
        enabled: mergedRules?.["metadata-required-non-empty"]?.enabled ?? true,
        fields:
          mergedRules?.["metadata-required-non-empty"]?.fields ??
          toFieldsArray(mergedRules?.["metadata-required-non-empty"]?.field),
      },
      "no-trailing-spaces": {
        enabled: mergedRules?.["no-trailing-spaces"]?.enabled ?? true,
      },
      "no-multiple-blank-lines": {
        enabled: mergedRules?.["no-multiple-blank-lines"]?.enabled ?? true,
      },
      "require-links": {
        enabled: mergedRules?.["require-links"]?.enabled ?? false,
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
  const overrides = Array.isArray(input.overrides) ? input.overrides : undefined;

  return {
    rules: normalizeRuleSet(rules),
    overrides: overrides?.map(normalizeOverride),
  };
}

function normalizeOverride(input: unknown): LintOverrideConfig {
  if (!isRecord(input)) {
    throw new Error('Each override must be an object.');
  }

  if (!Array.isArray(input.files) || input.files.length === 0) {
    throw new Error('Each override must include a non-empty "files" array.');
  }

  const files = input.files.map((value) => {
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error('Override file patterns must be non-empty strings.');
    }

    return value.trim();
  });

  const rules = isRecord(input.rules) ? input.rules : undefined;

  return {
    files,
    rules: normalizeRuleSet(rules),
  };
}

function normalizeRuleSet(input: Record<string, unknown> | undefined): RuleSetConfig | undefined {
  if (!input) {
    return undefined;
  }

  return {
    "metadata-required-non-empty": normalizeMetadataRule(
      input["metadata-required-non-empty"],
    ),
    "no-trailing-spaces": normalizeToggleRule(input["no-trailing-spaces"]),
    "no-multiple-blank-lines": normalizeToggleRule(
      input["no-multiple-blank-lines"],
    ),
    "require-links": normalizeToggleRule(input["require-links"]),
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

  if (input.enabled !== undefined) {
    if (typeof input.enabled !== "boolean") {
      throw new Error('Rule "metadata-required-non-empty.enabled" must be a boolean.');
    }

    result.enabled = input.enabled;
  }

  if (input.field !== undefined) {
    if (typeof input.field !== "string" || input.field.trim() === "") {
      throw new Error('Rule "metadata-required-non-empty.field" must be a non-empty string.');
    }

    result.field = input.field.trim();
  }

  if (input.fields !== undefined) {
    if (!Array.isArray(input.fields) || input.fields.length === 0) {
      throw new Error(
        'Rule "metadata-required-non-empty.fields" must be a non-empty array of strings.',
      );
    }

    result.fields = input.fields.map((value) => {
      if (typeof value !== "string" || value.trim() === "") {
        throw new Error(
          'Rule "metadata-required-non-empty.fields" must be a non-empty array of strings.',
        );
      }

      return value.trim();
    });
  }

  if (result.field && result.fields) {
    throw new Error(
      'Rule "metadata-required-non-empty" cannot define both "field" and "fields".',
    );
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

  if (input.enabled !== undefined) {
    if (typeof input.enabled !== "boolean") {
      throw new Error('Rule "enabled" must be a boolean.');
    }

    result.enabled = input.enabled;
  }

  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function collectOverrideRules(
  overrides: LintOverrideConfig[] | undefined,
  filePath: string,
): RuleSetConfig | undefined {
  if (!overrides || overrides.length === 0) {
    return undefined;
  }

  let mergedRules: RuleSetConfig | undefined;

  for (const override of overrides) {
    if (override.files.some((pattern) => matchesPattern(filePath, pattern))) {
      mergedRules = mergeRuleSets(mergedRules, override.rules);
    }
  }

  return mergedRules;
}

function mergeRuleSets(
  baseRules: RuleSetConfig | undefined,
  overrideRules: RuleSetConfig | undefined,
): RuleSetConfig | undefined {
  if (!baseRules && !overrideRules) {
    return undefined;
  }

  return {
    "metadata-required-non-empty": {
      ...baseRules?.["metadata-required-non-empty"],
      ...overrideRules?.["metadata-required-non-empty"],
    },
    "no-trailing-spaces": {
      ...baseRules?.["no-trailing-spaces"],
      ...overrideRules?.["no-trailing-spaces"],
    },
    "no-multiple-blank-lines": {
      ...baseRules?.["no-multiple-blank-lines"],
      ...overrideRules?.["no-multiple-blank-lines"],
    },
    "require-links": {
      ...baseRules?.["require-links"],
      ...overrideRules?.["require-links"],
    },
  };
}

function matchesPattern(filePath: string, pattern: string): boolean {
  const normalizedPath = filePath.replaceAll("\\", "/");
  const normalizedPattern = pattern.replaceAll("\\", "/");
  const fileName = basename(normalizedPath);

  if (!normalizedPattern.includes("/")) {
    return wildcardToRegExp(normalizedPattern).test(fileName);
  }

  return wildcardToRegExp(normalizedPattern).test(normalizedPath);
}

function wildcardToRegExp(pattern: string): RegExp {
  let source = "^";

  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    const nextCharacter = pattern[index + 1];

    if (character === "*" && nextCharacter === "*") {
      source += ".*";
      index += 1;
      continue;
    }

    if (character === "*") {
      source += "[^/]*";
      continue;
    }

    if (character === "?") {
      source += ".";
      continue;
    }

    source += escapeRegExp(character);
  }

  source += "$";
  return new RegExp(source);
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function toFieldsArray(field: string | undefined): string[] {
  return field ? [field] : [DEFAULT_REQUIRED_METADATA_FIELD];
}
