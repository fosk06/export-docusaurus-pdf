import { LinkCollectionError } from "../utils/errors.js";
import { SidebarExpander } from "./SidebarExpander.js";
import { info, warn, debug } from "../utils/logger.js";

/**
 * Service for collecting links from Docusaurus sidebar
 */
export class LinkCollector {
  constructor(page, config) {
    this.page = page;
    this.config = config;
    this.selectors = config.selectors.sidebar;
    this.timeouts = config.timeouts;
  }

  /**
   * Collect all links using alternative method (when sidebar structure is different)
   */
  async collectLinksAlternative() {
    try {
      const allLinks = await this.page.$$eval(this.selectors.link, (as) =>
        as.map((a) => a.href)
      );
      info(`Collected ${allLinks.length} links (alternative method)`);
      return allLinks;
    } catch (err) {
      throw new LinkCollectionError(
        "Failed to collect links using alternative method",
        err
      );
    }
  }

  /**
   * Collect all links from the sidebar
   * @param {string} baseUrl - Base URL of the Docusaurus site
   * @returns {Promise<string[]>} Array of page URLs
   */
  async collectAllLinks(baseUrl) {
    info("Waiting for page to load...");
    await this.page.goto(baseUrl, { waitUntil: "networkidle" });
    await this.page.waitForTimeout(2000);
    debug("Page loaded, starting link collection");

    // Wait for sidebar to be loaded
    try {
      await this.page.waitForSelector(this.selectors.level1, {
        timeout: this.timeouts.pageLoad,
      });
    } catch (err) {
      warn("Sidebar items not found, trying alternative approach");
      return await this.collectLinksAlternative();
    }

    const ulItem = this.page.locator(this.selectors.level1);
    const ulCount = await ulItem.count();
    info(`Found ${ulCount} top-level sidebar sections`);

    // Expand all menus
    const expander = new SidebarExpander(this.page, this.config);
    await expander.expandAll();

    // Wait a bit more for all menus to be fully expanded
    await this.page.waitForTimeout(this.timeouts.animation * 2);

    // Collect all links
    debug("Extracting links from sidebar...");
    const hrefs = await this.page.$$eval(this.selectors.link, (as) =>
      as.map((a) => a.href)
    );

    info(`Collected ${hrefs.length} links from sidebar`);
    return hrefs;
  }
}
