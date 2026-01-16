import { PDFDocument, PDFName, PDFDict, PDFString, PDFArray } from "pdf-lib";
import fs from "fs";
import { PdfMergeError } from "../utils/errors.js";
import { info, debug, warn } from "../utils/logger.js";
import { ensureDirectoryExists } from "../utils/fileSystem.js";
import path from "path";

/**
 * Service for merging multiple PDF files into one
 */
export class PdfMerger {
  constructor(config) {
    this.config = config;
  }

  /**
   * Create a bookmark item in the PDF outline structure
   * @param {PDFDocument} pdfDoc - PDF document
   * @param {PDFPage} page - Target page
   * @param {string} title - Bookmark title
   * @param {PDFDict} parent - Parent bookmark dictionary
   * @param {PDFDict} prev - Previous bookmark dictionary
   * @returns {PDFDict} Created bookmark dictionary
   */
  createBookmarkItem(pdfDoc, page, title, parent = null, prev = null) {
    const pageRef = page.ref;

    // Create destination array: [pageRef, 'XYZ', left, top, zoom]
    const destArray = pdfDoc.context.obj([
      pageRef,
      PDFName.of("XYZ"),
      null, // left (null = use default)
      null, // top (null = use default, which is top of page)
      null, // zoom (null = use default)
    ]);

    const bookmarkDict = pdfDoc.context.obj({
      Title: PDFString.of(title),
      Dest: destArray,
      Parent: parent || null,
      Prev: prev || null,
      Next: null, // Will be set later
      First: null, // For parent bookmarks with children
      Last: null, // For parent bookmarks with children
      Count: 0, // Number of children (negative if closed)
    });

    return bookmarkDict;
  }

  /**
   * Build hierarchical bookmarks from flat heading list
   * Simplified version that creates flat bookmarks first, then adds hierarchy
   * @param {PDFDocument} pdfDoc - PDF document
   * @param {Array} pages - Array of PDF pages
   * @param {Array} metadata - Array of {path, headings, url, pageIndex}
   * @returns {Array<{dict: PDFDict, level: number, parentIndex: number}>} Array of bookmark info
   */
  buildBookmarkHierarchy(pdfDoc, pages, metadata) {
    const bookmarkInfos = [];
    const stack = []; // Stack to track parent bookmark indices at each level

    // First pass: create all bookmarks without linking
    for (const meta of metadata) {
      const pageIndex = meta.pageIndex;
      const headings = meta.headings || [];

      if (pageIndex >= pages.length) {
        warn(`Page index ${pageIndex} out of range, skipping bookmarks`);
        continue;
      }

      const targetPage = pages[pageIndex];

      for (const heading of headings) {
        const { level, text } = heading;

        // Create bookmark dictionary
        const bookmarkDict = PDFDict.withContext(pdfDoc.context);
        bookmarkDict.set(PDFName.of("Title"), PDFString.of(text));

        // Create destination
        const destArray = pdfDoc.context.obj([
          targetPage.ref,
          PDFName.of("Fit"),
        ]);
        bookmarkDict.set(PDFName.of("Dest"), destArray);

        pdfDoc.context.register(bookmarkDict);

        // Determine parent index
        let parentIndex = -1;
        if (level > 1) {
          const parentLevel = level - 2;
          if (parentLevel >= 0 && stack[parentLevel] !== undefined) {
            parentIndex = stack[parentLevel];
          }
        }

        bookmarkInfos.push({
          dict: bookmarkDict,
          level,
          parentIndex,
          index: bookmarkInfos.length,
        });

        // Update stack
        stack[level - 1] = bookmarkInfos.length - 1;
        // Clear deeper levels
        for (let i = level; i < stack.length; i++) {
          stack[i] = undefined;
        }
      }
    }

    // Second pass: link bookmarks together
    for (let i = 0; i < bookmarkInfos.length; i++) {
      const info = bookmarkInfos[i];
      const dict = info.dict;

      // Set parent
      if (info.parentIndex >= 0) {
        const parentInfo = bookmarkInfos[info.parentIndex];
        dict.set(PDFName.of("Parent"), parentInfo.dict.ref);

        // Update parent's First/Last/Count
        if (!parentInfo.dict.get(PDFName.of("First"))) {
          parentInfo.dict.set(PDFName.of("First"), dict.ref);
        }
        parentInfo.dict.set(PDFName.of("Last"), dict.ref);

        const currentCount =
          parentInfo.dict.get(PDFName.of("Count"))?.asNumber() || 0;
        parentInfo.dict.set(
          PDFName.of("Count"),
          pdfDoc.context.obj(currentCount + 1)
        );
      }

      // Link siblings at same level
      if (i > 0) {
        // Find previous bookmark at same level
        for (let j = i - 1; j >= 0; j--) {
          if (
            bookmarkInfos[j].level === info.level &&
            bookmarkInfos[j].parentIndex === info.parentIndex
          ) {
            dict.set(PDFName.of("Prev"), bookmarkInfos[j].dict.ref);
            bookmarkInfos[j].dict.set(PDFName.of("Next"), dict.ref);
            break;
          }
        }
      }
    }

    // Return only root bookmarks (level 1 or no parent)
    return bookmarkInfos
      .filter((info) => info.level === 1 || info.parentIndex === -1)
      .map((info) => info.dict);
  }

