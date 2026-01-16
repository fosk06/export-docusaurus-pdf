/**
 * Default configuration for Docusaurus PDF export
 */
export const defaultConfig = {
  timeouts: {
    pageLoad: 10000,
    sidebarExpansion: 3000,
    clickRetry: 2000,
    animation: 800,
    scroll: 2000,
    networkIdle: 5000,
  },
  pdf: {
    width: "800px",
    margins: {
      top: "40px",
      left: "40px",
      right: "40px",
      bottom: "0",
    },
    printBackground: true,
    tagged: true,
    preferCSSPageSize: true,
  },
  viewport: {
    width: 1260, // 720 / 0.75 + 300
    height: 400,
  },
  selectors: {
    sidebar: {
      level1: ".theme-doc-sidebar-item-category-level-1 > .menu__list-item-collapsible",
      collapsible: ".menu__list-item-collapsible",
      active: ".menu__list-item-collapsible--active",
      link: "a.menu__link:not([class*=menuExternalLink])",
      button: "button",
      menuLink: ".menu__link",
    },
    content: {
      skipToContent: "#__docusaurus_skipToContent_fallback",
      docCardListItem: "article > section.row > article[class*=docCardListItem]",
      pageContent: "article > section.row > *",
    },
  },
  retry: {
    maxAttempts: 3,
    strategies: ["click", "forceClick", "javascriptClick"],
  },
  styles: {
    columnFix: `
      .col--6 {
        --ifm-col-width: calc(12 / 12 * 100%);
      }
      code[class*="codeBlockLines_"]{
         white-space: pre-wrap !important;
      }
    `,
  },
  cleanup: {
    cleanTempFiles: true,
  },
};
