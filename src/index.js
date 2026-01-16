import { DocusaurusPdfExporter } from "./services/Exporter.js";
import { defaultConfig } from "./config/defaults.js";

/**
 * Export Docusaurus documentation to PDF
 * @param {string} url - Base URL of the Docusaurus site
 * @param {string} outputPath - Path where to save the output PDF
 * @param {object} options - Optional configuration to override defaults
 * @returns {Promise<string>} Path to the exported PDF file
 */
export async function exportToPdf(url, outputPath, options = {}) {
  const config = { ...defaultConfig, ...options };
  const exporter = new DocusaurusPdfExporter(config);
  return await exporter.export(url, outputPath);
}

/**
 * Export Docusaurus documentation to PDF (legacy API for backward compatibility)
 * @param {string} url - Base URL of the Docusaurus site
 * @param {string} outputPath - Path where to save the output PDF
 * @param {boolean} needClean - Whether to clean temporary files
 * @returns {Promise<string>} Path to the exported PDF file
 */
export async function run(url, outputPath, needClean = true) {
  return exportToPdf(url, outputPath, { cleanup: { cleanTempFiles: needClean } });
}

// Export default config for advanced usage
export { defaultConfig };
export { DocusaurusPdfExporter };
