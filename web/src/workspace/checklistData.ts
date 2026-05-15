/**
 * Checklist UI/UX Data — VTS · ANT Design · Material 3 · WCAG 2.1
 * Source: Viettel Solutions UX_01-05, Ant Design specs, M3 guidelines, WCAG 2.1 SC
 */

export type DesignSource = "vts" | "ant" | "m3" | "wcag";
export type CriteriaTag = "req" | "opt";
export type ChecklistStatus = "pass" | "fail" | "warn" | "untested";

export interface ChecklistRow {
  id: string;
  source: DesignSource;
  category: string;
  component: string;
  section: string;
  criterion: string;
  expected: string;
  note: string;
  tag: CriteriaTag;
  type: "UI" | "UX";
  status: ChecklistStatus;
  score: number;
}

export const DESIGN_SOURCES: { id: DesignSource; label: string; color: string; count: number }[] = [
  { id: "vts", label: "VTS Viettel", color: "#e53935", count: 89 },
  { id: "ant", label: "Ant Design", color: "#1677ff", count: 51 },
  { id: "m3", label: "Material 3", color: "#7c4dff", count: 59 },
  { id: "wcag", label: "WCAG 2.1", color: "#00897b", count: 12 },
];

export const CHECKLIST_CATEGORIES = [
  "All",
  "Foundation_Color",
  "Foundation_Typography",
  "Foundation_Icons",
  "Foundation_Image",
  "Element_Button",
  "Element_Text field",
  "Element_Label",
  "Element_Checkbox",
  "Element_Radio",
  "Element_Switch",
  "Element_Date picker",
  "Element_Search",
  "Element_Upload",
  "Element_Data display",
  "Element_Chart",
  "Element_Nav",
  "Element_Toast",
  "Element_Tooltips",
  "Element_Link",
  "Pattern_Modal",
  "Pattern_Form",
  "Pattern_Page",
  "Pattern_Card",
  "Pattern_Content",
  "Color",
  "Typography",
  "Spacing",
  "Layout",
  "Component",
  "Interaction",
  "Accessibility",
];

// ════════════════════════════════════════
// VTS — Viettel Solutions (UX_01 → UX_05)
// ════════════════════════════════════════

