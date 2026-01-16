import { PdfExportError } from "../utils/errors.js";
import { info, warn, debug } from "../utils/logger.js";
import path from "path";

/**
 * Service for exporting individual pages to PDF
 */
export class PdfExporter {
  constructor(page, config) {
    this.page = page;
    this.config = config;
    this.selectors = config.selectors.content;
    this.pdfConfig = config.pdf;
    this.timeouts = config.timeouts;
  }

  /**
   * Check if a page is a documentation list page (should be skipped)
   * @returns {Promise<boolean>} True if the page should be skipped
   */
  async isDocListPage() {
    try {
      const docCardListItem = this.page.locator(this.selectors.docCardListItem);
      const docCardListItemCount = await docCardListItem.count();

      const pageContent = this.page.locator(this.selectors.pageContent);
      const pageContentCount = await pageContent.count();

      return (
        docCardListItemCount > 0 && docCardListItemCount === pageContentCount
      );
    } catch (err) {
      debug("Error checking if page is doc list:", err.message);
      return false;
    }
  }

  /**
   * Calculate the page height for PDF export
   * @returns {Promise<number>} Page height in pixels
   */
  async calculatePageHeight() {
    try {
      const height = await this.page.evaluate((selector) => {
        const element = document.querySelector(selector);
        return element ? element.offsetHeight + 60 : 0;
      }, this.selectors.skipToContent);
      return height;
    } catch (err) {
      warn("Failed to calculate page height, using default");
      return 1000; // Default height
    }
  }

  /**
   * Apply custom styles to the page before export
   */
  async applyCustomStyles() {
    try {
      await this.page.addStyleTag({
        content: this.config.styles.columnFix,
      });
      await this.page.waitForTimeout(200);
    } catch (err) {
      warn("Failed to apply custom styles:", err.message);
    }
  }

  /**
   * Replace internal links (localhost) - remove href to prevent broken links in PDF
   * @param {string} baseUrl - Base URL to identify internal links
   */
  async replaceInternalLinks(baseUrl) {
    try {
      await this.page.evaluate((baseUrl) => {
        // Select all links in the document (not just in article, to catch "edit this page" buttons)
        const links = document.querySelectorAll("a[href]");
        links.forEach((link) => {
          const href = link.getAttribute("href");
          if (!href) return;

          try {
            // Check if it's a localhost link (any localhost variant)
            const isLocalhost =
              href.includes("localhost") ||
              href.includes("127.0.0.1") ||
              href.includes("git.localhost") ||
              href.startsWith(baseUrl) ||
              href.startsWith("/") ||
              (!href.startsWith("http") &&
                !href.startsWith("mailto:") &&
                !href.startsWith("#") &&
                !href.startsWith("javascript:"));

            if (isLocalhost) {
              // Remove localhost/internal links - they won't work in PDF anyway
              // Keep the text but remove the link functionality
              link.removeAttribute("href");
              link.style.cursor = "default";
              link.style.textDecoration = "none";
              link.style.color = "inherit";
            }
          } catch (err) {
            // If URL parsing fails, just remove the href
            link.removeAttribute("href");
          }
        });
      }, baseUrl);
    } catch (err) {
      warn("Failed to replace internal links:", err.message);
    }
  }

  /**
   * Extract headings (h1-h6) from the current page
   * @returns {Promise<Array<{level: number, text: string, id: string}>>} Array of headings with their level and text
   */
  async extractHeadings() {
    try {
      const headings = await this.page.evaluate(() => {
        const headingElements = document.querySelectorAll(
          "article h1, article h2, article h3, article h4, article h5, article h6"
        );
        const result = [];

        headingElements.forEach((heading) => {
          const tagName = heading.tagName.toLowerCase();
          const level = parseInt(tagName.charAt(1)); // Extract number from h1, h2, etc.
          const text = heading.textContent.trim();
          const id = heading.id || heading.getAttribute("name") || "";

          if (text) {
            result.push({ level, text, id });
          }
        });

        return result;
      });

      return headings;
    } catch (err) {
      warn("Failed to extract headings:", err.message);
      return [];
    }
  }

  /**
   * Export a single page to PDF
   * @param {string} url - URL of the page to export
   * @param {string} outputPath - Path where to save the PDF
   * @param {string} baseUrl - Base URL for link replacement
   * @returns {Promise<{path: string, headings: Array}>} Object with path and extracted headings
   */
  async exportPage(url, outputPath, baseUrl) {
    try {
      info(`Exporting page: ${url}`);
      await this.page.goto(url, { waitUntil: "networkidle" });
      debug(`Page loaded: ${url}`);

      // Apply custom styles
      await this.applyCustomStyles();

      // Replace internal links before export
      if (baseUrl) {
        await this.replaceInternalLinks(baseUrl);
      }

      // Check if this is a doc list page (skip it)
      const shouldSkip = await this.isDocListPage();
      if (shouldSkip) {
        warn(`Skipping export for ${url} (documentation list page)`);
        return null;
      }

      // Extract headings before export
      const headings = await this.extractHeadings();

      // Calculate page height
      const height = await this.calculatePageHeight();

      // Export to PDF
      await this.page.pdf({
        path: outputPath,
        width: this.pdfConfig.width,
        height: `${height}px`,
        margin: this.pdfConfig.margins,
        preferCSSPageSize: this.pdfConfig.preferCSSPageSize,
        printBackground: this.pdfConfig.printBackground,
        tagged: this.pdfConfig.tagged,
      });

      info(`Successfully exported: ${url}`);
      return { path: outputPath, headings, url };
    } catch (err) {
      throw new PdfExportError(`Failed to export page ${url}`, err);
    }
  }

  /**
   * Export multiple pages to PDF files
   * @param {string[]} urls - Array of URLs to export
   * @param {string} outputDir - Directory where to save the PDF files
   * @param {string} baseUrl - Base URL for link replacement
   * @returns {Promise<Array<{path: string, headings: Array, url: string, pageIndex: number}>>} Array of export metadata
   */
  async exportPages(urls, outputDir, baseUrl) {
    const exportedFiles = [];
    let currentPageIndex = 0;

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const fileName = `${i}.pdf`;
      const outputPath = path.join(outputDir, fileName);

      try {
        const result = await this.exportPage(url, outputPath, baseUrl);
        if (result) {
          exportedFiles.push({
            path: result.path,
            headings: result.headings,
            url: result.url,
            pageIndex: currentPageIndex,
          });
          currentPageIndex++;
        }
      } catch (err) {
        warn(`Failed to export page ${i} (${url}):`, err.message);
        // Continue with next page instead of failing completely
        continue;
      }
    }

    return exportedFiles;
  }
}
