import fs from "fs";
import path from "path";

/**
 * Ensure a directory exists, create it if it doesn't
 * @param {string} dirPath - Path to the directory
 * @param {boolean} recursive - Whether to create parent directories
 */
export function ensureDirectoryExists(dirPath, recursive = true) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive });
  }
}

/**
 * Create a temporary directory with a random suffix
 * @param {string} basePath - Base path for the temp directory
 * @param {string} prefix - Prefix for the temp directory name
 * @returns {string} Path to the created temporary directory
 */
export function createTempDirectory(basePath, prefix = "pdfsTemp") {
  const randomString = Math.random().toString(36).substring(2, 8);
  const tempDir = path.resolve(basePath, `${prefix}${randomString}`);
  ensureDirectoryExists(tempDir, false);
  return tempDir;
}

/**
 * Remove a directory and all its contents
 * @param {string} dirPath - Path to the directory to remove
 * @param {boolean} force - Whether to force removal even if read-only
 */
export function removeDirectory(dirPath, force = true) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force });
  }
}

/**
 * Resolve output directory and filename from a path
 * @param {string} outputPath - Full path to output file
 * @returns {{dir: string, filename: string}} Object with directory and filename
 */
export function resolveOutputPath(outputPath) {
  const resolvedPath = path.resolve(process.cwd(), outputPath);
  return {
    dir: path.dirname(resolvedPath),
    filename: path.basename(resolvedPath),
    fullPath: resolvedPath,
  };
}
