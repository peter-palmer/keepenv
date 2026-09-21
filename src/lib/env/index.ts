/**
 * The environment file model: parsing, editing and serialization.
 *
 * This module is pure. It has no React and no Tauri imports, so it can be
 * tested directly and reasoned about on its own.
 */

export { parse } from "./parse.ts";
export { serialize, renderVariable } from "./serialize.ts";
export {
  addVariable,
  dominantEol,
  removeNode,
  setVariableKey,
  setVariableValue,
} from "./edit.ts";
export { countVariables, listVariables } from "./variables.ts";
export type { VariableEntry } from "./variables.ts";
export {
  compareEnvFileNames,
  rankEnvFileName,
  sortEnvFileNames,
} from "./sort.ts";
export {
  ENV_FILE_NAME_HINT,
  validateEnvFileName,
  validateVariableKey,
} from "./validate.ts";
export {
  decodeQuotedValue,
  encodeValue,
  requiresQuoting,
} from "./quoting.ts";
export { isVariableNode } from "./types.ts";
export type {
  EnvBlankNode,
  EnvCommentNode,
  EnvDocument,
  EnvNode,
  EnvNodeKind,
  EnvUnknownNode,
  EnvVariableNode,
  QuoteStyle,
} from "./types.ts";
