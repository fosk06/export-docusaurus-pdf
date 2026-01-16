import { SidebarError } from "../utils/errors.js";
import { warn, debug } from "../utils/logger.js";

/**
 * Service for expanding Docusaurus sidebar menus
 */
export class SidebarExpander {
  constructor(page, config) {
    this.page = page;
    this.config = config;
    this.selectors = config.selectors.sidebar;
    this.timeouts = config.timeouts;
  }

  /**
   * Expand all collapsible sidebar items using JavaScript (fastest method)
   */
  async expandAllWithJavaScript() {
    try {
      await this.page.evaluate((selectors) => {
        const collapsibles = document.querySelectorAll(
          `${selectors.collapsible}:not(.${selectors.active.replace(".", "")})`
        );
        collapsibles.forEach((el) => {
          const button = el.querySelector(selectors.button) || el;
          if (button && typeof button.click === "function") {
            button.click();
          }
        });
      }, this.selectors);
      await this.page.waitForTimeout(this.timeouts.animation * 2);
      debug("Expanded all menus using JavaScript");
      return true;
    } catch (err) {
      warn("Could not expand menus using JavaScript, falling back to manual clicks");
      return false;
    }
  }

  /**
   * Click an element with multiple retry strategies
   * @param {import('playwright').Locator} element - Element to click
   * @param {number} level - Current sidebar level (for logging)
   * @param {number} index - Current item index (for logging)
   */
  async clickWithRetry(element, level = 0, index = 0) {
    const strategies = this.config.retry.strategies;

    for (let i = 0; i < strategies.length; i++) {
      try {
        const strategy = strategies[i];
        switch (strategy) {
          case "click":
            await element.click({
              timeout: this.timeouts.clickRetry,
              force: false,
            });
            return;
          case "forceClick":
            await element.click({
              timeout: this.timeouts.clickRetry,
              force: true,
            });
            return;
          case "javascriptClick":
            await element.evaluate((el) => {
              if (el instanceof HTMLElement) {
                el.click();
              }
            });
            return;
        }
      } catch (err) {
        if (i === strategies.length - 1) {
          warn(
            `All click strategies failed for level ${level + 1}, index ${index}:`,
            err.message
          );
          throw err;
        }
        debug(`Click strategy ${strategies[i]} failed, trying next...`);
      }
    }
  }

  /**
   * Ensure an element is visible, scrolling if necessary
   * @param {import('playwright').Locator} element - Element to make visible
   */
  async ensureVisible(element) {
    const isVisible = await element.isVisible().catch(() => false);
    if (!isVisible) {
      await element.scrollIntoViewIfNeeded({
        timeout: this.timeouts.scroll,
      }).catch(() => {});
      await this.page.waitForTimeout(300);
    }
    return await element.isVisible().catch(() => false);
  }

  /**
   * Expand a single sidebar item and its children recursively
   * @param {import('playwright').Locator} parent - Parent element
   * @param {number} level - Current nesting level
   */
  async expandSubSidebar(parent, level) {
    try {
      const subItem = parent.locator(
        `.theme-doc-sidebar-item-category-level-${level + 1} .menu__list-item-collapsible`
      );
      const subItemCount = await subItem.count();

      if (subItemCount === 0) {
        return; // No sub-items to process
      }

      for (let i = 0; i < subItemCount; i++) {
        try {
          const currentItem = subItem.nth(i);
          const itemClass = await currentItem.getAttribute("class").catch(() => "");

          // Check if item is already active/expanded
          if (itemClass && itemClass.includes("menu__list-item-collapsible--active")) {
            await this.expandSubSidebar(currentItem.locator("xpath=.."), level + 1);
            continue;
          }

          // Find clickable element (button or the item itself)
          const clickableElement = currentItem
            .locator(`${this.selectors.button}, ${this.selectors.menuLink}`)
            .first();
          const hasButton = await clickableElement.count().catch(() => 0);
          const elementToClick = hasButton > 0 ? clickableElement : currentItem;

          // Ensure visibility
          const isVisible = await this.ensureVisible(elementToClick);
          if (!isVisible) {
            warn(`Skipping non-visible item at level ${level + 1}, index ${i}`);
            continue;
          }

          // Click with retry
          await this.clickWithRetry(elementToClick, level, i);

          // Wait for menu to expand/animation to complete
          await this.page.waitForTimeout(this.timeouts.animation);

          // Recursively process sub-items
          await this.expandSubSidebar(currentItem.locator("xpath=.."), level + 1);
        } catch (err) {
          warn(
            `Error processing sidebar item at level ${level + 1}, index ${i}:`,
            err.message
          );
          // Continue with next item instead of failing completely
          continue;
        }
      }
    } catch (err) {
      warn(`Error in expandSubSidebar at level ${level + 1}:`, err.message);
    }
  }

  /**
   * Expand all sidebar menus manually (fallback method)
   */
  async expandAllManually() {
    const ulItem = this.page.locator(this.selectors.level1);
    const ulCount = await ulItem.count();

    debug(`Found ${ulCount} top-level sidebar items`);

    for (let i = 0; i < ulCount; i++) {
      try {
        debug(`Processing top-level sidebar item ${i}`);
        const currentItem = ulItem.nth(i);
        const itemClass = await currentItem.getAttribute("class").catch(() => "");

        if (itemClass && itemClass.includes("menu__list-item-collapsible--active")) {
          await this.expandSubSidebar(currentItem.locator("xpath=.."), 1);
          continue;
        }

        // Find clickable element
        const clickableElement = currentItem.locator(this.selectors.button).first();
        const hasButton = await clickableElement.count().catch(() => 0);
        const elementToClick = hasButton > 0 ? clickableElement : currentItem;

        // Ensure visibility
        await this.ensureVisible(elementToClick);

        // Click with retry
        await this.clickWithRetry(elementToClick, 0, i);

        await this.page.waitForTimeout(this.timeouts.animation);
        await this.expandSubSidebar(currentItem.locator("xpath=.."), 1);
      } catch (err) {
        warn(`Error processing top-level sidebar item ${i}:`, err.message);
        continue;
      }
    }
  }

  /**
   * Expand all sidebar menus using the best available strategy
   */
  async expandAll() {
    // First try JavaScript expansion (fastest)
    const jsSuccess = await this.expandAllWithJavaScript();

    // Then manually expand any remaining collapsed items
    await this.expandAllManually();

    // Final attempt to expand any remaining collapsed items
    await this.expandAllWithJavaScript();
    await this.page.waitForTimeout(this.timeouts.animation);
  }
}
