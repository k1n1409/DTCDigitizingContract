# Tối ưu preview tài liệu

## Nút thắt xác định từ source

Thư viện dựng ảnh trang đầu bằng PDF.js, nhưng trước đó backend phải tạo cả PDF qua LibreOffice. Bộ chuyển đổi có hàng đợi tuần tự; nhiều thumbnail có thể làm preview đang mở phải chờ. Trước thay đổi này chỉ có cache byte PDF ở trình duyệt, không gộp yêu cầu đang chạy và không có cache PDF server theo revision.

## Thay đổi

- Cache PDF thành công trong RAM server tối đa 64 MiB, hết hạn sau 10 phút. Khóa gồm tenant, nhân viên, loại, ID và revision. Luôn kiểm tra quyền truy cập trước khi đọc cache; tài liệu đã xóa mềm không thể xem dù PDF còn cache.
- Khóa chuyển đổi theo nhóm cố định, kiểm tra cache lần nữa sau khi chờ: yêu cầu trùng revision không chuyển đổi lại. Lỗi không được cache.
- Frontend gộp yêu cầu cùng tài liệu/revision, giới hạn hai yêu cầu mạng đồng thời, ưu tiên preview đang mở hơn thumbnail đang chờ.
- Hủy một consumer không hủy yêu cầu mà consumer khác còn dùng; hủy request nền khi không còn ai chờ.
- Giữ cache byte PDF 32 MiB; thêm cache tối đa 16 ảnh thumbnail để không mở lại PDF.js mỗi lần thư viện remount. Cache frontend tách theo tài khoản/tenant và không ghi localStorage.
- Revision mới dùng khóa mới, không trả nhầm preview cũ. HTTP vẫn `no-store`; đây là cache nội bộ có giới hạn, không phải cache công khai trên trình duyệt/proxy.

## Triển khai và kiểm tra

Không cần migration. Dừng API trước khi build, rồi chạy lại backend và tải lại frontend.

Kiểm thử gồm: reuse cùng revision, revision mới render lại, chặn tài khoản/tenant khác và tài liệu đã xóa mềm; chuyển PDF thật bằng LibreOffice; frontend gộp request, cancel độc lập, ưu tiên preview và cache không dùng chung tài khoản.

Lần đầu xem một revision hoặc sau khi server restart/cache hết hạn vẫn cần LibreOffice. Đây chưa phải cơ chế pre-generate nền hay lưu PDF lâu dài. Chưa đo benchmark end-to-end trên tài liệu thực của người dùng nên không cam kết số giây hoặc tỷ lệ tăng tốc cụ thể. Luồng xuất/tải file độc lập ngoài API preview thư viện không được thay đổi trong đợt tối ưu này.
