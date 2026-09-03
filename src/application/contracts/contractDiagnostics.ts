import { z } from "zod";

export interface SerializedContractDiagnostic {
  name: string;
  message: string;
}

const MAX_DIAGNOSTIC_TEXT_LENGTH = 500;
const MAX_ZOD_ISSUES = 4;
const STRUCTURED_DIAGNOSTIC_MESSAGE = "Structured or oversized provider error redacted";

export function summarizeZodError(error: z.ZodError): string {
  const issues = error.issues.slice(0, MAX_ZOD_ISSUES).map((issue) => {
    const path = issue.path.length > 0 ? issue.path.map(String).join(".") : "$";
    const details = [`code=${issue.code}`];
    if ("expected" in issue && typeof issue.expected === "string") {
      details.push(`expected=${issue.expected}`);
    }
    if ("received" in issue && typeof issue.received === "string") {
      details.push(`received=${issue.received}`);
    }
    return `path=${path} ${details.join(" ")}`;
  });
  const remainder = error.issues.length > MAX_ZOD_ISSUES ? "; additional issues redacted" : "";
  return truncateDiagnosticText(
    `Validation failed: ${issues.join("; ") || "no issue details"}${remainder}`,
    "Validation failed"
  );
}

export function serializeContractError(error: unknown): SerializedContractDiagnostic {
  if (error instanceof z.ZodError) {
    return { name: error.name, message: summarizeZodError(error) };
  }
  if (error instanceof Error) return { name: error.name, message: error.message };
  return { name: "Error", message: String(error) };
}

export function sanitizeSerializedContractError(
  error: SerializedContractDiagnostic
): SerializedContractDiagnostic {
  return {
    name: sanitizeContractDiagnosticValue(error.name, "Error"),
    message: sanitizeContractDiagnosticValue(error.message, "Unknown error"),
  };
}

export function sanitizeContractDiagnosticValue(
  value: string,
  fallback: string,
  maxLength = MAX_DIAGNOSTIC_TEXT_LENGTH
): string {
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (normalized.length === 0) return fallback;
  if (
    normalized.length > MAX_DIAGNOSTIC_TEXT_LENGTH ||
    /<\/?[a-z][\s\S]*>/iu.test(normalized) ||
    /[{[][^}\]]*[}\]]/u.test(normalized) ||
    /\b(?:raw\s+|response\s+|provider\s+)?body\s*[:=]/iu.test(normalized)
  ) {
    return STRUCTURED_DIAGNOSTIC_MESSAGE;
  }
  const redacted = normalized.replace(
    /((?:authorization|cookie|set-cookie|api[_-]?key|token|secret|password)\s*[:=]\s*)(?:bearer\s+)?[^,;\s]+/giu,
    "$1[REDACTED]"
  );
  return truncateDiagnosticText(redacted, fallback, maxLength);
}

function truncateDiagnosticText(
  value: string,
  fallback: string,
  maxLength = MAX_DIAGNOSTIC_TEXT_LENGTH
): string {
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (normalized.length === 0) return fallback;
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 3)}...`;
}
