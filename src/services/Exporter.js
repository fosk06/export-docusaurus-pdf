import { chromium } from "playwright";
import { ExportError } from "../utils/errors.js";
import { LinkCollector } from "./LinkCollector.js";
import { PdfExporter } from "./PdfExporter.js";
import { PdfMerger } from "./PdfMerger.js";
import { createTempDirectory, removeDirectory, resolveOutputPath } from "../utils/fileSystem.js";
import { info, error } from "../utils/logger.js";

/**
 * Main service that orchestrates the PDF export process
 */
export class DocusaurusPdfExporter {
  constructor(config) {
    this.config = config;
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  /**
   * Initialize browser and page
   */
  async initialize() {
    this.browser = await chromium.launch({ headless: false });
    this.context = await this.browser.newContext({
      viewport: this.config.viewport,
    });
    this.page = await this.context.newPage();
  }

  /**
   * Verify that Docusaurus is running at the given URL
   * @param {string} url - URL to check
   */
  async verifyDocusaurusRunning(url) {
    try {
      info(`Checking if Docusaurus is running: ${url}`);
      await this.page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: this.config.timeouts.pageLoad,
      });
      info("Docusaurus is running");
    } catch (err) {
      throw new ExportError(
        `Failed to connect to Docusaurus at ${url}. Make sure the server is running.`,
        err
      );
    }
  }

  /**
   * Export Docusaurus documentation to PDF
   * @param {string} url - Base URL of the Docusaurus site
   * @param {string} outputPath - Path where to save the output PDF
   * @returns {Promise<string>} Path to the exported PDF file
   */
  async export(url, outputPath) {
    let tempDir = null;

    try {
      // Initialize browser
      await this.initialize();

      // Verify Docusaurus is running
      await this.verifyDocusaurusRunning(url);

      // Resolve output path
      const { fullPath } = resolveOutputPath(outputPath);

      // Create temporary directory
      tempDir = createTempDirectory(process.cwd());

      // Step 1: Collect all links from sidebar
      info("---------------------");
      const linkCollector = new LinkCollector(this.page, this.config);
      const links = await linkCollector.collectAllLinks(url);

      // Step 2: Export each page to PDF
      const pdfExporter = new PdfExporter(this.page, this.config);
      const exportedFiles = await pdfExporter.exportPages(links, tempDir);

      if (exportedFiles.length === 0) {
        throw new ExportError("No pages were successfully exported");
      }

      // Step 3: Merge all PDFs into one
      const pdfMerger = new PdfMerger(this.config);
      await pdfMerger.merge(exportedFiles, fullPath);

      // Step 4: Cleanup temporary files if requested
      if (this.config.cleanup.cleanTempFiles) {
        removeDirectory(tempDir);
      }

      return fullPath;
    } catch (err) {
      error("Export failed:", err);
      throw err;
    } finally {
      // Always close browser
      if (this.browser) {
        info("Closing browser...");
        await this.browser.close();
      }
    }
  }
}