  /**
   * Create PDF outlines (bookmarks) structure
   * @param {PDFDocument} pdfDoc - PDF document
   * @param {Array} pages - Array of PDF pages
   * @param {Array} metadata - Array of {path, headings, url, pageIndex}
   */
  createOutlines(pdfDoc, pages, metadata) {
    try {
      const allBookmarks = this.buildBookmarkHierarchy(pdfDoc, pages, metadata);

      if (allBookmarks.length === 0) {
        debug("No bookmarks to create");
        return;
      }

      // Filter root bookmarks (those without a parent or with null parent)
      const rootBookmarks = allBookmarks.filter((bm) => {
        const parent = bm.get(PDFName.of("Parent"));
        return !parent || parent === null;
      });

      if (rootBookmarks.length === 0) {
        debug("No root bookmarks found");
        return;
      }

      // Create outlines root dictionary
      const outlinesDict = PDFDict.withContext(pdfDoc.context);
      outlinesDict.set(PDFName.of("Type"), PDFName.of("Outlines"));
      outlinesDict.set(
        PDFName.of("Count"),
        pdfDoc.context.obj(rootBookmarks.length)
      );
      outlinesDict.set(PDFName.of("First"), rootBookmarks[0].ref);
      outlinesDict.set(
        PDFName.of("Last"),
        rootBookmarks[rootBookmarks.length - 1].ref
      );

      const outlinesRef = pdfDoc.context.register(outlinesDict);

      // Update root bookmarks to point to outlines as parent
      for (const bookmark of rootBookmarks) {
        bookmark.set(PDFName.of("Parent"), outlinesRef);
      }

      // Set outlines in catalog
      pdfDoc.catalog.set(PDFName.of("Outlines"), outlinesRef);
      info(`Created ${rootBookmarks.length} root bookmarks with hierarchy`);
    } catch (err) {
      warn("Failed to create bookmarks:", err.message);
      debug(err.stack);
      // Don't throw - bookmarks are optional
    }
  }

  /**
   * Merge multiple PDF files into a single PDF with bookmarks
   * @param {Array<{path: string, headings: Array, url: string, pageIndex: number}>} metadata - Array of export metadata
   * @param {string} outputPath - Path where to save the merged PDF
   * @returns {Promise<string>} Path to the merged PDF file
   */
  async merge(metadata, outputPath) {
    if (!metadata || metadata.length === 0) {
      throw new PdfMergeError("No source files provided for merging");
    }

    info(`Starting PDF merge of ${metadata.length} files`);

    try {
      const pdfDoc = await PDFDocument.create();
      const pages = [];

      // Track page offset for bookmarks
      let pageOffset = 0;

      for (let i = 0; i < metadata.length; i++) {
        const meta = metadata[i];
        const localPath = meta.path;
        debug(`Merging file ${i + 1}/${metadata.length}: ${localPath}`);

        try {
          const PDFItem = await PDFDocument.load(fs.readFileSync(localPath));
          const copiedPages = await pdfDoc.copyPages(
            PDFItem,
            PDFItem.getPageIndices()
          );

          // Update page index in metadata to account for already merged pages
          meta.pageIndex = pageOffset;
          pageOffset += copiedPages.length;

          copiedPages.forEach((page) => {
            pdfDoc.addPage(page);
            pages.push(page);
          });
        } catch (err) {
          warn(`Failed to merge file ${localPath}:`, err.message);
          // Continue with next file
          continue;
        }
      }

      // Create bookmarks if we have headings
      // NOTE: Bookmark creation is currently disabled due to pdf-lib API limitations
      // The low-level PDF outline API in pdf-lib is fragile and causes PDF corruption
      // This feature will be re-enabled once we find a more stable approach
      // (possibly using a different library or waiting for better pdf-lib support)
      // const hasHeadings = metadata.some(
      //   (meta) => meta.headings && meta.headings.length > 0
      // );
      // if (hasHeadings) {
      //   try {
      //     info("Creating PDF bookmarks from headings...");
      //     this.createOutlines(pdfDoc, pages, metadata);
      //   } catch (bookmarkError) {
      //     warn(
      //       "Failed to create bookmarks, continuing without them:",
      //       bookmarkError.message
      //     );
      //     debug(bookmarkError.stack);
      //   }
      // }

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      ensureDirectoryExists(outputDir, true);

      // Save merged PDF
      const pdfBytes = await pdfDoc.save();
      fs.writeFileSync(outputPath, pdfBytes);

      info(`PDF merge successful. Output file: ${outputPath}`);
      return outputPath;
    } catch (err) {
      throw new PdfMergeError("Failed to merge PDF files", err);
    }
  }
}
