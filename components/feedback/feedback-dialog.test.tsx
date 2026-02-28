import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeedbackDialog } from "./feedback-dialog";

const mockSubmitFeedback = jest.fn();
const mockOpenDialog = jest.fn();
const mockCloseDialog = jest.fn();
const mockSaveDraft = jest.fn();
const mockClearDraft = jest.fn();

let mockDialogOpen = false;
let mockPreSelectedCategory: string | null = null;
let mockPreFilledErrorContext: Record<string, unknown> | null = null;
let mockDraft: Record<string, unknown> | null = null;

jest.mock("@/lib/stores/feedback", () => ({
  useFeedbackStore: () => ({
    dialogOpen: mockDialogOpen,
    preSelectedCategory: mockPreSelectedCategory,
    preFilledErrorContext: mockPreFilledErrorContext,
    draft: mockDraft,
    openDialog: mockOpenDialog,
    closeDialog: mockCloseDialog,
    saveDraft: mockSaveDraft,
    clearDraft: mockClearDraft,
  }),
}));

jest.mock("@/hooks/use-feedback", () => ({
  useFeedback: () => ({
    submitFeedback: mockSubmitFeedback,
    submitting: false,
  }),
}));

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "feedback.title": "Send Feedback",
        "feedback.description": "Help us improve CogniaLauncher.",
        "feedback.category": "Category",
        "feedback.categories.bug": "Bug Report",
        "feedback.categories.feature": "Feature Request",
        "feedback.categories.performance": "Performance",
        "feedback.categories.crash": "Crash Report",
        "feedback.categories.question": "Question",
        "feedback.categories.other": "Other",
        "feedback.severity": "Severity",
        "feedback.severities.critical": "Critical",
        "feedback.severities.high": "High",
        "feedback.severities.medium": "Medium",
        "feedback.severities.low": "Low",
        "feedback.titleLabel": "Title",
        "feedback.titlePlaceholder": "Brief summary",
        "feedback.descriptionLabel": "Description",
        "feedback.descriptionPlaceholder": "Describe the issue...",
        "feedback.contactEmail": "Contact Email (optional)",
        "feedback.contactEmailPlaceholder": "your@email.com",
        "feedback.screenshot": "Screenshot",
        "feedback.captureScreenshot": "Capture Screenshot",
        "feedback.includeDiagnostics": "Include Diagnostic Info",
        "feedback.includeDiagnosticsDesc": "Attach system info",
        "feedback.errorAttached": "Error info attached",
        "feedback.openOnGitHub": "Open on GitHub",
        "feedback.submit": "Submit",
        "common.cancel": "Cancel",
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock("@/lib/tauri", () => ({
  openExternal: jest.fn(),
}));

describe("FeedbackDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDialogOpen = false;
    mockPreSelectedCategory = null;
    mockPreFilledErrorContext = null;
    mockDraft = null;
  });

  it("does not render content when dialog is closed", () => {
    mockDialogOpen = false;
    render(<FeedbackDialog />);
    expect(screen.queryByText("Send Feedback")).not.toBeInTheDocument();
  });

  it("renders dialog content when open", () => {
    mockDialogOpen = true;
    render(<FeedbackDialog />);
    expect(screen.getByText("Send Feedback")).toBeInTheDocument();
    expect(screen.getByText("Help us improve CogniaLauncher.")).toBeInTheDocument();
  });

  it("renders all category buttons", () => {
    mockDialogOpen = true;
    render(<FeedbackDialog />);
    expect(screen.getByText("Bug Report")).toBeInTheDocument();
    expect(screen.getByText("Feature Request")).toBeInTheDocument();
    expect(screen.getByText("Performance")).toBeInTheDocument();
    expect(screen.getByText("Crash Report")).toBeInTheDocument();
    expect(screen.getByText("Question")).toBeInTheDocument();
    expect(screen.getByText("Other")).toBeInTheDocument();
  });

  it("renders title and description inputs", () => {
    mockDialogOpen = true;
    render(<FeedbackDialog />);
    expect(screen.getByPlaceholderText("Brief summary")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Describe the issue...")).toBeInTheDocument();
  });

  it("renders submit and cancel buttons", () => {
    mockDialogOpen = true;
    render(<FeedbackDialog />);
    expect(screen.getByText("Submit")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("renders Open on GitHub link", () => {
    mockDialogOpen = true;
    render(<FeedbackDialog />);
    expect(screen.getByText("Open on GitHub")).toBeInTheDocument();
  });

  it("renders screenshot capture button", () => {
    mockDialogOpen = true;
    render(<FeedbackDialog />);
    expect(screen.getByText("Capture Screenshot")).toBeInTheDocument();
  });

  it("renders diagnostics toggle", () => {
    mockDialogOpen = true;
    render(<FeedbackDialog />);
    expect(screen.getByText("Include Diagnostic Info")).toBeInTheDocument();
  });

  it("submit button is disabled when title is empty", () => {
    mockDialogOpen = true;
    render(<FeedbackDialog />);
    const submitBtn = screen.getByText("Submit").closest("button");
    expect(submitBtn).toBeDisabled();
  });

  it("calls closeDialog when Cancel is clicked", async () => {
    mockDialogOpen = true;
    const user = userEvent.setup();
    render(<FeedbackDialog />);
    await user.click(screen.getByText("Cancel"));
    expect(mockCloseDialog).toHaveBeenCalled();
  });
});
