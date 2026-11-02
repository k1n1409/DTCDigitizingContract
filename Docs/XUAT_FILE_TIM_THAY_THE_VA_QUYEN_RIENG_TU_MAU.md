# Xuất file, tìm–thay thế và quyền riêng tư mẫu

## 1. Cập nhật database trước khi chạy

Migration tenant mới: `20261102034314_EditorTemplatePrivacy`.

Chạy từ `Source/Backend`, dùng chuỗi kết nối của **tenant đang sử dụng**, không phải database Central:

```powershell
dotnet ef database update --project .\ContractManagement.Infrastructure --startup-project .\ContractManagement.API --context DbDtctechContext --connection "<chuỗi kết nối tenant của bạn>"
```

Sau đó build/restart backend và frontend. Không cần xóa dữ liệu cũ. Migration giữ nguyên phạm vi dùng chung của các mẫu đã tồn tại; mẫu mới trên giao diện mặc định là cá nhân.

## 2. Xuất đúng bản đang sửa

- Soạn thảo mới: khi bấm Word/Xuất PDF, hệ thống lưu nội dung trước, rồi tải đúng `id + revision` vừa lưu qua API `GET /api/document-library/{kind}/{id}/export/{format}?revision=...`.
- Word cũ: nếu còn thay đổi chưa lưu, thao tác xuất sẽ lưu trước rồi lấy phiên bản trả về từ server. Lưu lỗi/xung đột thì dừng xuất, không tự tải bản cũ.
- Các trường gợi ý chưa xác nhận trong Word cũ vẫn giữ giá trị gốc; màn hình xác nhận trước khi xuất nhắc rõ điều này.
- File gốc luôn là file nhập ban đầu. Xuất bản lịch sử lấy đúng revision đang xem.
- Bảng ghép ngang/dọc, tỉ lệ cột, căn lề đoạn, font hỗ trợ và dấu tiếng Việt được kiểm tra bằng DOCX round-trip/OpenXML và PDF thật qua LibreOffice.
- Trình soạn thảo có nút **Ngắt trang**: bật/tắt ngắt trang trước đoạn đang chọn. Dấu phân cách nét đứt chỉ là gợi ý khi sửa; bản Word/PDF thực hiện ngắt trang thật.

### Giới hạn cần biết

- Vùng soạn trực tiếp không phải bộ máy dàn trang của Word. Dùng **Bản PDF thực tế** để kiểm tra phân trang cuối cùng.
- Soạn thảo mới hỗ trợ Times New Roman, Arial, Calibri; máy chạy LibreOffice cần có font tương ứng. Không tự cài/font thay thế cho mọi tài liệu.
- Chuyển DOCX cũ sang editor vẫn có giới hạn với ảnh, header/footer, trường Word tự động, bảng lồng và lề trang tùy chỉnh; giao diện có cảnh báo. Ngắt trang trước đoạn được giữ, nhưng ngắt trang đặc biệt giữa run không phải mọi trường hợp đều được chuyển nguyên vẹn.
- Chỉnh trực tiếp trong module Word cũ giữ package gốc và chỉ vá các vùng xác nhận, do đó các thành phần không chỉnh vẫn được giữ trong bản xuất.

## 3. Tìm và thay thế

1. Mở **Tìm & thay thế** ở phía trên văn bản.
2. Nhập nội dung tìm; có thể bật **Phân biệt hoa/thường**.
3. Dùng mũi tên lên/xuống hoặc Enter/Shift+Enter để chuyển kết quả.
4. Nhập nội dung thay thế; để trống nếu muốn xóa.
5. Chọn **Thay vị trí này** hoặc **Thay tất cả**.
6. Dùng nút Hoàn tác/Ctrl+Z để khôi phục; thay tất cả là một bước hoàn tác. Làm lại bằng Ctrl+Shift+Z hoặc nút Làm lại.

Tìm theo chuỗi literal (ký tự như `[]`, `+`, `$` không có nghĩa regex). Trong editor, tìm xuyên qua các run định dạng nhưng không xuyên trường liên kết, ô bảng hoặc đoạn khác. Sửa giá trị liên kết bằng cách bấm nhãn màu xanh. Word cũ chỉ tìm/thay đoạn và ô được phép chỉnh, không sửa ảnh/header/footer/vùng chỉ đọc.

## 4. Mẫu cá nhân và mẫu dùng chung

- **Mẫu cá nhân**: chỉ chủ tài khoản trong tenant đó được đọc, xem PDF, dùng, sửa, xóa/khôi phục.
- **Mẫu dùng chung**: người có quyền soạn thảo trong tenant được dùng; việc tạo/sửa/xóa vẫn yêu cầu quyền quản lý mẫu.
- Phạm vi được bảo vệ ở backend cho danh sách, đọc, lịch sử, metadata, preview, xuất file và thùng rác, không chỉ ẩn nút trên frontend.
- Thư viện ghi rõ loại mẫu; người có quyền sửa có nút **Sửa nội dung mẫu**.
- Không đổi trực tiếp phạm vi mẫu đã lưu. Muốn chia sẻ mẫu cá nhân, mở mẫu rồi **Lưu thành mẫu mới → Mẫu dùng chung** để kiểm tra dữ liệu lại.

### Trước khi lưu mẫu

Kiểm tra tên khách hàng/người đại diện, email, số điện thoại, địa chỉ, mã số thuế và tài khoản ngân hàng. Giá trị liên kết được xóa khi tạo mẫu trong editor; ở Word cũ chỉ vùng được chọn mới thành chỗ điền. **Dữ liệu gõ trực tiếp hoặc vùng không chọn vẫn còn nguyên.** Hệ thống không cam kết tự loại bỏ toàn bộ dữ liệu riêng.

Giao diện yêu cầu tick xác nhận đã kiểm tra; đổi phạm vi hoặc đổi vùng chọn cần xác nhận lại. Mẫu cá nhân cũng cần rà soát để tránh chia sẻ nhầm sau này.

## 5. Checklist kiểm thử thủ công

- Sửa văn bản rồi xuất ngay; đối chiếu giá trị mới trong Word/PDF và revision trả về.
- Ngắt mạng hoặc tạo xung đột phiên bản rồi xuất: phải báo lỗi, không có bản tải cũ thay thế.
- Tìm từ tiếng Việt, từ có dấu `[]`, từ tách qua chữ đậm; thay một/thay tất cả/xóa; hoàn tác và làm lại.
- Tìm gần trường liên kết hoặc qua hai ô bảng: không thay nhầm trường hay ghép hai ô.
- Dùng bảng ghép ngang/dọc, độ rộng khác nhau, căn giữa/phải/đều, tiếng Việt và ngắt trang; xem PDF thật.
- Lưu mẫu cá nhân bằng tài khoản A; tài khoản B cùng tenant không được thấy/đọc/xuất/sửa/xóa.
- Lưu mẫu dùng chung với tài khoản có quyền; tài khoản khác cùng tenant được dùng, tenant khác không được truy cập.