const VTS_ROWS: Omit<ChecklistRow, "status" | "score">[] = [
  // UX_01 — Nhìn thấy (Visibility)
  { id: "vts-01", source: "vts", category: "Foundation_Color", component: "Foundation_Color", section: "UX_01 Nhìn thấy", criterion: "Text lớn (>=24px regular / >=18px bold)", expected: "Contrast >= 3:1", note: "Tool: coolors.co/contrast-checker", tag: "req", type: "UI" },
  { id: "vts-02", source: "vts", category: "Foundation_Color", component: "Foundation_Color", section: "UX_01 Nhìn thấy", criterion: "Text nhỏ (<24px regular)", expected: "Contrast >= 4.5:1", note: "Tool: color.adobe.com", tag: "req", type: "UI" },
  { id: "vts-03", source: "vts", category: "Foundation_Color", component: "Foundation_Color", section: "UX_01 Nhìn thấy", criterion: "Non-text elements (icon, border input, checkbox...)", expected: "Contrast >= 3:1", note: "Element enable, identify role", tag: "req", type: "UI" },
  { id: "vts-04", source: "vts", category: "Foundation_Typography", component: "Foundation_Typography", section: "UX_01 Nhìn thấy", criterion: "Hien thi ky tu / font", expected: "Khong loi font, khong de, khong sat nhau", note: "", tag: "req", type: "UI" },
  { id: "vts-05", source: "vts", category: "Foundation_Typography", component: "Foundation_Typography", section: "UX_01 Nhìn thấy", criterion: "Font size text quan trong / doan van ban", expected: ">= 14px (min 12px desktop, 10px mobile)", note: "Label hep co the nho hon nhung khong <12px", tag: "req", type: "UI" },
  { id: "vts-06", source: "vts", category: "Foundation_Image", component: "Foundation_Image", section: "UX_01 Nhìn thấy", criterion: "Ma Captcha", expected: "Nhan dien duoc trong 3-5 giay", note: "Toc do doc ~3 tu/giay", tag: "opt", type: "UX" },
  { id: "vts-07", source: "vts", category: "Foundation_Image", component: "Foundation_Image", section: "UX_01 Nhìn thấy", criterion: "Icon / launcher / symbol / favicon / minh hoa", expected: "Ro, sac net, khong cat, khong meo, khong nhoe", note: "", tag: "opt", type: "UI" },
  { id: "vts-08", source: "vts", category: "Element_Button", component: "Element_Button", section: "UX_01 Nhìn thấy", criterion: "Hien thi button", expected: "Label hien thi day du, khong bi cat", note: "", tag: "req", type: "UI" },
  { id: "vts-09", source: "vts", category: "Element_Nav", component: "Element_Nav (Mobile)", section: "UX_01 Nhìn thấy", criterion: "Bottom navigation — hien thi text", expected: "Text mo ta ngan gon, day du, khong bi cat/de", note: "", tag: "opt", type: "UI" },
  { id: "vts-10", source: "vts", category: "Element_Text field", component: "Element_Text field", section: "UX_01 Nhìn thấy", criterion: "Truong mat khau", expected: "Co toggle an/hien du lieu", note: "", tag: "req", type: "UX" },
  { id: "vts-11", source: "vts", category: "Element_Text field", component: "Element_Text field", section: "UX_01 Nhìn thấy", criterion: "Truong Read-only (chi xem)", expected: "Text dat contrast AA (4.5:1 nho / 3:1 lon)", note: "", tag: "opt", type: "UI" },
  { id: "vts-12", source: "vts", category: "Element_Label", component: "Element_Label", section: "UX_01 Nhìn thấy", criterion: "Label data entry", expected: "Luon hien thi ke ca khi da dien du lieu", note: "", tag: "req", type: "UX" },
  { id: "vts-13", source: "vts", category: "Element_Chart", component: "Element_Chart", section: "UX_01 Nhìn thấy", criterion: "Label/text tren chart", expected: "Khong bi de len nhau, khong gan sat", note: "", tag: "req", type: "UI" },
  { id: "vts-14", source: "vts", category: "Element_Chart", component: "Element_Chart_Area", section: "UX_01 Nhìn thấy", criterion: "Bieu do mien (Area chart)", expected: "Cac vung (area) khong bi overlap", note: "", tag: "opt", type: "UI" },
  { id: "vts-15", source: "vts", category: "Element_Chart", component: "Element_Chart_Pie", section: "UX_01 Nhìn thấy", criterion: "Mau phan khuc bieu do tron (Pie/Donut)", expected: "Phan biet ro, khong dung mau cung hue", note: "", tag: "req", type: "UI" },
  { id: "vts-16", source: "vts", category: "Element_Toast", component: "Element_Toast", section: "UX_01 Nhìn thấy", criterion: "Thoi gian hien thi toast", expected: "~5 giay (toc do doc 3 tu/giay)", note: "", tag: "req", type: "UX" },
  { id: "vts-17", source: "vts", category: "Pattern_Modal", component: "Pattern_Modal", section: "UX_01 Nhìn thấy", criterion: "Hien thi modal / dialog", expected: "Co mau nen toi (mask) phan biet voi noi dung cha", note: "", tag: "req", type: "UI" },
  { id: "vts-18", source: "vts", category: "Pattern_Modal", component: "Pattern_Non-modal", section: "UX_01 Nhìn thấy", criterion: "Hien thi Non-modal (popover)", expected: "Co shadow / border phan biet voi noi dung cha", note: "", tag: "opt", type: "UI" },

  // UX_02 — Hieu duoc (Understandability)
  { id: "vts-19", source: "vts", category: "Element_Button", component: "Element_Button", section: "UX_02 Hieu duoc", criterion: "Label button", expected: "Dong tu hanh dong truc tiep", note: "Khong dung: Co/Khong/OK/Submit/Xac nhan", tag: "req", type: "UX" },
  { id: "vts-20", source: "vts", category: "Element_Button", component: "Element_Button", section: "UX_02 Hieu duoc", criterion: "Icon button — hover", expected: "Tooltip xuat hien tuc thi; noi dung la dong tu hanh dong", note: "", tag: "req", type: "UX" },
  { id: "vts-21", source: "vts", category: "Element_Button", component: "Element_Button", section: "UX_02 Hieu duoc", criterion: "Button hanh dong chinh / quan trong", expected: "Luon hien thi label (khong chi icon)", note: "", tag: "req", type: "UX" },
  { id: "vts-22", source: "vts", category: "Element_Nav", component: "Element_Nav (Mobile)", section: "UX_02 Hieu duoc", criterion: "Bottom navigation — icon + text", expected: "Co text mo ta duoi icon (khong chi icon)", note: "Chi ap dung app nghiep vu", tag: "opt", type: "UX" },
  { id: "vts-23", source: "vts", category: "Element_Checkbox", component: "Element_Checkbox", section: "UX_02 Hieu duoc", criterion: "Nhom checkbox", expected: "Co label mo ta nhom", note: "", tag: "req", type: "UX" },
  { id: "vts-24", source: "vts", category: "Element_Radio", component: "Element_Radio", section: "UX_02 Hieu duoc", criterion: "Nhom radio button", expected: "Co label mo ta nhom", note: "", tag: "req", type: "UX" },
  { id: "vts-25", source: "vts", category: "Element_Switch", component: "Element_Switch", section: "UX_02 Hieu duoc", criterion: "Label switch", expected: "Cau truc: Dong tu + Doi tuong", note: "", tag: "req", type: "UX" },
  { id: "vts-26", source: "vts", category: "Element_Date picker", component: "Element_Date picker", section: "UX_02 Hieu duoc", criterion: "Truong nhap date", expected: "Co thong tin dinh dang hop le (dd/mm/yyyy)", note: "", tag: "req", type: "UX" },
  { id: "vts-27", source: "vts", category: "Element_Search", component: "Element_Search", section: "UX_02 Hieu duoc", criterion: "Truong search", expected: "Co placeholder chi dan noi dung co the search", note: "", tag: "opt", type: "UX" },
  { id: "vts-28", source: "vts", category: "Element_Upload", component: "Element_Upload", section: "UX_02 Hieu duoc", criterion: "Truong upload", expected: "Co thong tin dinh dang va kich co file cho phep", note: "", tag: "opt", type: "UX" },
  { id: "vts-29", source: "vts", category: "Element_Data display", component: "Element_Data display", section: "UX_02 Hieu duoc", criterion: "Bang (table)", expected: "Co title mo ta bang", note: "", tag: "req", type: "UX" },
  { id: "vts-30", source: "vts", category: "Element_Data display", component: "Element_Data format", section: "UX_02 Hieu duoc", criterion: "Du lieu dang so dem / tien te", expected: "Co thong tin don vi tinh", note: "", tag: "req", type: "UX" },
  { id: "vts-31", source: "vts", category: "Element_Chart", component: "Element_Chart", section: "UX_02 Hieu duoc", criterion: "Bieu do (chart)", expected: "Co title mo ta chart", note: "", tag: "req", type: "UX" },
  { id: "vts-32", source: "vts", category: "Pattern_Page", component: "Pattern_Page", section: "UX_02 Hieu duoc", criterion: "Trang (page)", expected: "Co title mo ta trang", note: "", tag: "req", type: "UX" },
  { id: "vts-33", source: "vts", category: "Pattern_Card", component: "Pattern_Card", section: "UX_02 Hieu duoc", criterion: "The (card)", expected: "Co title mo ta the", note: "", tag: "req", type: "UX" },
  { id: "vts-34", source: "vts", category: "Pattern_Form", component: "Pattern_Form", section: "UX_02 Hieu duoc", criterion: "Form", expected: "Co title mo ta form ro rang va cu the", note: "", tag: "req", type: "UX" },
  { id: "vts-35", source: "vts", category: "Pattern_Form", component: "Pattern_Form", section: "UX_02 Hieu duoc", criterion: "Truong input/file", expected: "Co label (la danh tu, mo ta dung thong tin)", note: "Placeholder khong duoc coi la label", tag: "req", type: "UX" },

  // UX_03 — Tim thay / Dieu huong (Findability)
  { id: "vts-36", source: "vts", category: "Element_Button", component: "Element_Button", section: "UX_03 Tim thay", criterion: "Vi tri button", expected: "Gan nhat noi dung ma no lien quan", note: "", tag: "opt", type: "UX" },
  { id: "vts-37", source: "vts", category: "Element_Nav", component: "Element_Nav", section: "UX_03 Tim thay", criterion: "Menu side/top nav — cap bac", expected: "Khong qua 3 cap bac", note: "", tag: "opt", type: "UX" },
  { id: "vts-38", source: "vts", category: "Element_Date picker", component: "Element_Date picker", section: "UX_03 Tim thay", criterion: "Date picker — ngay dau tuan", expected: "Ngay dau tuan la Thu 2 (tieng Viet)", note: "", tag: "req", type: "UX" },
  { id: "vts-39", source: "vts", category: "Element_Data display", component: "Element_Table", section: "UX_03 Tim thay", criterion: "Button action moi row (ngoai tru checkbox, switch)", expected: "Cuoi row / sau thong tin quan trong nhat", note: "", tag: "req", type: "UX" },
  { id: "vts-40", source: "vts", category: "Pattern_Form", component: "Pattern_Form", section: "UX_03 Tim thay", criterion: "Vi tri label / title", expected: "Gan nhat thong tin ma no dai dien", note: "", tag: "req", type: "UX" },
  { id: "vts-41", source: "vts", category: "Pattern_Form", component: "Pattern_Form", section: "UX_03 Tim thay", criterion: "Trinh tu form", expected: "Theo chieu doc: trai->phai, tren->duoi", note: "", tag: "req", type: "UX" },

  // UX_04 — Noi dung ro rang (Content Clarity)
  { id: "vts-42", source: "vts", category: "Element_Label", component: "Element_Label", section: "UX_04 Noi dung", criterion: "Noi dung label", expected: "Ngan gon, la 1 cum danh tu hoac dong tu", note: "", tag: "req", type: "UX" },
  { id: "vts-43", source: "vts", category: "Foundation_Icons", component: "Foundation_Icons", section: "UX_04 Noi dung", criterion: "Icon giong nhau", expected: "The hien y nghia giong nhau", note: "", tag: "req", type: "UI" },
  { id: "vts-44", source: "vts", category: "Foundation_Icons", component: "Foundation_Icons", section: "UX_04 Noi dung", criterion: "Button cung y nghia", expected: "Neu co icon -> icon phai giong nhau", note: "", tag: "req", type: "UI" },
  { id: "vts-45", source: "vts", category: "Pattern_Content", component: "Pattern_Content", section: "UX_04 Noi dung", criterion: "Chinh ta", expected: "Khong co loi chinh ta", note: "", tag: "req", type: "UX" },
  { id: "vts-46", source: "vts", category: "Pattern_Content", component: "Pattern_Content", section: "UX_04 Noi dung", criterion: "Viet hoa", expected: "Chi viet hoa chu dau; khong viet hoa toan bo", note: "", tag: "req", type: "UX" },
];

