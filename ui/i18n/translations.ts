export type Locale = "en" | "vi";

export interface Translations {
  // ── App chrome ──
  appName: string;
  selected: string;
  rescan: string;
  tabScan: string;
  tabDesign: string;

  // ── Empty state ──
  selectFrame: string;
  selectedLabel: string;
  emptyHint: string;
  scanComponent: string;
  scanning: string;
  batchScan: string;

  // ── Design.md — Step 1 ──
  step1: string;
  projectSetup: string;
  step1Hint: string;
  syncFigma: string;
  syncing: string;
  syncedStatus: (components: number, pages: number, variables: number) => string;
  projectName: string;
  category: string;
  designStyle: string;
  openDesignPreset: string;
  layoutTemplate: string;
  languageModels: string;
  missingComponents: string;
  missingVariables: string;
  missingBoth: string;
  useStarterProposal: string;
  createProject: string;
  creating: string;

  // ── Design.md — Step 2 ──
  step2: string;
  reviewOverview: string;
  step2Hint: string;
  dashboard: string;
  components: string;
  pages: string;
  variables: string;
  files: string;
  tokens: string;
  uiScore: string;
  noPagesYet: string;
  folderStructure: string;
  templateMapping: string;
  addComponent: string;
  autoMatch: string;
  mappingNote: string;
  up: string;
  down: string;
  remove: string;
  moreVariables: (count: number) => string;

  // ── Design.md — Step 3 ──
  step3: string;
  qualityStandards: string;
  step3Hint: string;
  uiAuditScores: string;

  // ── Design.md — Step 4 ──
  step4: string;
  contentGeneration: string;
  step4Hint: string;

  // ── Design.md — Step 5 ──
  step5: string;
  exportDeliver: string;
  step5Hint: string;
  aiPromptPreview: string;
  previewTruncated: string;

  // ── Export Hub ──
  export: string;
  downloadProject: string;
  downloadDesc: string;
  exportFigmaFrame: string;
  exportingFrame: string;
  figmaFrameDesc: string;
  copyAiPrompt: string;
  copied: string;
  copyDesc: string;
  exportBaReport: string;
  baReportDesc: string;

  // ── UI/UX Evaluation ──
  uiUxEvaluation: string;
  pass: string;
  warn: string;
  fail: string;

  // ── BA Document ──
  baDocument: string;

  // ── Standards Checklist ──
  standardsChecklist: string;
  uiUxStandards: string;
  baStandards: string;
  required: string;
  addCustomStandard: string;
  resetDefaults: string;
  newStandard: string;
  add: string;
  cancel: string;

  // ── Screen Generation ──
  screenGeneration: string;
  numberOfScreens: string;
  screens: string;
  generating: string;
  exportToFigma: (count: number) => string;
  copyAllPrompts: string;
  copy: string;
  screenGenHint: string;

  // ── BA Document ──
  baDocLoaded: string;
  baDocEmptyText: string;
  useTemplate: string;
  importFile: string;
  documentTitle: string;
  pasteOrWrite: string;
  saveDocument: string;
  edit: string;
  reImport: string;
  clear: string;
  saved: string;
  truncatedPreview: string;
  detectedScreens: string;

  // ── UI/UX Evaluation categories ──
  catDocumentation: string;
  catGuidelines: string;
  catTesting: string;
  catColor: string;
  catAccessibility: string;
  catStates: string;
  catIcons: string;

  // ── Language toggle ──
  language: string;
}

