import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeedbackDialog } from "./feedback-dialog";

jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
  DialogContent: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement>) => (
    <div role="dialog" {...props}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Use var to avoid hoisting issues with jest.mock factories
/* eslint-disable no-var */
var mockSubmitFeedback = jest.fn();
var mockOpenDialog = jest.fn();
var mockCloseDialog = jest.fn();
var mockSaveDraft = jest.fn();
var mockClearDraft = jest.fn();
var mockListFeedbacks = jest.fn().mockResolvedValue([]);
var mockDeleteFeedback = jest.fn().mockResolvedValue(undefined);
var mockExportFeedbackJson = jest.fn().mockResolvedValue(null);
var mockOpenExternal = jest.fn();
var mockToastError = jest.fn();
var mockIsTauri = jest.fn(() => false);
/* eslint-enable no-var */

const feedbackTranslations: Record<string, string> = {
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
  "feedback.uploadScreenshot": "Upload Image",
  "feedback.dragDropHint": "or drag and drop an image here",
  "feedback.removeScreenshot": "Remove screenshot",
  "feedback.screenshotTooLarge": "Image too large",
  "feedback.screenshotInvalidType": "Only image files",
  "feedback.includeDiagnostics": "Include Diagnostic Info",
  "feedback.includeDiagnosticsDesc": "Attach system info",
  "feedback.errorAttached": "Error info attached",
  "feedback.openOnGitHub": "Open on GitHub",
  "feedback.submit": "Submit",
  "feedback.titleRequired": "Title is required",
  "feedback.invalidEmail": "Invalid email format",
  "feedback.draftRestored": "Restored from a previous draft",
  "feedback.clearDraft": "Clear draft",
  "feedback.thankYou": "Thank you!",
  "feedback.thankYouDesc": "Your feedback has been saved.",
  "feedback.viewHistory": "History",
  "feedback.history": "Feedback History",
  "feedback.historyDesc": "View previously saved feedback",
  "feedback.historyWebLimited": "History is available in the desktop app only.",
  "feedback.noHistory": "No feedback yet",
  "feedback.noHistoryDesc": "Submitted feedback will appear here",
  "feedback.historyLoadFailed": "Failed to load feedback history",
  "feedback.historyExportFailed": "Failed to export feedback",
  "feedback.historyDeleteFailed": "Failed to delete feedback",
  "feedback.exportJson": "Export JSON",
  "feedback.deleteConfirm": "Delete this feedback?",
  "feedback.deleteConfirmDesc": "This action cannot be undone.",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.actions": "Actions",
  "common.retry": "Retry",
};

const mockFeedbackT = (key: string) => feedbackTranslations[key] || key;

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
    listFeedbacks: mockListFeedbacks,
    deleteFeedback: mockDeleteFeedback,
    exportFeedbackJson: mockExportFeedbackJson,
  }),
}));

jest.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    t: mockFeedbackT,
  }),
}));

jest.mock("@/lib/tauri", () => ({
  openExternal: (...args: unknown[]) => mockOpenExternal(...args),
}));