// ════════════════════════════════════════
// ANT Design — Enterprise B2B
// ════════════════════════════════════════

const ANT_ROWS: Omit<ChecklistRow, "status" | "score">[] = [
  { id: "ant-01", source: "ant", category: "Color", component: "Color", section: "Colors & Typography", criterion: "Primary color", expected: "#1677ff (mac dinh); override qua design token", note: "", tag: "req", type: "UI" },
  { id: "ant-02", source: "ant", category: "Color", component: "Color", section: "Colors & Typography", criterion: "Semantic colors", expected: "Success #52c41a / Warning #faad14 / Error #ff4d4f / Info #1677ff", note: "", tag: "req", type: "UI" },
  { id: "ant-03", source: "ant", category: "Color", component: "Color", section: "Colors & Typography", criterion: "Dark mode support", expected: "CSS variables / token-based; khong hardcode mau", note: "", tag: "req", type: "UI" },
  { id: "ant-04", source: "ant", category: "Typography", component: "Typography", section: "Colors & Typography", criterion: "Base font size & line-height", expected: "14px min / line-height 1.5715", note: "", tag: "req", type: "UI" },
  { id: "ant-05", source: "ant", category: "Typography", component: "Typography", section: "Colors & Typography", criterion: "Heading scale", expected: "h1:38 / h2:30 / h3:24 / h4:20 / h5:16 px", note: "", tag: "req", type: "UI" },
  { id: "ant-06", source: "ant", category: "Spacing", component: "Spacing", section: "Spacing & Layout", criterion: "Base spacing unit", expected: "4px", note: "", tag: "req", type: "UI" },
  { id: "ant-07", source: "ant", category: "Layout", component: "Layout", section: "Spacing & Layout", criterion: "Grid system", expected: "24 columns / gutter 24px", note: "", tag: "req", type: "UI" },
  { id: "ant-08", source: "ant", category: "Layout", component: "Layout", section: "Spacing & Layout", criterion: "Breakpoints", expected: "xs:480 / sm:576 / md:768 / lg:992 / xl:1200 / xxl:1600", note: "", tag: "req", type: "UI" },
  { id: "ant-09", source: "ant", category: "Component", component: "Button", section: "Components", criterion: "5 type day du", expected: "primary / default / dashed / text / link", note: "", tag: "req", type: "UI" },
  { id: "ant-10", source: "ant", category: "Component", component: "Button", section: "Components", criterion: "Disabled state", expected: "opacity 0.25 + cursor: not-allowed", note: "", tag: "req", type: "UI" },
  { id: "ant-11", source: "ant", category: "Component", component: "Button", section: "Components", criterion: "Loading state", expected: "Spinner ben trai label; khong block toan bo UI", note: "", tag: "req", type: "UX" },
  { id: "ant-12", source: "ant", category: "Component", component: "Form", section: "Components", criterion: "Validate timing", expected: "onChange hoac onBlur (khong chi onSubmit)", note: "", tag: "req", type: "UX" },
  { id: "ant-13", source: "ant", category: "Component", component: "Form", section: "Components", criterion: "Error message", expected: "Mau do, ben duoi field (khong dung tooltip)", note: "", tag: "req", type: "UX" },
  { id: "ant-14", source: "ant", category: "Component", component: "Form", section: "Components", criterion: "Required marker", expected: "Dau * do ben trai label (khong ben phai)", note: "", tag: "req", type: "UI" },
  { id: "ant-15", source: "ant", category: "Component", component: "Table", section: "Components", criterion: "Sticky header", expected: "position: sticky khi scroll doc", note: "", tag: "req", type: "UX" },
  { id: "ant-16", source: "ant", category: "Component", component: "Table", section: "Components", criterion: "Empty state", expected: "Icon + text mo ta (khong de trang)", note: "", tag: "req", type: "UX" },
  { id: "ant-17", source: "ant", category: "Component", component: "Table", section: "Components", criterion: "Loading state", expected: "Skeleton loader (khong spinner toan trang)", note: "", tag: "req", type: "UX" },
  { id: "ant-18", source: "ant", category: "Component", component: "Modal", section: "Components", criterion: "Footer button order", expected: "OK ben phai, Cancel ben trai; nhat quan", note: "", tag: "req", type: "UX" },
  { id: "ant-19", source: "ant", category: "Interaction", component: "Hover", section: "Interaction & States", criterion: "Tat ca clickable elements", expected: "cursor: pointer + visual feedback", note: "", tag: "req", type: "UX" },
  { id: "ant-20", source: "ant", category: "Interaction", component: "Focus", section: "Interaction & States", criterion: "Tab navigation", expected: "Focus ring luon visible", note: "", tag: "req", type: "UX" },
  { id: "ant-21", source: "ant", category: "Interaction", component: "Loading", section: "Interaction & States", criterion: "API call > 300ms", expected: "Skeleton hoac Spinner hien; khong tra trang", note: "", tag: "req", type: "UX" },
  { id: "ant-22", source: "ant", category: "Interaction", component: "Empty", section: "Interaction & States", criterion: "Danh sach rong", expected: "Empty state co icon + text", note: "", tag: "req", type: "UX" },
  { id: "ant-23", source: "ant", category: "Interaction", component: "Error", section: "Interaction & States", criterion: "API loi", expected: "Hien thi error state + action retry", note: "", tag: "req", type: "UX" },
];

