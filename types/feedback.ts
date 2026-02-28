/**
 * Feedback system types for CogniaLauncher
 */

export type FeedbackCategory = 'bug' | 'feature' | 'performance' | 'crash' | 'question' | 'other';

export type FeedbackSeverity = 'critical' | 'high' | 'medium' | 'low';

export type FeedbackStatus = 'draft' | 'saved' | 'submitted' | 'exported';

export interface FeedbackItem {
  id: string;
  category: FeedbackCategory;
  severity?: FeedbackSeverity;
  title: string;
  description: string;
  contactEmail?: string;
  screenshot?: string;
  includeDiagnostics: boolean;
  diagnosticPath?: string;
  appVersion: string;
  os: string;
  arch: string;
  currentPage: string;
  status: FeedbackStatus;
  createdAt: string;
  updatedAt: string;
  errorContext?: FeedbackErrorContext;
}

export interface FeedbackErrorContext {
  message?: string;
  stack?: string;
  component?: string;
  digest?: string;
}

export interface FeedbackFormData {
  category: FeedbackCategory;
  severity?: FeedbackSeverity;
  title: string;
  description: string;
  contactEmail?: string;
  screenshot?: string;
  includeDiagnostics: boolean;
  errorContext?: FeedbackErrorContext;
}

export interface FeedbackSaveResult {
  id: string;
  path: string;
  diagnosticPath?: string;
}

export interface FeedbackListResult {
  items: FeedbackItem[];
  total: number;
}

export const FEEDBACK_CATEGORIES: FeedbackCategory[] = [
  'bug',
  'feature',
  'performance',
  'crash',
  'question',
  'other',
];

export const FEEDBACK_SEVERITIES: FeedbackSeverity[] = [
  'critical',
  'high',
  'medium',
  'low',
];

export const SEVERITY_CATEGORIES: FeedbackCategory[] = ['bug', 'crash', 'performance'];
