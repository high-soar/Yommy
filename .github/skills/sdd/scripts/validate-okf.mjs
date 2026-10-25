#!/usr/bin/env node
/**
 * OKF (Open Knowledge Format) Bundle & Markdown Link Validator for Yommy
 *
 * Usage:
 *   node .github/skills/sdd/scripts/validate-okf.mjs
 *
 * Checks:
 * 1. docs/index.md exists and legacy docs/README.md does not exist.
 * 2. Every concept Markdown file under docs/ (excluding index.md / log.md) has valid YAML frontmatter.
 * 3. Required OKF + workflow fields (type, title, description, status, updated, tags, related_specs, related_tests) exist.
 * 4. `type` matches the canonical 10-type taxonomy and directory placement rules.
 * 5. `spec-delta` lifecycle rules (active in changes/ vs Completed (Archived) in changes/archive/).
 * 6. All file paths in `related_specs` and relative Markdown links (outside code fences) resolve to existing files.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const DOCS_DIR = path.join(ROOT_DIR, "docs");

const ALLOWED_TYPES = new Set([
  "guideline",
  "spec-requirements",
  "spec-architecture",
  "spec-db-schema",
  "spec-screen-transition",
  "spec-feature",
  "spec-parser",
  "spec-delta",
  "quality-log",
  "quality-report",
]);

const VALID_STATUS_PATTERNS = [
  /^Draft$/,
  /^Approved$/,
  /^Approved \(Phase \d+\)$/,
  /^Review \(#\d+\)$/,
  /^Approved \(#\d+\)$/,
  /^Completed \(Archived\)$/,
];

/** @type {string[]} */
const errors = [];

function reportError(file, message) {
  const rel = path.relative(ROOT_DIR, file);
  errors.push(`[OKF-ERROR] ${rel}: ${message}`);
}

function walkMarkdownFiles(dir) {
  /** @type {string[]} */
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(fullPath);
    }
  }
  return results.sort();
}

/**
 * Minimal YAML frontmatter parser for flat scalars and string arrays.
 * @param {string} yamlText
 */
function parseFrontmatter(yamlText) {
  /** @type {Record<string, string | string[]>} */
  const data = {};
  const lines = yamlText.split(/\r?\n/);
  let currentListKey = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, "").trimEnd();
    if (!line.trim()) continue;

    const listMatch = line.match(/^\s*-\s+(.+)$/);
    if (listMatch && currentListKey) {
      const val = listMatch[1].trim().replace(/^["']|["']$/g, "");
      if (Array.isArray(data[currentListKey])) {
        data[currentListKey].push(val);
      }
      continue;
    }

    const kvMatch = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1];
      const rawVal = kvMatch[2].trim();
      currentListKey = null;

      if (rawVal === "") {
        data[key] = [];
        currentListKey = key;
      } else if (rawVal.startsWith("[") && rawVal.endsWith("]")) {
        const inner = rawVal.slice(1, -1).trim();
        data[key] = inner
          ? inner.split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""))
          : [];
      } else {
        data[key] = rawVal.replace(/^["']|["']$/g, "");
      }
    }
  }
  return data;
}