export const en: Translations = {
  appName: "DesignReady",
  selected: "Selected",
  rescan: "Rescan",
  tabScan: "Scan",
  tabDesign: "Design.md",

  selectFrame: "Select a frame",
  selectedLabel: "Selected",
  emptyHint: "Score your Figma designs for AI-readiness, fix common issues, and generate structured code prompts.",
  scanComponent: "Scan Component",
  scanning: "Scanning...",
  batchScan: "Batch Scan",

  step1: "Step 1",
  projectSetup: "Project Setup",
  step1Hint: "Configure your project and sync components from Figma. This is the starting point for generating your AI training folder.",
  syncFigma: "Sync Figma",
  syncing: "Syncing...",
  syncedStatus: (c, p, v) => `Synced ${c} components, ${p} pages, and ${v} variables from Figma.`,
  projectName: "Project name",
  category: "Category",
  designStyle: "Design style",
  openDesignPreset: "Open Design preset",
  layoutTemplate: "Layout template",
  languageModels: "Language models",
  missingComponents: "components",
  missingVariables: "variables",
  missingBoth: " and ",
  useStarterProposal: "Use starter proposal",
  createProject: "Create Project",
  creating: "Creating...",

  step2: "Step 2",
  reviewOverview: "Review & Overview",
  step2Hint: "Check your synced data, review the generated file structure, and map components to template sections.",
  dashboard: "Dashboard",
  components: "Components",
  pages: "Pages",
  variables: "Variables",
  files: "Files",
  tokens: "Tokens",
  uiScore: "UI score",
  noPagesYet: "No pages synced yet",
  folderStructure: "Folder Structure",
  templateMapping: "Template Mapping",
  addComponent: "Add component",
  autoMatch: "Auto match will be used for this section.",
  mappingNote: "Manual mapping is used first, in the order shown here. Auto match fills any empty section.",
  up: "Up",
  down: "Down",
  remove: "Remove",
  moreVariables: (n) => `+${n} more variables`,

  step3: "Step 3",
  qualityStandards: "Quality & Standards",
  step3Hint: "Evaluate your design system quality across 7 categories. Check which UI/UX and BA standards are met before exporting.",
  uiAuditScores: "UI Audit Scores",

  step4: "Step 4",
  contentGeneration: "Content & Generation",
  step4Hint: "Import your BA document to add business context. Use Screen Generation to create detailed AI prompts for building screens from your design system.",

  step5: "Step 5",
  exportDeliver: "Export & Deliver",
  step5Hint: "Download the full project ZIP, export a visual Figma frame, copy the AI training prompt, or generate a BA report.",
  aiPromptPreview: "AI Prompt Preview",
  previewTruncated: "... preview truncated. Download Project for full compact export.",

  export: "Export",
  downloadProject: "Download Project",
  downloadDesc: "ZIP with all markdown files",
  exportFigmaFrame: "Export Figma Frame",
  exportingFrame: "Exporting...",
  figmaFrameDesc: "Create visual frame in Figma",
  copyAiPrompt: "Copy AI Prompt",
  copied: "Copied!",
  copyDesc: "Full prompt for Claude/Cursor",
  exportBaReport: "Export BA Report",
  baReportDesc: "Standards + evaluation as markdown",

  uiUxEvaluation: "UI/UX Evaluation",
  pass: "pass",
  warn: "warn",
  fail: "fail",

  baDocument: "BA Document",
  standardsChecklist: "Standards Checklist",
  uiUxStandards: "UI/UX Standards",
  baStandards: "BA Standards",
  required: "required",
  addCustomStandard: "+ Add custom standard",
  resetDefaults: "Reset defaults",
  newStandard: "New standard...",
  add: "Add",
  cancel: "Cancel",

  screenGeneration: "Screen Generation",
  numberOfScreens: "Number of screens",
  screens: "screens",
  generating: "Generating...",
  exportToFigma: (n) => `Export ${n} Screen${n > 1 ? "s" : ""} to Figma`,
  copyAllPrompts: "Copy All Prompts",
  copy: "Copy",
  screenGenHint: "Each prompt includes your components, tokens, BA requirements, and standards checklist. Use \"Copy\" to paste into Claude/Cursor for code generation, or \"Export to Figma\" for visual preview.",

  baDocLoaded: "Loaded",
  baDocEmptyText: "Import a BA document to guide screen generation. The agent uses your business requirements to produce accurate layouts.",
  useTemplate: "Use Template",
  importFile: "Import File (.md, .txt)",
  documentTitle: "Document title",
  pasteOrWrite: "Paste or write your BA document in Markdown...",
  saveDocument: "Save Document",
  edit: "Edit",
  reImport: "Re-import",
  clear: "Clear",
  saved: "✓ Saved",
  truncatedPreview: "... (truncated preview)",
  detectedScreens: "Detected Screens:",

  catDocumentation: "Documentation",
  catGuidelines: "Design Guidelines",
  catTesting: "Test Readiness",
  catColor: "Color System",
  catAccessibility: "Accessibility",
  catStates: "Interactive States",
  catIcons: "Icon System",

  language: "Language",
};

