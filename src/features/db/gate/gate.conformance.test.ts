import { describe, it, expect } from "vitest";
import { classifyGate, type GateInput, type GateAction } from "./gate";
import cases from "./cases.json";

// Conformance harness over the language-neutral cases.json. This same fixture
// is the single source the Rust sidecar reads for its symmetric harness (plan
// §5): TS (UI) and Rust must produce identical verdicts to seal drift.
interface GateCase {
  name: string;
  input: GateInput;
  expect: { grade: number; action: GateAction };
}

const gateCases = cases as GateCase[];

describe("gate conformance (rules.json)", () => {
  it("ships at least the representative cases", () => {
    expect(gateCases.length).toBeGreaterThanOrEqual(5);
  });

  for (const c of gateCases) {
    it(c.name, () => {
      const verdict = classifyGate(c.input);
      expect(verdict.grade).toBe(c.expect.grade);
      expect(verdict.action).toBe(c.expect.action);
    });
  }
});
