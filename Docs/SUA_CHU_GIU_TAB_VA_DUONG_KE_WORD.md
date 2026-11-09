# Sửa chữ, giữ Tab và đường kẻ Word

## Thay đổi

- Nhập hợp đồng Word cũ: cho sửa phần chữ của đoạn kèm Tab/đường kẻ/hình vẽ nếu đoạn không chứa trường tự động, hyperlink, tracked changes, content control hoặc ngắt dòng đặc biệt chưa hỗ trợ.
- Soạn thảo: các đoạn này được nhập thành vùng **Chỉ sửa chữ · Giữ Tab, đường kẻ và định dạng Word khi xuất**. Có thể gõ, tìm/thay và hoàn tác; không đổi font/căn lề, thêm bảng hay xuống đoạn bên trong vùng đó.
- Khi xuất chỉ sửa các node chữ, không xóa/tạo lại run, paragraph properties, Tab, Drawing/Picture. Chữ trong textbox lồng không bị gộp vào nội dung của đoạn ngoài.
- Ảnh đơn lẻ và các vùng phức tạp khác vẫn chỉ xem; không mở khóa mọi nội dung Word một cách tự động.

Đây là giữ cấu trúc và định dạng gốc, không cam kết số dòng/số trang bất biến khi đổi chữ dài/ngắn khác nhau. Mặt giấy HTML vẫn là bản hỗ trợ; xem Word/PDF thực tế để xác nhận dàn trang.

## Sử dụng sau khi cập nhật

Không có migration mới cho thay đổi này. Dừng backend, build/run lại, rồi tải lại frontend.

- Word cũ đã nhập: mở lại hồ sơ để backend trả danh sách vùng chỉnh được mới; không cần xóa hồ sơ hay upload lại.
- Tài liệu đã chuyển sang Soạn thảo trước cập nhật vẫn giữ các khối chỉ xem cũ trong phiên bản đã lưu. Nhập lại DOCX hoặc tạo lại mẫu từ Word cũ để có chế độ chỉ sửa chữ mới. Không tự sửa lịch sử cũ.
- File gốc không bị ghi đè.

## Kiểm tra

Test tự động kiểm tra Tab, Drawing/Picture, paragraph properties và run properties không đổi sau khi sửa chữ. Fixture DOCX thực tế do người dùng cung cấp được kiểm tra qua biến `WORD_TEXT_ONLY_FIXTURE`; không sao chép tài liệu riêng tư vào repository.

Thanh công cụ Soạn thảo cũng đã bỏ cuộn ngang. Các nút Bố cục trang, Tạo hợp đồng từ tài liệu này và Tài liệu trắng nằm ở hàng riêng bên dưới; các nút trên tự xuống dòng trên màn hình hẹp.