export const vi: Translations = {
  appName: "DesignReady",
  selected: "Đã chọn",
  rescan: "Quét lại",
  tabScan: "Quét",
  tabDesign: "Design.md",

  selectFrame: "Chọn một frame",
  selectedLabel: "Đã chọn",
  emptyHint: "Chấm điểm thiết kế Figma cho AI, sửa lỗi phổ biến và tạo prompt code có cấu trúc.",
  scanComponent: "Quét Component",
  scanning: "Đang quét...",
  batchScan: "Quét hàng loạt",

  step1: "Bước 1",
  projectSetup: "Cài đặt dự án",
  step1Hint: "Cấu hình dự án và đồng bộ component từ Figma. Đây là điểm bắt đầu để tạo thư mục huấn luyện AI.",
  syncFigma: "Đồng bộ Figma",
  syncing: "Đang đồng bộ...",
  syncedStatus: (c, p, v) => `Đã đồng bộ ${c} component, ${p} trang và ${v} biến từ Figma.`,
  projectName: "Tên dự án",
  category: "Danh mục",
  designStyle: "Phong cách thiết kế",
  openDesignPreset: "Preset thiết kế mở",
  layoutTemplate: "Mẫu bố cục",
  languageModels: "Mô hình ngôn ngữ",
  missingComponents: "component",
  missingVariables: "biến",
  missingBoth: " và ",
  useStarterProposal: "Dùng đề xuất mẫu",
  createProject: "Tạo dự án",
  creating: "Đang tạo...",

  step2: "Bước 2",
  reviewOverview: "Xem lại & Tổng quan",
  step2Hint: "Kiểm tra dữ liệu đã đồng bộ, xem cấu trúc file được tạo và ánh xạ component vào các phần template.",
  dashboard: "Bảng điều khiển",
  components: "Component",
  pages: "Trang",
  variables: "Biến",
  files: "File",
  tokens: "Token",
  uiScore: "Điểm UI",
  noPagesYet: "Chưa có trang nào được đồng bộ",
  folderStructure: "Cấu trúc thư mục",
  templateMapping: "Ánh xạ template",
  addComponent: "Thêm component",
  autoMatch: "Tự động ghép nối sẽ được sử dụng cho phần này.",
  mappingNote: "Ánh xạ thủ công được ưu tiên, theo thứ tự hiển thị. Tự động ghép nối sẽ điền các phần trống.",
  up: "Lên",
  down: "Xuống",
  remove: "Xóa",
  moreVariables: (n) => `+${n} biến khác`,

  step3: "Bước 3",
  qualityStandards: "Chất lượng & Tiêu chuẩn",
  step3Hint: "Đánh giá chất lượng hệ thống thiết kế qua 7 danh mục. Kiểm tra tiêu chuẩn UI/UX và BA đã đạt trước khi xuất.",
  uiAuditScores: "Điểm đánh giá UI",

  step4: "Bước 4",
  contentGeneration: "Nội dung & Tạo màn hình",
  step4Hint: "Nhập tài liệu BA để thêm ngữ cảnh kinh doanh. Sử dụng Tạo màn hình để tạo prompt AI chi tiết từ hệ thống thiết kế.",

  step5: "Bước 5",
  exportDeliver: "Xuất & Chuyển giao",
  step5Hint: "Tải toàn bộ dự án ZIP, xuất frame Figma trực quan, sao chép prompt AI, hoặc tạo báo cáo BA.",
  aiPromptPreview: "Xem trước prompt AI",
  previewTruncated: "... đã cắt ngắn. Tải dự án để xem đầy đủ.",

  export: "Xuất",
  downloadProject: "Tải dự án",
  downloadDesc: "ZIP chứa tất cả file markdown",
  exportFigmaFrame: "Xuất Frame Figma",
  exportingFrame: "Đang xuất...",
  figmaFrameDesc: "Tạo frame trực quan trong Figma",
  copyAiPrompt: "Sao chép Prompt AI",
  copied: "Đã sao chép!",
  copyDesc: "Prompt đầy đủ cho Claude/Cursor",
  exportBaReport: "Xuất báo cáo BA",
  baReportDesc: "Tiêu chuẩn + đánh giá dạng markdown",

  uiUxEvaluation: "Đánh giá UI/UX",
  pass: "đạt",
  warn: "cảnh báo",
  fail: "lỗi",

  baDocument: "Tài liệu BA",
  standardsChecklist: "Danh sách tiêu chuẩn",
  uiUxStandards: "Tiêu chuẩn UI/UX",
  baStandards: "Tiêu chuẩn BA",
  required: "bắt buộc",
  addCustomStandard: "+ Thêm tiêu chuẩn tùy chỉnh",
  resetDefaults: "Đặt lại mặc định",
  newStandard: "Tiêu chuẩn mới...",
  add: "Thêm",
  cancel: "Hủy",

  screenGeneration: "Tạo màn hình",
  numberOfScreens: "Số lượng màn hình",
  screens: "màn hình",
  generating: "Đang tạo...",
  exportToFigma: (n) => `Xuất ${n} màn hình ra Figma`,
  copyAllPrompts: "Sao chép tất cả Prompt",
  copy: "Sao chép",
  screenGenHint: "Mỗi prompt bao gồm component, token, yêu cầu BA và danh sách tiêu chuẩn. Dùng \"Sao chép\" để dán vào Claude/Cursor, hoặc \"Xuất ra Figma\" để xem trước.",

  baDocLoaded: "Đã tải",
  baDocEmptyText: "Nhập tài liệu BA để hướng dẫn tạo màn hình. Agent sử dụng yêu cầu kinh doanh để tạo bố cục chính xác.",
  useTemplate: "Dùng mẫu",
  importFile: "Nhập file (.md, .txt)",
  documentTitle: "Tiêu đề tài liệu",
  pasteOrWrite: "Dán hoặc viết tài liệu BA bằng Markdown...",
  saveDocument: "Lưu tài liệu",
  edit: "Sửa",
  reImport: "Nhập lại",
  clear: "Xóa",
  saved: "✓ Đã lưu",
  truncatedPreview: "... (đã cắt ngắn)",
  detectedScreens: "Màn hình phát hiện:",

  catDocumentation: "Tài liệu",
  catGuidelines: "Hướng dẫn thiết kế",
  catTesting: "Sẵn sàng kiểm thử",
  catColor: "Hệ thống màu",
  catAccessibility: "Trợ năng",
  catStates: "Trạng thái tương tác",
  catIcons: "Hệ thống biểu tượng",

  language: "Ngôn ngữ",
};

const translations: Record<Locale, Translations> = { en, vi };
export default translations;