function stripFencedCodeBlocks(markdown) {
  return markdown.replace(/^(`{3,}|~{3,})[\s\S]*?^\1/gm, "");
}

function validateMarkdownLinks(filePath, content) {
  const withoutCode = stripFencedCodeBlocks(content);
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  while ((match = linkRegex.exec(withoutCode)) !== null) {
    const rawTarget = match[2].trim();
    if (
      rawTarget.startsWith("http://") ||
      rawTarget.startsWith("https://") ||
      rawTarget.startsWith("mailto:") ||
      rawTarget.startsWith("#")
    ) {
      continue;
    }
    const targetFilePart = rawTarget.split("#")[0];
    if (!targetFilePart) continue;
    const resolved = path.resolve(path.dirname(filePath), targetFilePart);
    if (!fs.existsSync(resolved)) {
      reportError(
        filePath,
        `Broken relative link '${rawTarget}' (resolved to ${path.relative(ROOT_DIR, resolved)})`,
      );
    }
  }
}

// 1. Check bundle root index.md & legacy README.md
const indexMdPath = path.join(DOCS_DIR, "index.md");
const legacyReadmePath = path.join(DOCS_DIR, "README.md");
if (!fs.existsSync(indexMdPath)) {
  reportError(
    indexMdPath,
    "Missing OKF bundle root index file 'docs/index.md'",
  );
}
if (fs.existsSync(legacyReadmePath)) {
  reportError(
    legacyReadmePath,
    "Legacy 'docs/README.md' found; use OKF reserved 'docs/index.md' instead",
  );
}

// 2. Validate all docs/**/*.md files
const docsFiles = walkMarkdownFiles(DOCS_DIR);
for (const filePath of docsFiles) {
  const relPath = path.relative(ROOT_DIR, filePath).replace(/\\/g, "/");
  const baseName = path.basename(filePath);
  const content = fs.readFileSync(filePath, "utf8");

  validateMarkdownLinks(filePath, content);

  // Reserved OKF navigation/history files do not require concept frontmatter
  if (baseName === "index.md" || baseName === "log.md") {
    continue;
  }

  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!fmMatch) {
    reportError(filePath, "Missing YAML frontmatter block at start of file");
    continue;
  }

  const fm = parseFrontmatter(fmMatch[1]);
  const body = content.slice(fmMatch[0].length);

  // Check for legacy markdown metadata table
  if (/^\|\s*\*\*状態\*\*\s*\|/m.test(body)) {
    reportError(
      filePath,
      "Legacy Markdown metadata table found in body; use YAML frontmatter only",
    );
  }

  // Required fields
  const requiredFields = [
    "type",
    "title",
    "description",
    "status",
    "updated",
    "tags",
    "related_specs",
    "related_tests",
  ];
  for (const field of requiredFields) {
    if (fm[field] === undefined || fm[field] === "") {
      reportError(filePath, `Missing required frontmatter field '${field}'`);
    }
  }

  // Validate `type`
  const typeVal = typeof fm.type === "string" ? fm.type : "";
  if (typeVal && !ALLOWED_TYPES.has(typeVal)) {
    reportError(
      filePath,
      `Invalid type '${typeVal}'. Must be one of: ${Array.from(ALLOWED_TYPES).join(", ")}`,
    );
  }

  // Directory-specific `type` check
  if (relPath.startsWith("docs/guidelines/") && typeVal !== "guideline") {
    reportError(
      filePath,
      `Files in docs/guidelines/ must have type 'guideline' (got '${typeVal}')`,
    );
  }
  if (
    relPath.startsWith("docs/specs/features/") &&
    typeVal !== "spec-feature"
  ) {
    reportError(
      filePath,
      `Files in docs/specs/features/ must have type 'spec-feature' (got '${typeVal}')`,
    );
  }
  if (relPath.startsWith("docs/specs/parsers/") && typeVal !== "spec-parser") {
    reportError(
      filePath,
      `Files in docs/specs/parsers/ must have type 'spec-parser' (got '${typeVal}')`,
    );
  }
  if (relPath.startsWith("docs/specs/changes/") && typeVal !== "spec-delta") {
    reportError(
      filePath,
      `Files in docs/specs/changes/ must have type 'spec-delta' (got '${typeVal}')`,
    );
  }
  if (
    relPath.startsWith("docs/quality/reports/") &&
    typeVal !== "quality-report"
  ) {
    reportError(
      filePath,
      `Files in docs/quality/reports/ must have type 'quality-report' (got '${typeVal}')`,
    );
  }

  // Validate `status`
  const statusVal = typeof fm.status === "string" ? fm.status : "";
  if (statusVal && !VALID_STATUS_PATTERNS.some((re) => re.test(statusVal))) {
    reportError(
      filePath,
      `Invalid status '${statusVal}'. Expected Draft, Approved, Approved (Phase N), Review (#N), Approved (#N), or Completed (Archived)`,
    );
  }

  // Validate `spec-delta` lifecycle
  if (typeVal === "spec-delta") {
    if (!fm.issue || typeof fm.issue !== "string" || !/^#\d+$/.test(fm.issue)) {
      reportError(
        filePath,
        "spec-delta files must include 'issue: \"#N\"' in frontmatter",
      );
    }
    const isArchived = relPath.startsWith("docs/specs/changes/archive/");
    if (!isArchived && statusVal === "Completed (Archived)") {
      reportError(
        filePath,
        "Delta spec has status 'Completed (Archived)' but is still in 'docs/specs/changes/'. Move it to 'docs/specs/changes/archive/'",
      );
    }
    if (isArchived && statusVal !== "Completed (Archived)") {
      reportError(
        filePath,
        `Archived delta spec in 'docs/specs/changes/archive/' must have status 'Completed (Archived)' (got '${statusVal}')`,
      );
    }
  }

  // Validate `updated` date format
  const updatedVal = typeof fm.updated === "string" ? fm.updated : "";
  if (updatedVal && !/^\d{4}-\d{2}-\d{2}$/.test(updatedVal)) {
    reportError(
      filePath,
      `Invalid 'updated' date '${updatedVal}'. Expected YYYY-MM-DD`,
    );
  }

  // Validate `tags` is non-empty array
  if (!Array.isArray(fm.tags) || fm.tags.length === 0) {
    reportError(filePath, "Frontmatter 'tags' must be a non-empty list");
  }

  // Validate `related_specs` paths exist
  if (Array.isArray(fm.related_specs)) {
    for (const specPath of fm.related_specs) {
      const target = specPath.split("#")[0];
      const resolved = path.resolve(ROOT_DIR, target);
      if (!fs.existsSync(resolved)) {
        reportError(
          filePath,
          `related_specs path '${specPath}' does not exist`,
        );
      }
    }
  } else {
    reportError(filePath, "Frontmatter 'related_specs' must be a list");
  }

  if (!Array.isArray(fm.related_tests)) {
    reportError(filePath, "Frontmatter 'related_tests' must be a list");
  }
}

// 3. Also validate links in AGENTS.md and .github/**/*.md (excluding templates with placeholders)
const extraMdFiles = [
  path.join(ROOT_DIR, "AGENTS.md"),
  path.join(ROOT_DIR, ".github/copilot-instructions.md"),
  ...walkMarkdownFiles(path.join(ROOT_DIR, ".github/agents")),
  ...walkMarkdownFiles(path.join(ROOT_DIR, ".github/skills")),
];
for (const filePath of extraMdFiles) {
  if (fs.existsSync(filePath)) {
    validateMarkdownLinks(filePath, fs.readFileSync(filePath, "utf8"));
  }
}

if (errors.length > 0) {
  console.error(`\n❌ OKF Validation failed with ${errors.length} error(s):\n`);
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
} else {
  console.log(
    `✅ OKF Validation passed! (${docsFiles.length} docs files and ${extraMdFiles.length} agent/skill files verified)`,
  );
}