// ════════════════════════════════════════
// Material Design 3
// ════════════════════════════════════════

const M3_ROWS: Omit<ChecklistRow, "status" | "score">[] = [
  { id: "m3-01", source: "m3", category: "Color", component: "Color", section: "Dynamic Color", criterion: "Color roles: Primary / Secondary / Tertiary / Error", expected: "4 mau chinh + on-colors tuong ung", note: "", tag: "req", type: "UI" },
  { id: "m3-02", source: "m3", category: "Color", component: "Color", section: "Dynamic Color", criterion: "Surface tones", expected: "5 muc elevation: surface-1 -> surface-5", note: "", tag: "req", type: "UI" },
  { id: "m3-03", source: "m3", category: "Color", component: "Color", section: "Dynamic Color", criterion: "Dark mode", expected: "Tat ca mau co dark variant day du", note: "", tag: "req", type: "UI" },
  { id: "m3-04", source: "m3", category: "Color", component: "Color", section: "Dynamic Color", criterion: "Contrast ratio text", expected: ">= 4.5:1 (AA) / >= 7:1 (AAA preferred)", note: "", tag: "req", type: "UI" },
  { id: "m3-05", source: "m3", category: "Component", component: "Button", section: "Components M3", criterion: "5 variants day du", expected: "Filled / Outlined / Elevated / Tonal / Text", note: "", tag: "req", type: "UI" },
  { id: "m3-06", source: "m3", category: "Component", component: "Button", section: "Components M3", criterion: "Chieu cao toi thieu", expected: "40dp (mobile)", note: "", tag: "req", type: "UI" },
  { id: "m3-07", source: "m3", category: "Component", component: "Button", section: "Components M3", criterion: "Corner radius", expected: "100px (fully rounded M3 style)", note: "", tag: "req", type: "UI" },
  { id: "m3-08", source: "m3", category: "Component", component: "Text field", section: "Components M3", criterion: "Variant nhat quan", expected: "Chi dung Outlined HOAC Filled trong mot app", note: "", tag: "req", type: "UI" },
  { id: "m3-09", source: "m3", category: "Component", component: "Text field", section: "Components M3", criterion: "Floating label", expected: "Float len khi focus hoac co noi dung", note: "", tag: "req", type: "UX" },
  { id: "m3-10", source: "m3", category: "Component", component: "Navigation bar", section: "Components M3", criterion: "So luong items", expected: "3-5 items (khong it hon 3, khong nhieu hon 5)", note: "", tag: "req", type: "UX" },
  { id: "m3-11", source: "m3", category: "Component", component: "Dialog", section: "Components M3", criterion: "Hanh dong destructive", expected: "Chi 1 hanh dong destructive; dat ben phai", note: "", tag: "req", type: "UX" },
  { id: "m3-12", source: "m3", category: "Component", component: "Snackbar", section: "Components M3", criterion: "Duration", expected: "4-10 giay", note: "", tag: "req", type: "UX" },
  { id: "m3-13", source: "m3", category: "Interaction", component: "Motion", section: "Motion M3", criterion: "Easing curve", expected: "Emphasized: cubic-bezier(0.2, 0, 0, 1)", note: "", tag: "req", type: "UX" },
  { id: "m3-14", source: "m3", category: "Interaction", component: "Touch", section: "Motion M3", criterion: "Touch feedback", expected: "Ripple effect; touch target >= 48dp", note: "", tag: "req", type: "UX" },
];

