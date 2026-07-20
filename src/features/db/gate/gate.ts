// Language-neutral gate evaluator. Interprets rules.json only — no hardcoded
// grades or actions. The same rules.json is the single source that the Rust
// sidecar consumes for conformance (plan §5, 선행정리-3).
import rulesTable from "./rules.json";

export type OpClass = "read" | "write" | "ddl" | "profileMutation";
export type GateAction = "allow" | "confirm" | "deny";
export type Environment = "dev" | "staging" | "prod";

export interface GateProfile {
  environment?: Environment;
  readOnly?: boolean;
}

export interface GateInput {
  commandId?: string;
  opClass: OpClass;
  profile: GateProfile;
}

export interface GateVerdict {
  grade: number;
  action: GateAction;
  rule: string;
}

interface RuleMatch {
  opClass?: OpClass;
  commandId?: string;
  profile?: { environment?: Environment; readOnly?: boolean };
}

interface Rule {
  id: string;
  match: RuleMatch;
  grade: number;
  action: GateAction;
}

interface RulesTable {
  version: number;
  rules: Rule[];
}

const table = rulesTable as RulesTable;

function matches(rule: Rule, input: GateInput): boolean {
  const m = rule.match;
  if (m.opClass !== undefined && m.opClass !== input.opClass) return false;
  if (m.commandId !== undefined && m.commandId !== input.commandId) return false;
  if (m.profile !== undefined) {
    if (
      m.profile.environment !== undefined &&
      m.profile.environment !== input.profile.environment
    )
      return false;
    if (
      m.profile.readOnly !== undefined &&
      m.profile.readOnly !== input.profile.readOnly
    )
      return false;
  }
  return true;
}

// First matching rule wins. rules.json ends with a catch-all `default-deny`
// so a verdict is always produced (fail-closed).
export function classifyGate(input: GateInput): GateVerdict {
  for (const rule of table.rules) {
    if (matches(rule, input)) {
      return { grade: rule.grade, action: rule.action, rule: rule.id };
    }
  }
  return { grade: 3, action: "deny", rule: "no-match" };
}
