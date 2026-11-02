# Phân biệt Sếp và quản lý cấp dưới

Không thêm role mới hoặc đổi EmployeeType trong database:

| Mã hiện có | Tên hiển thị | Duyệt hợp đồng | Ký | Khách hàng và mẫu |
| --- | --- | --- | --- | --- |
| Manager = 6 | Sếp | Phê duyệt cuối | Có | Giữ toàn bộ quyền hiện có |
| AdminOfficer = 3 | Quản lý / Hành chính | Duyệt bước quản lý, trả về sửa hoặc chuyển Sếp | Không | Có quyền thêm/quản lý khách hàng và mẫu |

Luồng duyệt hai cấp hiện tại được giữ nguyên: AdminOfficer duyệt bước quản lý → Manager phê duyệt cuối. Không chuyển quyền phê duyệt cuối cho AdminOfficer và không thay đổi các quy tắc tránh tự duyệt đang có.

Các nghiệp vụ khác của AdminOfficer được giữ nguyên; việc giới hạn ở đây là không ký hợp đồng, không phải chỉ được mở duy nhất trang phê duyệt. Marketing vẫn ngang Sale. Kế toán giữ các quyền quản trị nghiệp vụ hiện có, không ký và không được duyệt bước quản lý như AdminOfficer. Nghiệm thu chưa thay đổi.

Phiên bản permission contract tăng lên rbac-v4. Sau khi cập nhật: dừng backend trước khi build/run lại, tải lại frontend và đăng xuất/đăng nhập lại để nhận bộ quyền mới. Không cần migration và không cần sửa dữ liệu tài khoản.

Kiểm thử gồm mapping đầy đủ từng role, AdminOfficer vẫn thêm khách hàng/quản lý mẫu/duyệt cấp dưới nhưng bị chặn ký ở resource authorization, Sếp vẫn có quyền ký và phê duyệt cuối.
