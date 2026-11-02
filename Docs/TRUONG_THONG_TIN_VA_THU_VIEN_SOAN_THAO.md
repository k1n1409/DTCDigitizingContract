# Trường thông tin và thư viện soạn thảo

## Giao diện mới

- Bên trái dùng chung `DocumentLibraryPanel` với Nhập hợp đồng Word cũ: tìm kiếm, mẫu, tài liệu, thư mục, gắn sao, thùng rác.
- Nút Thư viện ẩn/hiện panel. Tài liệu trắng và Nhập DOCX nằm trên thanh đầu trang.
- Bố cục và Thông tin mở cửa sổ riêng, không chiếm cố định diện tích trang giấy.
- Cụm nội dung soạn nhanh vẫn nằm bên phải, hỗ trợ kéo thả hoặc Chèn tại con trỏ.

## Điền thông tin không cần biết mã kỹ thuật

1. Kéo một cụm hoặc chọn mẫu từ thư viện.
2. Thông tin chưa điền hiện nhãn như “Tên đơn vị · Khách hàng”, không hiện cú pháp mã trên trang giấy.
3. Bấm nhãn, nhập nội dung và chọn Áp dụng. Mọi vị trí có cùng liên kết được cập nhật.
4. Muốn sửa riêng một vị trí: bấm vào nó, chọn Chuyển vị trí này thành văn bản thường. Những vị trí khác vẫn liên kết như cũ. Có thể hoàn tác thao tác chuyển bằng nút Hoàn tác của editor.
5. Các thông tin còn thiếu hiện phía trên trang giấy. Nút Thông tin cho phép xem đầy đủ hoặc lấy thông tin từ danh mục khách hàng/nhân viên/sản phẩm.
6. Xuất Word/PDF chỉ thực hiện khi mọi trường đang dùng đã có giá trị. Chọn Xuất khi còn thiếu sẽ mở thông tin cần bổ sung.

Giá trị được lưu cùng bản tài liệu qua cơ chế tự lưu hiện có; không sửa danh mục khách hàng gốc. Chỉ báo “Đã lưu trên server” xác nhận lưu thành công. Không đóng trang khi còn thay đổi chưa lưu.

## Tương thích và giới hạn

- Mã liên kết vẫn được giữ bên trong dữ liệu lưu/export; thay đổi này chỉ làm giao diện dễ dùng hơn, không cần migration mới.
- Các cụm chèn mới giữ liên kết kể cả khi đã điền trước trong cửa sổ của cụm.
- Văn bản thường đã chèn ở các phiên bản cũ không tự chuyển thành trường liên kết bằng cách dò giá trị, tránh gán nhầm.
- DOCX có mã liên kết hợp lệ sẽ được hiển thị thành nhãn. Hợp đồng cũ không có mã vẫn là văn bản thông thường; dùng module Nhập hợp đồng Word cũ để rà soát theo vị trí.
- Trường tùy chỉnh có cấu hình kỹ thuật trong mục Nâng cao, không yêu cầu người sử dụng thông thường thao tác ở đó.
- Đây vẫn là editor văn bản có cấu trúc, không phải toàn bộ Microsoft Word hay canvas kéo tự do mọi đối tượng.

## Kiểm tra

- Unit test: cụm liên kết giữ mã, trường nằm ở nhiều run định dạng được nhận diện, không thay đổi văn bản xung quanh.
- Trình duyệt với dữ liệu giả: điền một lần cập nhật hai vị trí, tách riêng đúng vị trí, hoàn tác và chèn cụm có nhãn.
