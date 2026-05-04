import { describe, expect, it } from "vitest";

import { lintMarkdown } from "../src/lintMarkdown";

describe("lintMarkdown", () => {
  it("returns no issues for a valid markdown document", () => {
    const markdown = `---
title: Hello World
author: Cesar
---

# Heading

Some content.`;

    expect(lintMarkdown(markdown)).toEqual({
      ok: true,
      issues: [],
    });
  });

  it("reports an error when required metadata is missing", () => {
    const markdown = `---
author: Cesar
---

Content`;

    expect(lintMarkdown(markdown)).toEqual({
      ok: false,
      issues: [
        {
          ruleId: "metadata-required-non-empty",
          message: 'Required metadata field "title" is missing.',
          severity: "error",
          line: 1,
          column: 1,
        },
      ],
    });
  });

  it("reports an error when the title metadata is empty", () => {
    const markdown = `---
title:
---

Content`;

    expect(lintMarkdown(markdown)).toEqual({
      ok: false,
      issues: [
        {
          ruleId: "metadata-required-non-empty",
          message: 'Required metadata field "title" cannot be empty.',
          severity: "error",
          line: 2,
          column: 1,
        },
      ],
    });
  });

  it("reports trailing spaces with line and column", () => {
    const markdown = `---
title: Hello
---

Text with spaces   `;

    expect(lintMarkdown(markdown)).toEqual({
      ok: false,
      issues: [
        {
          ruleId: "no-trailing-spaces",
          message: "Trailing spaces are not allowed.",
          severity: "error",
          line: 5,
          column: 17,
        },
      ],
    });
  });

  it("reports multiple blank lines", () => {
    const markdown = `---
title: Hello
---


Text`;

    expect(lintMarkdown(markdown)).toEqual({
      ok: false,
      issues: [
        {
          ruleId: "no-multiple-blank-lines",
          message: "Multiple consecutive blank lines are not allowed.",
          severity: "error",
          line: 5,
          column: 1,
        },
      ],
    });
  });

  it("collects issues from different rules in one run", () => {
    const markdown = `---
title:
---


Text with spaces   `;

    expect(lintMarkdown(markdown)).toEqual({
      ok: false,
      issues: [
        {
          ruleId: "metadata-required-non-empty",
          message: 'Required metadata field "title" cannot be empty.',
          severity: "error",
          line: 2,
          column: 1,
        },
        {
          ruleId: "no-multiple-blank-lines",
          message: "Multiple consecutive blank lines are not allowed.",
          severity: "error",
          line: 5,
          column: 1,
        },
        {
          ruleId: "no-trailing-spaces",
          message: "Trailing spaces are not allowed.",
          severity: "error",
          line: 6,
          column: 17,
        },
      ],
    });
  });

  it("supports disabling individual rules through config", () => {
    const markdown = `---
title:
---


Text with spaces   `;

    expect(
      lintMarkdown(markdown, {
        rules: {
          "metadata-required-non-empty": { enabled: false },
          "no-trailing-spaces": { enabled: false },
        },
      }),
    ).toEqual({
      ok: false,
      issues: [
        {
          ruleId: "no-multiple-blank-lines",
          message: "Multiple consecutive blank lines are not allowed.",
          severity: "error",
          line: 5,
          column: 1,
        },
      ],
    });
  });

  it("supports changing the required metadata field through config", () => {
    const markdown = `---
summary: Ready
---

Body`;

    expect(
      lintMarkdown(markdown, {
        rules: {
          "metadata-required-non-empty": { field: "summary" },
        },
      }),
    ).toEqual({
      ok: true,
      issues: [],
    });
  });
});
