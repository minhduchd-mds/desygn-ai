/**
 * Vietnamese (vi) dictionary — the primary locale for Desygn A11y.
 */

import type { Dictionary } from "./types.js";

export const vi: Dictionary = {
  "app.title": "Desygn A11y",
  "app.badge": "Tuần 0",
  "app.tagline":
    "Khả năng truy cập dưới dạng dịch vụ — Phát hiện vi phạm WCAG ngay trong Figma trước khi chúng khiến bạn mất 50.000 đô la tiền kiện tụng.",
  "card.title": "Chạy lần kiểm tra đầu tiên",
  "card.body":
    "Dán liên kết tệp Figma và chúng tôi sẽ đối chiếu với WCAG 2.2 AA.",
  "button.startAudit": "Bắt đầu kiểm tra",
  "button.viewSample": "Xem báo cáo mẫu",
  "status.line": "Trạng thái: đã dựng khung + kết nối hệ thống thiết kế.",
  "lang.toggleLabel": "Ngôn ngữ",
  "lang.vi": "Tiếng Việt",
  "lang.en": "Tiếng Anh",

  // Điều hướng (thanh bên)
  "nav.dashboard": "Bảng điều khiển",
  "nav.audits": "Lần kiểm tra",
  "nav.settings": "Cài đặt",
  "nav.primaryLabel": "Điều hướng chính",

  // Thanh trên cùng / khung ứng dụng
  "shell.brand": "Desygn A11y",
  "shell.signOut": "Đăng xuất",
  "shell.userMenuLabel": "Tài khoản",

  // Xác thực — dùng chung
  "auth.emailLabel": "Email",
  "auth.emailPlaceholder": "ban@vidu.com",
  "auth.passwordLabel": "Mật khẩu",
  "auth.passwordPlaceholder": "Nhập mật khẩu của bạn",
  "auth.backendUnconfiguredTitle": "Chưa cấu hình máy chủ",
  "auth.backendUnconfiguredBody":
    "Xác thực chưa khả dụng vì chưa thiết lập Supabase. Hãy đặt VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY rồi tải lại.",
  "auth.backendUnconfiguredCta": "Đăng nhập (đã tắt)",
  "auth.genericError": "Đã xảy ra lỗi. Vui lòng thử lại.",

  // Xác thực — đăng nhập
  "auth.login.title": "Đăng nhập",
  "auth.login.submit": "Đăng nhập",
  "auth.login.submitting": "Đang đăng nhập…",
  "auth.login.toSignupPrompt": "Chưa có tài khoản?",
  "auth.login.toSignupLink": "Đăng ký",

  // Xác thực — đăng ký
  "auth.signup.title": "Tạo tài khoản",
  "auth.signup.submit": "Đăng ký",
  "auth.signup.submitting": "Đang tạo tài khoản…",
  "auth.signup.success":
    "Đã tạo tài khoản. Hãy kiểm tra email để xác nhận đăng nhập.",
  "auth.signup.toLoginPrompt": "Đã có tài khoản?",
  "auth.signup.toLoginLink": "Đăng nhập",

  // Trang lần kiểm tra (tạm thời)
  "audits.title": "Lần kiểm tra",
  "audits.body": "Các lần kiểm tra khả năng truy cập của bạn sẽ hiển thị ở đây.",
  "audits.cta": "Bắt đầu kiểm tra mới",

  // Trang cài đặt (tạm thời)
  "settings.title": "Cài đặt",
  "settings.body": "Quản lý tùy chọn không gian làm việc của bạn.",
  "settings.languageHeading": "Ngôn ngữ",

  // Tính năng kiểm tra — đồng hồ điểm
  "audit.gauge.label": "Điểm khả năng truy cập: {score} trên 100",

  // Tính năng kiểm tra — mức độ nghiêm trọng
  "audit.severity.critical": "Nghiêm trọng",
  "audit.severity.serious": "Nặng",
  "audit.severity.moderate": "Trung bình",
  "audit.severity.minor": "Nhẹ",

  // Tính năng kiểm tra — danh sách vấn đề
  "audit.issues.heading": "Vấn đề",
  "audit.issues.empty": "Không tìm thấy vấn đề nào. Tuyệt vời!",
  "audit.issues.wcag": "Tiêu chí WCAG",
  "audit.issues.node": "Đối tượng",

  // Tính năng kiểm tra — biểu mẫu bắt đầu
  "audit.form.title": "Kiểm tra mới",
  "audit.form.urlLabel": "Liên kết tệp Figma",
  "audit.form.urlPlaceholder": "https://www.figma.com/design/…",
  "audit.form.tokenLabel": "Mã truy cập Figma",
  "audit.form.tokenPlaceholder": "figd_…",
  "audit.form.versionLabel": "Phiên bản WCAG",
  "audit.form.levelLabel": "Mức WCAG",
  "audit.form.submit": "Bắt đầu kiểm tra",
  "audit.form.submitting": "Đang kiểm tra…",
  "audit.form.invalidUrl": "Hãy nhập một liên kết tệp Figma hợp lệ.",
  "audit.form.requestFailed":
    "Không thể bắt đầu kiểm tra. Vui lòng kiểm tra kết nối rồi thử lại.",
  "audit.form.successHeading": "Hoàn tất kiểm tra",
  "audit.form.scoreLabel": "Điểm",
  "audit.form.issuesLabel": "Tổng số vấn đề",

  // Tính năng kiểm tra — danh sách/bảng
  "audit.list.heading": "Các lần kiểm tra gần đây",
  "audit.list.colScore": "Điểm",
  "audit.list.colSource": "Nguồn",
  "audit.list.colIssues": "Vấn đề",
  "audit.list.colDate": "Ngày",
  "audit.list.empty": "Chưa có lần kiểm tra nào.",
  "audit.list.emptyHint": "Bắt đầu lần kiểm tra đầu tiên để thấy kết quả ở đây.",
};
