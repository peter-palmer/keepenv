/**
 * Ordering of environment file tabs.
 *
 * `.env` first, then `.env.local`, then development, staging, production and
 * test variants, then examples and templates, then anything else. Files within
 * a group are ordered alphabetically.
 */

const Rank = {
  Base: 0,
  Local: 1,
  Development: 2,
  Staging: 3,
  Production: 4,
  Test: 5,
  Example: 6,
  Other: 7,
} as const;

const EXAMPLE_PATTERN = /(example|sample|template|defaults?|dist)/i;
const DEVELOPMENT_PATTERN = /(development|dev)/i;
const STAGING_PATTERN = /(staging|stage|preview)/i;
const PRODUCTION_PATTERN = /(production|prod|live)/i;
const TEST_PATTERN = /(testing|test|ci|e2e)/i;

export function rankEnvFileName(name: string): number {
  if (name === ".env") {
    return Rank.Base;
  }
  if (name === ".env.local") {
    return Rank.Local;
  }
  // Checked first so `.env.production.example` is grouped with the templates.
  if (EXAMPLE_PATTERN.test(name)) {
    return Rank.Example;
  }
  if (DEVELOPMENT_PATTERN.test(name)) {
    return Rank.Development;
  }
  if (STAGING_PATTERN.test(name)) {
    return Rank.Staging;
  }
  if (PRODUCTION_PATTERN.test(name)) {
    return Rank.Production;
  }
  if (TEST_PATTERN.test(name)) {
    return Rank.Test;
  }
  return Rank.Other;
}

export function compareEnvFileNames(a: string, b: string): number {
  const difference = rankEnvFileName(a) - rankEnvFileName(b);
  return difference !== 0 ? difference : a.localeCompare(b);
}

export function sortEnvFileNames<T extends { readonly name: string }>(
  files: readonly T[],
): T[] {
  return [...files].sort((a, b) => compareEnvFileNames(a.name, b.name));
}