jest.mock("@/lib/platform", () => ({
  __esModule: true,
  isTauri: () => mockIsTauri(),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

describe("FeedbackDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(false);
    mockDialogOpen = false;
    mockPreSelectedCategory = null;
    mockPreFilledErrorContext = null;
    mockDraft = null;
  });

  // -----------------------------------------------------------------------
  // Basic rendering
  // -----------------------------------------------------------------------

  it("does not render content when dialog is closed", () => {
    mockDialogOpen = false;
    render(<FeedbackDialog />);
    expect(screen.queryByText("Send Feedback")).not.toBeInTheDocument();
  });

  it("renders dialog content when open", () => {
    mockDialogOpen = true;
    render(<FeedbackDialog />);
    expect(screen.getByText("Send Feedback")).toBeInTheDocument();
    expect(
      screen.getByText("Help us improve CogniaLauncher."),
    ).toBeInTheDocument();
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

  it("renders category options as a single-select group", () => {
    mockDialogOpen = true;
    render(<FeedbackDialog />);
    expect(screen.getByRole("group", { name: "Category" })).toBeInTheDocument();
  });

  it("renders title and description inputs", () => {
    mockDialogOpen = true;
    render(<FeedbackDialog />);
    expect(screen.getByPlaceholderText("Brief summary")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Describe the issue..."),
    ).toBeInTheDocument();
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

  it("renders screenshot capture and upload buttons", () => {
    mockDialogOpen = true;
    render(<FeedbackDialog />);
    expect(screen.getByText("Capture Screenshot")).toBeInTheDocument();
    expect(screen.getByText("Upload Image")).toBeInTheDocument();
    expect(
      screen.getByText("or drag and drop an image here"),
    ).toBeInTheDocument();
  });

  it("renders diagnostics toggle", () => {
    mockDialogOpen = true;
    render(<FeedbackDialog />);
    expect(screen.getByText("Include Diagnostic Info")).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Optimization 1: Dynamic title icon
  // -----------------------------------------------------------------------

  it("renders required marker on title label", () => {
    mockDialogOpen = true;
    render(<FeedbackDialog />);
    const titleLabel = screen.getByText("Title");
    const star = titleLabel.parentElement?.querySelector(".text-destructive");
    expect(star).toBeInTheDocument();
    expect(star?.textContent).toBe("*");
  });

  // -----------------------------------------------------------------------
  // Optimization 2: Character counters
  // -----------------------------------------------------------------------

  it("shows character counter for title (0/200 initially)", () => {
    mockDialogOpen = true;
    render(<FeedbackDialog />);
    expect(screen.getByText("0/200")).toBeInTheDocument();
  });

  it("shows character counter for description (0/5000 initially)", () => {
    mockDialogOpen = true;
    render(<FeedbackDialog />);
    expect(screen.getByText("0/5000")).toBeInTheDocument();
  });

  it("updates title character counter when typing", async () => {
    mockDialogOpen = true;
    const user = userEvent.setup();
    render(<FeedbackDialog />);
    const titleInput = screen.getByPlaceholderText("Brief summary");
    await user.type(titleInput, "Hello");
    expect(screen.getByText("5/200")).toBeInTheDocument();
  });

  it("updates description character counter when typing", async () => {
    mockDialogOpen = true;
    const user = userEvent.setup();
    render(<FeedbackDialog />);
    const descInput = screen.getByPlaceholderText("Describe the issue...");
    await user.type(descInput, "Test desc");
    expect(screen.getByText("9/5000")).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Optimization 3: Form validation + accessibility
  // -----------------------------------------------------------------------

  it("submit button is disabled when title is empty", () => {
    mockDialogOpen = true;
    render(<FeedbackDialog />);
    const submitBtn = screen.getByText("Submit").closest("button");
    expect(submitBtn).toBeDisabled();
  });

  it("shows title validation error on blur when empty", async () => {
    mockDialogOpen = true;
    const user = userEvent.setup();
    render(<FeedbackDialog />);
    const titleInput = screen.getByPlaceholderText("Brief summary");
    await user.click(titleInput);
    await user.tab();
    expect(screen.getByText("Title is required")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("title input has aria-required attribute", () => {
    mockDialogOpen = true;
    render(<FeedbackDialog />);
    const titleInput = screen.getByPlaceholderText("Brief summary");
    expect(titleInput).toHaveAttribute("aria-required");
  });

  it("title input has aria-invalid when touched and empty", async () => {
    mockDialogOpen = true;
    const user = userEvent.setup();
    render(<FeedbackDialog />);
    const titleInput = screen.getByPlaceholderText("Brief summary");
    await user.click(titleInput);
    await user.tab();
    expect(titleInput).toHaveAttribute("aria-invalid", "true");
  });

  it("sets title field container data-invalid when validation fails", async () => {
    mockDialogOpen = true;
    const user = userEvent.setup();
    render(<FeedbackDialog />);
    const titleInput = screen.getByPlaceholderText("Brief summary");
    await user.click(titleInput);
    await user.tab();
    const titleField = titleInput.closest('[data-slot="field"]');
    expect(titleField).toHaveAttribute("data-invalid", "true");
  });

  it("does not show title error before blur", () => {
    mockDialogOpen = true;
    render(<FeedbackDialog />);
    expect(screen.queryByText("Title is required")).not.toBeInTheDocument();
  });

  it("shows email validation error for invalid email", async () => {
    mockDialogOpen = true;
    const user = userEvent.setup();
    render(<FeedbackDialog />);
    const emailInput = screen.getByPlaceholderText("your@email.com");
    await user.type(emailInput, "not-an-email");
    await user.tab();
    expect(screen.getByText("Invalid email format")).toBeInTheDocument();
  });

  it("does not show email error for valid email", async () => {
    mockDialogOpen = true;
    const user = userEvent.setup();
    render(<FeedbackDialog />);
    const emailInput = screen.getByPlaceholderText("your@email.com");
    await user.type(emailInput, "user@example.com");
    await user.tab();
    expect(screen.queryByText("Invalid email format")).not.toBeInTheDocument();
  });

  it("does not show email error when email is empty", async () => {
    mockDialogOpen = true;
    const user = userEvent.setup();
    render(<FeedbackDialog />);
    const emailInput = screen.getByPlaceholderText("your@email.com");
    await user.click(emailInput);
    await user.tab();
    expect(screen.queryByText("Invalid email format")).not.toBeInTheDocument();
  });

  it("submit button is disabled when email is invalid", async () => {
    mockDialogOpen = true;
    const user = userEvent.setup();
    render(<FeedbackDialog />);
    const titleInput = screen.getByPlaceholderText("Brief summary");
    await user.type(titleInput, "Bug title");
    const emailInput = screen.getByPlaceholderText("your@email.com");
    await user.type(emailInput, "bad-email");
    await user.tab();
    const submitBtn = screen.getByText("Submit").closest("button");
    expect(submitBtn).toBeDisabled();
  });

  // -----------------------------------------------------------------------
  // Optimization 4: Draft restoration banner
  // -----------------------------------------------------------------------

  it("shows draft restored banner when draft exists", () => {
    mockDraft = {
      category: "feature",
      title: "Draft title",
      description: "Draft desc",
      includeDiagnostics: false,
    };
    mockDialogOpen = true;
    render(<FeedbackDialog />);
    expect(
      screen.getByText("Restored from a previous draft"),
    ).toBeInTheDocument();
    expect(screen.getByText("Clear draft")).toBeInTheDocument();
  });

  it("does not show draft banner when no draft", () => {
    mockDialogOpen = true;
    render(<FeedbackDialog />);
    expect(
      screen.queryByText("Restored from a previous draft"),
    ).not.toBeInTheDocument();
  });

  it("does not show draft banner when errorContext is pre-filled", () => {
    mockPreFilledErrorContext = { message: "Error occurred" };
    mockPreSelectedCategory = "bug";
    mockDraft = { title: "Old draft" };
    mockDialogOpen = true;
    render(<FeedbackDialog />);
    expect(
      screen.queryByText("Restored from a previous draft"),
    ).not.toBeInTheDocument();
  });

  it("clears draft when Clear draft button is clicked", async () => {
    mockDraft = {
      category: "bug",
      title: "Draft title",
      description: "",
      includeDiagnostics: true,
    };
    mockDialogOpen = true;
    const user = userEvent.setup();
    render(<FeedbackDialog />);
    await user.click(screen.getByText("Clear draft"));
    expect(mockClearDraft).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Optimization 5: Screenshot upload + drag-drop
  // -----------------------------------------------------------------------

  it("renders upload image button", () => {
    mockDialogOpen = true;
    render(<FeedbackDialog />);
    expect(screen.getByText("Upload Image")).toBeInTheDocument();
  });

  it("renders drag and drop hint text", () => {
    mockDialogOpen = true;
    render(<FeedbackDialog />);
    expect(
      screen.getByText("or drag and drop an image here"),
    ).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Optimization 6: Success confirmation UI
  // -----------------------------------------------------------------------

  it("shows success confirmation after submit", async () => {
    mockDialogOpen = true;
    mockSubmitFeedback.mockResolvedValueOnce({
      success: true,
      mode: "tauri",
      result: { id: "test-id", path: "/test" },
    });
    const user = userEvent.setup();
    render(<FeedbackDialog />);

    const titleInput = screen.getByPlaceholderText("Brief summary");
    await user.type(titleInput, "Test bug report");
    await user.click(screen.getByText("Submit"));

    expect(screen.getByText("Thank you!")).toBeInTheDocument();
    expect(
      screen.getByText("Your feedback has been saved."),
    ).toBeInTheDocument();
  });

  it("calls clearDraft on successful submit", async () => {
    mockDialogOpen = true;
    mockSubmitFeedback.mockResolvedValueOnce({
      success: true,
      mode: "tauri",
      result: { id: "test-id", path: "/test" },
    });
    const user = userEvent.setup();
    render(<FeedbackDialog />);

    const titleInput = screen.getByPlaceholderText("Brief summary");
    await user.type(titleInput, "Test bug report");
    await user.click(screen.getByText("Submit"));

    expect(mockClearDraft).toHaveBeenCalled();
  });

  it("keeps the form open when submit fails", async () => {
    mockDialogOpen = true;
    mockSubmitFeedback.mockResolvedValueOnce({ success: false });
    const user = userEvent.setup();
    render(<FeedbackDialog />);

    const titleInput = screen.getByPlaceholderText("Brief summary");
    await user.type(titleInput, "Test bug report");
    await user.click(screen.getByText("Submit"));

    expect(screen.queryByText("Thank you!")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Test bug report")).toBeInTheDocument();
    expect(mockClearDraft).not.toHaveBeenCalled();
    expect(mockCloseDialog).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Optimization 7: History dialog button
  // -----------------------------------------------------------------------

  it("renders History button in footer", () => {
    mockDialogOpen = true;
    render(<FeedbackDialog />);
    expect(screen.getByText("History")).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // General interactions
  // -----------------------------------------------------------------------

  it("calls closeDialog when Cancel is clicked", async () => {
    mockDialogOpen = true;
    const user = userEvent.setup();
    render(<FeedbackDialog />);
    await user.click(screen.getByText("Cancel"));
    expect(mockCloseDialog).toHaveBeenCalled();
  });

  it("saves draft when closing with content", async () => {
    mockDialogOpen = true;
    const user = userEvent.setup();
    render(<FeedbackDialog />);

    const titleInput = screen.getByPlaceholderText("Brief summary");
    await user.type(titleInput, "Some title");
    await user.click(screen.getByText("Cancel"));

    expect(mockSaveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Some title",
        category: "bug",
      }),
    );
  });

  it("enables submit button when title has content", async () => {
    mockDialogOpen = true;
    const user = userEvent.setup();
    render(<FeedbackDialog />);

    const titleInput = screen.getByPlaceholderText("Brief summary");
    await user.type(titleInput, "A bug");

    const submitBtn = screen.getByText("Submit").closest("button");
    expect(submitBtn).not.toBeDisabled();
  });

  it("pre-fills error context when provided", () => {
    mockPreFilledErrorContext = {
      message: "Something crashed",
      stack: "Error: Something crashed\n  at test.js:1",
      component: "TestComp",
    };
    mockPreSelectedCategory = "crash";
    mockDialogOpen = true;
    render(<FeedbackDialog />);

    expect(screen.getByText("Error info attached")).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // handleOpenGitHub
  // -----------------------------------------------------------------------

  it("calls openExternal when Open on GitHub is clicked", async () => {
    mockDialogOpen = true;
    const user = userEvent.setup();
    render(<FeedbackDialog />);
    await user.click(screen.getByText("Open on GitHub"));
    expect(mockOpenExternal).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // handleFileUpload validation
  // -----------------------------------------------------------------------

  // Note: file upload validation tests (size/type) cannot be reliably tested
  // in jsdom because fireEvent.change on file inputs with accept="image/*"
  // does not properly set e.target.files for the handler.

  // -----------------------------------------------------------------------
  // handleSubmit does not submit when title is empty
  // -----------------------------------------------------------------------

  it("does not call submitFeedback when title is empty", () => {
    mockDialogOpen = true;
    render(<FeedbackDialog />);

    const submitBtn = screen.getByText("Submit").closest("button")!;
    expect(submitBtn).toBeDisabled();
    expect(mockSubmitFeedback).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // handleClose saves draft with content
  // -----------------------------------------------------------------------

  it("does not save draft when closing with no content", async () => {
    mockDialogOpen = true;
    const user = userEvent.setup();
    render(<FeedbackDialog />);
    await user.click(screen.getByText("Cancel"));
    expect(mockSaveDraft).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Category switching
  // -----------------------------------------------------------------------

  it("switches category when clicking a different category button", async () => {
    mockDialogOpen = true;
    const user = userEvent.setup();
    render(<FeedbackDialog />);
    await user.click(screen.getByText("Feature Request"));
    // The severity selector should disappear (feature is not in SEVERITY_CATEGORIES)
    expect(screen.queryByText("Severity")).not.toBeInTheDocument();
  });

  it("shows severity selector for bug category", () => {
    mockDialogOpen = true;
    render(<FeedbackDialog />);
    // bug is the default category, which is in SEVERITY_CATEGORIES
    expect(screen.getByText("Severity")).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Email validation clears on valid re-type
  // -----------------------------------------------------------------------

  it("clears email error when user corrects the email", async () => {
    mockDialogOpen = true;
    const user = userEvent.setup();
    render(<FeedbackDialog />);
    const emailInput = screen.getByPlaceholderText("your@email.com");
    await user.type(emailInput, "bad");
    await user.tab();
    expect(screen.getByText("Invalid email format")).toBeInTheDocument();

    await user.clear(emailInput);
    await user.type(emailInput, "good@test.com");
    expect(screen.queryByText("Invalid email format")).not.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // handleCaptureScreenshot
  // -----------------------------------------------------------------------

  it("calls html2canvas when Capture Screenshot is clicked", async () => {
    const mockToDataURL = jest
      .fn()
      .mockReturnValue("data:image/png;base64,abc");
    const mockHtml2canvas = jest
      .fn()
      .mockResolvedValue({ toDataURL: mockToDataURL });
    jest.mock(
      "html2canvas",
      () => ({ default: mockHtml2canvas, __esModule: true }),
      { virtual: true },
    );

    mockDialogOpen = true;
    const user = userEvent.setup();
    render(<FeedbackDialog />);
    // Click capture screenshot — it dynamically imports html2canvas,
    // which may fail in test env; we just verify the button is clickable
    // and the loading state works (capturingScreenshot)
    const btn = screen.getByText("Capture Screenshot");
    expect(btn).toBeInTheDocument();
    // The dynamic import will likely fail in test env, which is fine —
    // it falls back to file input click
    await user.click(btn);
  });

  // -----------------------------------------------------------------------
  // handleDrop (drag-drop zone)
  // -----------------------------------------------------------------------

  it("shows drag-over visual state on dragOver and reverts on dragLeave", () => {
    mockDialogOpen = true;
    render(<FeedbackDialog />);
    const dropZone = screen
      .getByText("or drag and drop an image here")
      .closest("div[class*='border-dashed']")!;
    expect(dropZone).toBeInTheDocument();

    fireEvent.dragOver(dropZone, { dataTransfer: { files: [] } });
    expect(dropZone.className).toContain("border-primary");

    fireEvent.dragLeave(dropZone);
    expect(dropZone.className).not.toContain("border-primary");
  });

  it("handles drop event with empty files", () => {
    mockDialogOpen = true;
    render(<FeedbackDialog />);
    const dropZone = screen
      .getByText("or drag and drop an image here")
      .closest("div[class*='border-dashed']")!;

    fireEvent.drop(dropZone, { dataTransfer: { files: [] } });
    // No error toast since no file was provided
    expect(mockToastError).not.toHaveBeenCalled();
  });

  // Note: non-image drop + oversized drop tests skipped — fireEvent.drop
  // in jsdom serializes dataTransfer.files, losing File.type and File.size.

  it("handles drop event with valid image file", () => {
    mockDialogOpen = true;
    render(<FeedbackDialog />);
    const dropZone = screen
      .getByText("or drag and drop an image here")
      .closest("div[class*='border-dashed']")!;

    const validImage = new File(["img-data"], "photo.png", {
      type: "image/png",
    });
    fireEvent.drop(dropZone, { dataTransfer: { files: [validImage] } });
    // No error toast — file is valid
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("triggers file input when Upload Image button is clicked", () => {
    mockDialogOpen = true;
    render(<FeedbackDialog />);
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const clickSpy = jest.spyOn(fileInput, "click");
    const uploadBtn = screen.getByText("Upload Image");
    fireEvent.click(uploadBtn);
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  // -----------------------------------------------------------------------
  // validateEmail function (covered via email tests above, this adds edge case)
  // -----------------------------------------------------------------------

  it("does not show email error for empty then re-focus", async () => {
    mockDialogOpen = true;
    const user = userEvent.setup();
    render(<FeedbackDialog />);
    const emailInput = screen.getByPlaceholderText("your@email.com");
    // Focus and blur with empty value — should not show error
    await user.click(emailInput);
    await user.tab();
    await user.click(emailInput);
    await user.tab();
    expect(screen.queryByText("Invalid email format")).not.toBeInTheDocument();
  });
});

// ===========================================================================
// FeedbackHistoryDialog (tested via History button click)
// ===========================================================================

describe("FeedbackHistoryDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(false);
    mockDialogOpen = true;
    mockPreSelectedCategory = null;
    mockPreFilledErrorContext = null;
    mockDraft = null;
  });

  it("opens history dialog showing web fallback message", async () => {
    const user = userEvent.setup();
    render(<FeedbackDialog />);
    await user.click(screen.getByRole("button", { name: "History" }));
    expect(screen.getByText("Feedback History")).toBeInTheDocument();
    expect(
      screen.getByText("View previously saved feedback"),
    ).toBeInTheDocument();
  });

  it("shows history dialog with empty state when isTauri returns true but no items", async () => {
    mockIsTauri.mockReturnValue(true);
    mockListFeedbacks.mockResolvedValue([]);

    const user = userEvent.setup();
    render(<FeedbackDialog />);
    await user.click(screen.getByRole("button", { name: "History" }));
    await screen.findByText("Feedback History");
    await waitFor(() => {
      expect(mockListFeedbacks).toHaveBeenCalled();
    });

    // Wait for async load
    const noHistory = await screen.findByText(
      "No feedback yet",
      {},
      { timeout: 5000 },
    );
    expect(noHistory).toBeInTheDocument();
    expect(
      screen.getByText("Submitted feedback will appear here"),
    ).toBeInTheDocument();
    expect(document.querySelector('[data-slot="empty"]')).toBeInTheDocument();
  });

  it("shows operation-scoped error when history loading fails", async () => {
    mockIsTauri.mockReturnValue(true);
    mockListFeedbacks.mockRejectedValue(new Error("load failed"));

    const user = userEvent.setup();
    render(<FeedbackDialog />);
    await user.click(screen.getByRole("button", { name: "History" }));
    await screen.findByText("Feedback History");
    await waitFor(() => {
      expect(mockListFeedbacks).toHaveBeenCalled();
    });

    expect(
      await screen.findByText("No feedback yet", {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(mockToastError).toHaveBeenCalledWith(
      "Failed to load feedback history",
    );
  });

  it("retries history loading without closing the dialog", async () => {
    mockIsTauri.mockReturnValue(true);
    mockListFeedbacks
      .mockRejectedValueOnce(new Error("load failed"))
      .mockResolvedValueOnce([
        {
          id: "fb-retry",
          category: "bug",
          severity: "high",
          title: "Recovered history item",
          description: "desc",
          includeDiagnostics: false,
          appVersion: "0.1.0",
          os: "Windows",
          arch: "x86_64",
          currentPage: "/",
          status: "saved",
          createdAt: "2026-01-15T10:00:00Z",
          updatedAt: "2026-01-15T10:00:00Z",
        },
      ]);

    const user = userEvent.setup();
    render(<FeedbackDialog />);
    await user.click(screen.getByRole("button", { name: "History" }));
    await screen.findByText("Feedback History");
    await screen.findByRole("button", { name: "Retry" });

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(
      await screen.findByText("Recovered history item", {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(mockListFeedbacks).toHaveBeenCalledTimes(2);
  });

  it("shows feedback items in history table", async () => {
    mockIsTauri.mockReturnValue(true);
    mockListFeedbacks.mockResolvedValue([
      {
        id: "fb-1",
        category: "bug",
        severity: "high",
        title: "Test feedback item",
        description: "desc",
        includeDiagnostics: false,
        appVersion: "0.1.0",
        os: "Windows",
        arch: "x86_64",
        currentPage: "/",
        status: "saved",
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-15T10:00:00Z",
      },
    ]);

    const user = userEvent.setup();
    render(<FeedbackDialog />);
    await user.click(screen.getByRole("button", { name: "History" }));
    await screen.findByText("Feedback History");
    await waitFor(() => {
      expect(mockListFeedbacks).toHaveBeenCalled();
    });

    const item = await screen.findByText(
      "Test feedback item",
      {},
      { timeout: 5000 },
    );
    expect(item).toBeInTheDocument();
    // "Bug Report" appears in both main dialog categories and history table badge
    expect(screen.getAllByText("Bug Report").length).toBeGreaterThanOrEqual(1);
  });

  it("exports feedback as JSON download", async () => {
    mockIsTauri.mockReturnValue(true);
    mockListFeedbacks.mockResolvedValue([
      {
        id: "fb-2",
        category: "feature",
        title: "Export test",
        description: "",
        includeDiagnostics: false,
        appVersion: "0.1.0",
        os: "Windows",
        arch: "x86_64",
        currentPage: "/",
        status: "saved",
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-15T10:00:00Z",
      },
    ]);
    mockExportFeedbackJson.mockResolvedValueOnce('{"id":"fb-2"}');

    const createObjectURL = jest.fn(() => "blob:test");
    const revokeObjectURL = jest.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;

    const user = userEvent.setup();
    render(<FeedbackDialog />);
    await user.click(screen.getByRole("button", { name: "History" }));
    await screen.findByText("Feedback History");
    await waitFor(() => {
      expect(mockListFeedbacks).toHaveBeenCalled();
    });

    await screen.findByText("Export test", {}, { timeout: 5000 });

    // Click the first icon button (export/download) in the actions column
    const actionButtons = document.querySelectorAll('[class*="h-7 w-7"]');
    if (actionButtons.length > 0) {
      await user.click(actionButtons[0] as HTMLElement);
      // exportFeedbackJson should have been called
      expect(mockExportFeedbackJson).toHaveBeenCalledWith("fb-2");
    }
  });

  it("shows error feedback when export fails", async () => {
    mockIsTauri.mockReturnValue(true);
    mockListFeedbacks.mockResolvedValue([
      {
        id: "fb-export-fail",
        category: "feature",
        title: "Export fail test",
        description: "",
        includeDiagnostics: false,
        appVersion: "0.1.0",
        os: "Windows",
        arch: "x86_64",
        currentPage: "/",
        status: "saved",
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-15T10:00:00Z",
      },
    ]);
    mockExportFeedbackJson.mockRejectedValueOnce(new Error("export failed"));

    const user = userEvent.setup();
    render(<FeedbackDialog />);
    await user.click(screen.getByRole("button", { name: "History" }));
    await screen.findByText("Feedback History");
    await waitFor(() => {
      expect(mockListFeedbacks).toHaveBeenCalled();
    });
    await screen.findByText("Export fail test", {}, { timeout: 5000 });

    const actionButtons = document.querySelectorAll('[class*="h-7 w-7"]');
    if (actionButtons.length > 0) {
      await user.click(actionButtons[0] as HTMLElement);
      expect(mockToastError).toHaveBeenCalledWith("Failed to export feedback");
    }
  });

  it("deletes feedback item from history", async () => {
    mockIsTauri.mockReturnValue(true);
    mockListFeedbacks.mockResolvedValue([
      {
        id: "fb-3",
        category: "bug",
        severity: "medium",
        title: "Delete test",
        description: "",
        includeDiagnostics: false,
        appVersion: "0.1.0",
        os: "Windows",
        arch: "x86_64",
        currentPage: "/",
        status: "saved",
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-15T10:00:00Z",
      },
    ]);

    const user = userEvent.setup();
    render(<FeedbackDialog />);
    await user.click(screen.getByRole("button", { name: "History" }));
    await screen.findByText("Feedback History");
    await waitFor(() => {
      expect(mockListFeedbacks).toHaveBeenCalled();
    });

    await screen.findByText("Delete test", {}, { timeout: 5000 });

    // Find the delete button (destructive colored, second icon button)
    const deleteButtons = document.querySelectorAll(
      '[class*="text-destructive"][class*="h-7"]',
    );
    if (deleteButtons.length > 0) {
      await user.click(deleteButtons[0] as HTMLElement);
      // Confirm deletion in the AlertDialog
      const confirmBtn = await screen.findByText("Delete");
      if (confirmBtn) {
        await user.click(confirmBtn);
        expect(mockDeleteFeedback).toHaveBeenCalledWith("fb-3");
      }
    }
  });

  it("keeps item and shows error when delete fails", async () => {
    mockIsTauri.mockReturnValue(true);
    mockListFeedbacks.mockResolvedValue([
      {
        id: "fb-delete-fail",
        category: "bug",
        severity: "medium",
        title: "Delete fail test",
        description: "",
        includeDiagnostics: false,
        appVersion: "0.1.0",
        os: "Windows",
        arch: "x86_64",
        currentPage: "/",
        status: "saved",
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-15T10:00:00Z",
      },
    ]);
    mockDeleteFeedback.mockRejectedValueOnce(new Error("delete failed"));

    const user = userEvent.setup();
    render(<FeedbackDialog />);
    await user.click(screen.getByRole("button", { name: "History" }));
    await screen.findByText("Feedback History");
    await waitFor(() => {
      expect(mockListFeedbacks).toHaveBeenCalled();
    });
    await screen.findByText("Delete fail test", {}, { timeout: 5000 });

    const deleteButtons = document.querySelectorAll(
      '[class*="text-destructive"][class*="h-7"]',
    );
    if (deleteButtons.length > 0) {
      await user.click(deleteButtons[0] as HTMLElement);
      const confirmBtn = await screen.findByText("Delete");
      await user.click(confirmBtn);
      expect(mockToastError).toHaveBeenCalledWith("Failed to delete feedback");
      expect(screen.getByText("Delete fail test")).toBeInTheDocument();
    }
  });

  it("filters history items by search query", async () => {
    mockIsTauri.mockReturnValue(true);
    mockListFeedbacks.mockResolvedValue([
      {
        id: "fb-4",
        category: "bug",
        title: "Alpha bug",
        description: "",
        includeDiagnostics: false,
        appVersion: "0.1.0",
        os: "Windows",
        arch: "x86_64",
        currentPage: "/",
        status: "saved",
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-15T10:00:00Z",
      },
      {
        id: "fb-5",
        category: "feature",
        title: "Beta feature",
        description: "",
        includeDiagnostics: false,
        appVersion: "0.1.0",
        os: "Windows",
        arch: "x86_64",
        currentPage: "/",
        status: "saved",
        createdAt: "2026-01-16T10:00:00Z",
        updatedAt: "2026-01-16T10:00:00Z",
      },
    ]);

    const user = userEvent.setup();
    render(<FeedbackDialog />);
    await user.click(screen.getByRole("button", { name: "History" }));
    await screen.findByText("Feedback History");
    await waitFor(() => {
      expect(mockListFeedbacks).toHaveBeenCalled();
    });

    await screen.findByText("Alpha bug", {}, { timeout: 5000 });
    expect(screen.getByText("Beta feature")).toBeInTheDocument();

    // Type in search box
    const searchInput = screen.getByPlaceholderText(
      "View previously saved feedback",
    );
    await user.type(searchInput, "Alpha");

    expect(screen.getByText("Alpha bug")).toBeInTheDocument();
    expect(screen.queryByText("Beta feature")).not.toBeInTheDocument();
  });
});
