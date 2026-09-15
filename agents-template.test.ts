import { describe, expect, it } from "vitest";
import {
  AGENTS_BLOCK_END,
  AGENTS_BLOCK_START,
  agentsBlock,
  applyAgentsBlock,
  readManagedBlock,
} from "./agents-template";

const template = "# Правила\n\n- Будь вежлив.";
const block = agentsBlock(template);

describe("agents managed block", () => {
  it("wraps the template between markers", () => {
    expect(block).toBe(
      "<!-- bb-project-folders:agents:start -->\n# Правила\n\n- Будь вежлив.\n<!-- bb-project-folders:agents:end -->",
    );
  });

  it("creates a fresh file with just the block", () => {
    expect(applyAgentsBlock(null, template)).toBe(block + "\n");
    expect(applyAgentsBlock("", template)).toBe(block + "\n");
  });

  it("appends the block below existing content", () => {
    const existing = "# Мои правила\n- Не трогать main\n";
    expect(applyAgentsBlock(existing, template)).toBe(
      existing + "\n" + block + "\n",
    );
    expect(applyAgentsBlock("# без перевода строки", template)).toBe(
      "# без перевода строки\n\n" + block + "\n",
    );
  });

  it("replaces the block in place and keeps surrounding content", () => {
    const existing = `# Верх\n\n${block}\n\n# Низ\n`;
    const updated = applyAgentsBlock(existing, "Новый шаблон");
    expect(updated).toBe(
      `# Верх\n\n${agentsBlock("Новый шаблон")}\n\n# Низ\n`,
    );
  });

  it("is idempotent when the template did not change", () => {
    const once = applyAgentsBlock("# Правила проекта\n", template);
    expect(applyAgentsBlock(once, template)).toBeNull();
    expect(applyAgentsBlock(block + "\n", template)).toBeNull();
  });

  it("does nothing without a template", () => {
    expect(applyAgentsBlock(null, "")).toBeNull();
    expect(applyAgentsBlock(null, "   \n")).toBeNull();
    expect(applyAgentsBlock("# текст\n", "  ")).toBeNull();
  });

  it("extracts the current managed block for prefilling editors", () => {
    const file = `# Мои правила\n\n${block}\n\nХвост\n`;
    expect(readManagedBlock(file)).toBe(template.trim());
    expect(readManagedBlock(block)).toBe(template.trim());
    expect(readManagedBlock("# без блока\n")).toBeNull();
    expect(readManagedBlock(null)).toBeNull();
  });

  it("exports the marker constants used in documentation", () => {
    expect(AGENTS_BLOCK_START).toContain("bb-project-folders:agents");
    expect(AGENTS_BLOCK_END).toContain("bb-project-folders:agents");
    expect(block.startsWith(AGENTS_BLOCK_START)).toBe(true);
    expect(block.endsWith(AGENTS_BLOCK_END)).toBe(true);
  });
});
