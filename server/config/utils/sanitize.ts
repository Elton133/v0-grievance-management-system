import DOMPurify from "dompurify"
import { JSDOM } from "jsdom"

// Create a DOMPurify instance for server-side use
const window = new JSDOM("").window
const purify = DOMPurify(window as unknown as Window)

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param dirty - Unsanitized HTML string
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(dirty: string): string {
  return purify.sanitize(dirty, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li"],
    ALLOWED_ATTR: ["href"],
  })
}

/**
 * Sanitize plain text (removes all HTML)
 * @param text - Text that may contain HTML
 * @returns Plain text without HTML
 */
export function sanitizeText(text: string): string {
  return purify.sanitize(text, { ALLOWED_TAGS: [] })
}

/**
 * Sanitize user input (removes HTML and trims)
 * @param input - User input string
 * @returns Sanitized and trimmed string
 */
export function sanitizeInput(input: string): string {
  return sanitizeText(input).trim()
}