// ════════════════════════════════════════
// WCAG 2.1 — Accessibility
// ════════════════════════════════════════

const WCAG_ROWS: Omit<ChecklistRow, "status" | "score">[] = [
  { id: "wcag-111", source: "wcag", category: "Accessibility", component: "Alt text", section: "WCAG 2.1", criterion: "Tat ca hinh anh phi trang tri", expected: "Co alt text mo ta day du noi dung", note: "SC 1.1.1 Level A", tag: "req", type: "UX" },
  { id: "wcag-131", source: "wcag", category: "Accessibility", component: "Semantic HTML", section: "WCAG 2.1", criterion: "Cau truc thong tin va quan he", expected: "Dung h1-h6, nav, main, footer, section, article dung nghia", note: "SC 1.3.1 Level A", tag: "req", type: "UI" },
  { id: "wcag-141", source: "wcag", category: "Accessibility", component: "Color only", section: "WCAG 2.1", criterion: "Mau khong phai cach duy nhat truyen thong tin", expected: "Luon kem icon, text, pattern khi dung mau", note: "SC 1.4.1 Level A", tag: "req", type: "UI" },
  { id: "wcag-143", source: "wcag", category: "Accessibility", component: "Contrast text", section: "WCAG 2.1", criterion: "Do tuong phan text", expected: ">= 4.5:1 (text nho) / >= 3:1 (text lon >=24px)", note: "SC 1.4.3 Level AA", tag: "req", type: "UI" },
  { id: "wcag-1411", source: "wcag", category: "Accessibility", component: "Non-text", section: "WCAG 2.1", criterion: "Do tuong phan UI components", expected: ">= 3:1 (border input, icon, checkbox, radio, focus)", note: "SC 1.4.11 Level AA", tag: "req", type: "UI" },
  { id: "wcag-211", source: "wcag", category: "Accessibility", component: "Keyboard", section: "WCAG 2.1", criterion: "Moi chuc nang dung duoc bang ban phim", expected: "Khong chuc nang nao chi thao tac duoc bang chuot/touch", note: "SC 2.1.1 Level A", tag: "req", type: "UX" },
  { id: "wcag-243", source: "wcag", category: "Accessibility", component: "Focus Order", section: "WCAG 2.1", criterion: "Thu tu focus", expected: "Tab order hop ly, nhat quan voi visual layout", note: "SC 2.4.3 Level A", tag: "req", type: "UX" },
  { id: "wcag-247", source: "wcag", category: "Accessibility", component: "Focus Visible", section: "WCAG 2.1", criterion: "Focus indicator luon nhin thay", expected: "Khong dung outline:0 ma khong co focus style thay the", note: "SC 2.4.7 Level AA", tag: "req", type: "UX" },
  { id: "wcag-322", source: "wcag", category: "Accessibility", component: "On Input", section: "WCAG 2.1", criterion: "Thay doi context khi input", expected: "Phai co warning/confirm truoc khi thay doi context tu dong", note: "SC 3.2.2 Level A", tag: "req", type: "UX" },
  { id: "wcag-331", source: "wcag", category: "Accessibility", component: "Error ID", section: "WCAG 2.1", criterion: "Mo ta loi ro rang", expected: "Error message mo ta cu the loi gi", note: "SC 3.3.1 Level A", tag: "req", type: "UX" },
  { id: "wcag-332", source: "wcag", category: "Accessibility", component: "Labels", section: "WCAG 2.1", criterion: "Label hoac huong dan cho input", expected: "Moi input co label hoac instructions ro rang", note: "SC 3.3.2 Level A", tag: "req", type: "UX" },
  { id: "wcag-412", source: "wcag", category: "Accessibility", component: "ARIA", section: "WCAG 2.1", criterion: "Name, Role, Value", expected: "ARIA attributes day du cho interactive elements", note: "SC 4.1.2 Level A", tag: "req", type: "UX" },
];

