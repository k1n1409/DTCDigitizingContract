# Bên B từ hồ sơ pháp lý công ty

- Soạn thảo hợp đồng có nút **Liên kết dữ liệu thật** riêng ngay phía trên vùng trang giấy. Nút mở cửa sổ chọn nguồn độc lập, không nằm trong Xem tất cả và không bị khuất trong thanh công cụ cuộn ngang. Các ô chọn nguồn hiện ngay, không cần mở thêm mục thu gọn.
- Trong cụm **Bên B · Hồ sơ pháp lý công ty**, Chèn/kéo thả sẽ lấy giá trị hồ sơ công ty hiện tại cho các trường còn trống. Không hard-code tên hay thông tin DTC; tenant khác dùng hồ sơ của tenant đó.
- Block gồm tên pháp nhân, người đại diện, chức vụ, địa chỉ, mã số thuế, điện thoại; Fax/tài khoản/ngân hàng chỉ chèn nếu có dữ liệu hoặc người dùng điền thêm.
- Với Bên B đã có trên tài liệu, bấm **Dùng hồ sơ pháp lý** để chủ động áp dụng các giá trị mới. Nút này cập nhật những trường PROVIDER đang liên kết trong tài liệu, không thêm block trùng và không sửa hồ sơ nguồn.
- Cũng có thể dùng **Liên kết dữ liệu thật → Lấy hồ sơ pháp lý công ty cho Bên B**. Các trường thiếu phải kiểm tra/điền bổ sung. Hồ sơ pháp lý hiện chưa có trường email; email trong block cũ không được tự bịa hoặc lấy từ tài khoản nhân viên.
- Giá trị là snapshot lưu cùng tài liệu. Hồ sơ nguồn thay đổi không tự làm thay đổi các tài liệu đã lưu; cần chủ động lấy lại dữ liệu.

Tái sử dụng API `GET /api/contract-editor-drafts/binding-values?source=provider&id=1`, được giới hạn bởi quyền tạo tài liệu và database tenant đã xác thực. Không mở quyền quản lý/sửa hồ sơ pháp lý cho người dùng chỉ cần soạn hợp đồng.

Không cần migration mới. Restart backend và tải lại frontend để nhận thay đổi.
