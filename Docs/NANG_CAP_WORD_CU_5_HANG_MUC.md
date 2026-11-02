# Nâng cấp Word cũ — 5 hạng mục

## 1. Bố cục và vùng sửa an toàn

Mở tài liệu sẽ có phần Khả năng giữ bố cục: số bảng, ô ghép, bảng lồng, ảnh (kể cả ở header/footer), header/footer, ngắt trang và vùng chỉ xem. Đoạn chỉ xem có nền xám; đoạn thay đổi có nền vàng.

Xuất Word/PDF bản rà soát vẫn chỉnh theo vị trí trên gói DOCX gốc, không dựng lại toàn bộ tài liệu. Bảng ghép ô, ảnh và header/footer được giữ; chỉ thay văn bản trong vùng được phép. Chữ dài hơn có thể làm Word dàn trang lại. Editor hiển thị mô phỏng không cam kết giống Word từng pixel; dùng PDF gốc/bản sửa để đối chiếu.

Chuyển sang mẫu editor vẫn chỉ hỗ trợ văn bản và bảng cơ bản. Không cam kết bảo toàn ảnh, chữ ký, bảng phức tạp hoặc toàn bộ ngắt trang của Word trong editor.

## 2. Đối chiếu

- Bấm **Gốc / Bản sửa song song** → đối chiếu chữ, kể cả thay đổi chưa lưu. Chữ bị thay có màu đỏ/gạch, chữ mới màu xanh; có lọc đoạn đã sửa và phân trang 10 đoạn.
- **Khôi phục đoạn gốc** cần xác nhận, đưa các vùng trong đoạn về gốc; vẫn có thể hoàn tác bằng lịch sử editor.
- **Hai bản PDF đã lưu** đặt PDF gốc bên cạnh PDF của revision đang xem. Phải chờ lưu xong trước; hai khung có điều khiển trang/zoom độc lập.

## 3. Nhóm và tiến độ

Trên thanh trạng thái có “Đã rà soát X/Y trường”, tính cả Xác nhận và Bỏ qua. Trong Dữ liệu rà soát, lọc theo Khách hàng / Nhà cung cấp / Hợp đồng / Thanh toán / Chưa phân loại và trạng thái. Có thể đổi nhóm từng trường và bấm thẻ để tới vùng tương ứng.

Không tự suy ra khách hàng hay nhà cung cấp chỉ từ Bên A/B. Khi không đủ ngữ cảnh, người rà soát phải phân nhóm.

## 4. Làm sạch mẫu

1. Rà soát và chờ lưu server.
2. Lưu thành mẫu → đặt tên → tích từng vùng muốn chuyển thành chỗ điền (tối đa 200).
3. Xem thử nội dung mẫu có phân trang. Các vùng chọn hiển thị [Tên trường], không còn giá trị cũ tại vị trí đó.
4. Kiểm tra thông tin riêng còn ở những vùng khác, xác nhận rồi lưu.

Backend lấy đúng revision và kiểm tra hash/ID/vị trí, không thay mọi chuỗi trùng giá trị. Vùng chồng lấn bị chặn. File gốc và lịch sử không thay đổi. Dữ liệu ở vùng không chọn vẫn được giữ; đây không phải tự động ẩn mọi thông tin cá nhân. Giữ nguyên quyền quản lý mẫu hiện có.

API mới: `POST /api/imported-contracts/{id}/template-document`, nhận revision, sourceSha256 và mapping ID trường → mã nội bộ. API trả DOCX dùng cho bộ import editor hiện có. `GET /api/imported-contracts/{id}/original-preview` trả PDF gốc có kiểm tra quyền và cache nội bộ.

## 5. Bảo vệ bản đang sửa

- Mất mạng: tiếp tục sửa, báo chưa lưu, tạm ngừng tự gửi. Có mạng trở lại sẽ thử lưu theo cơ chế row-version hiện có.
- Bản dự phòng được mã hóa AES-GCM trong sessionStorage, tách theo tenant/tài khoản/tài liệu. Tải lại trang rồi mở tài liệu sẽ có lựa chọn xem/khôi phục/bỏ bản dự phòng.
- Chỉ khôi phục tự động khi hash gốc và revision khớp. Nếu server đã có revision khác, chỉ đối chiếu và không tự ghi đè.
- Dự phòng hết hạn sau 24 giờ; xóa khi lưu thành công, đăng xuất/đổi tài khoản hoặc người dùng chủ động bỏ. Không ghi dữ liệu hợp đồng dạng rõ vào localStorage.
- Giới hạn: chỉ trong phiên trình duyệt hiện tại, không bảo đảm còn sau khi đóng tab/trình duyệt hoặc dọn dữ liệu. Khóa nằm trong cùng phiên để hỗ trợ reload; không chống XSS hay người có quyền truy cập phiên trình duyệt. Khi storage đầy/bị chặn sẽ cảnh báo giữ trang mở. Server vẫn là nguồn lưu chính.

## Kiểm tra triển khai

Không cần migration mới. Dừng backend trước khi build/run lại, rồi tải lại frontend.

Checklist kiểm thử: đổi tên công ty → đối chiếu → khôi phục; sửa vùng an toàn trong bảng ghép/lồng → xuất Word/PDF; gán nhóm và kiểm tra tiến độ; chọn một vùng làm chỗ điền nhưng giữ nguyên vùng trùng chữ khác; giả lập mất mạng → sửa → reload/mở lại → xem dự phòng/khôi phục; đăng xuất rồi kiểm tra dự phòng đã xóa.