function withDefaults(rows: Omit<ChecklistRow, "status" | "score">[]): ChecklistRow[] {
  return rows.map(r => ({ ...r, status: "untested" as ChecklistStatus, score: 0 }));
}

export const DEFAULT_CHECKLIST_ROWS: ChecklistRow[] = [
  ...withDefaults(VTS_ROWS),
  ...withDefaults(ANT_ROWS),
  ...withDefaults(M3_ROWS),
  ...withDefaults(WCAG_ROWS),
];

export const PROJECT_PRESETS: { label: string; desc: string; sources: DesignSource[] }[] = [
  { label: "Enterprise B2B / Admin", desc: "Ant Design (chinh) + VTS UX_01-05 + WCAG AA", sources: ["ant", "vts", "wcag"] },
  { label: "Mobile App / Flutter", desc: "Material 3 (chinh) + WCAG AA bat buoc", sources: ["m3", "wcag"] },
  { label: "Chinh phu / Viettel", desc: "VTS (chinh) + WCAG AA bat buoc theo quy dinh", sources: ["vts", "wcag"] },
  { label: "SaaS / Da nen tang", desc: "ANT + WCAG + M3 (neu co native mobile)", sources: ["ant", "wcag", "m3"] },
  { label: "E-commerce / Retail", desc: "M3 + ANT + VTS UX_01-04 cho content", sources: ["m3", "ant", "vts"] },
  { label: "Analytics / BI", desc: "ANT Design + VTS UX chart criteria", sources: ["ant", "vts"] },
];
