import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 


export const isIframe = window.self !== window.top;

/**
 * Unified admin check — single source of truth.
 * A user is an admin if their role OR access_level is "admin".
 */
export function isAdmin(user) {
  if (!user) return false;
  return user.role === "admin" || user.access_level === "admin";
}