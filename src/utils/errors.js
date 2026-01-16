/**
 * Custom error classes for PDF export operations
 */

export class ExportError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "ExportError";
    this.cause = cause;
  }
}

export class SidebarError extends ExportError {
  constructor(message, cause) {
    super(message, cause);
    this.name = "SidebarError";
  }
}

export class LinkCollectionError extends ExportError {
  constructor(message, cause) {
    super(message, cause);
    this.name = "LinkCollectionError";
  }
}

export class PdfExportError extends ExportError {
  constructor(message, cause) {
    super(message, cause);
    this.name = "PdfExportError";
  }
}

export class PdfMergeError extends ExportError {
  constructor(message, cause) {
    super(message, cause);
    this.name = "PdfMergeError";
  }
}
