# Soạn hợp đồng nhanh bằng cụm nội dung

## Phạm vi đợt này

- Trang nhập Word cũ: nút Upload DOCX nằm giữa vùng trống khi chưa mở hồ sơ; khi có hồ sơ, nút trên thanh đầu vẫn dùng để nhập tài liệu khác.
- Trang `/contract-editor`: panel bên phải chứa 7 cụm sẵn để điền/chèn/kéo thả.
- Bổ sung phông Times New Roman/Arial/Calibri, cỡ chữ 8–36 pt trong danh sách, gạch ngang, xóa định dạng chữ và căn đều hai bên. Các công cụ đậm/nghiêng/gạch chân, căn trái/giữa/phải, bảng, hoàn tác/làm lại/toàn màn hình vẫn giữ.
- Font/gạch ngang/căn đều được lưu trong rich text và giữ khi xuất Word/PDF. Không thêm schema database trong đợt này.

## Dùng cụm soạn nhanh

1. Mở Soạn thảo hợp đồng. Panel bên phải có quốc hiệu/tên hợp đồng, Bên A, Bên B, phạm vi công việc, giá trị/thanh toán, điều khoản tùy chỉnh và chữ ký hai bên.
2. Bấm **Điền thông tin** trên một cụm. Nếu đã liên kết khách hàng trong tab Dữ liệu, các trường có cùng mã sẽ lấy giá trị hiện có làm gợi ý; kiểm tra lại trước khi chèn.
3. Điền dữ liệu và bấm **Chèn tại con trỏ**. Hoặc đóng form rồi kéo thẻ cụm vào vị trí cần chèn trong nội dung.
4. Có thể bấm **Chèn** ngay nếu muốn chèn khung trước. Trường trống tạo placeholder để bổ sung sau qua tab Dữ liệu hoặc sửa trực tiếp văn bản.
5. Chỉnh nội dung đã chèn như văn bản thông thường. Dùng Hoàn tác/Làm lại nếu chèn nhầm.

Dữ liệu đã điền trong form được chèn thành văn bản trực tiếp, không tự đổi theo danh mục sau đó và không ghi đè dữ liệu khách hàng. Giá trị còn trong form nhưng chưa chèn chỉ nằm trong phiên làm việc của panel. Mở tài liệu khác sẽ làm mới form.

Khi chèn cụm có bảng vào bên trong bảng hiện tại, editor đặt cụm sau bảng để tránh bảng lồng không được schema hỗ trợ. Với mobile/bàn phím, dùng Chèn thay cho kéo thả.

Cụm Bên A/B là khung tham khảo. Người dùng phải kiểm tra đúng vai trò các bên, điều khoản, số thứ tự điều và nội dung pháp lý trước khi phát hành. Khung chữ ký không thực hiện ký điện tử.

## Định dạng

- Bôi đen chữ rồi chọn Đậm/Nghiêng/Gạch chân/Gạch ngang, phông và cỡ chữ.
- Chọn đoạn hoặc nhiều đoạn để căn trái/giữa/phải/đều hai bên.
- Xóa định dạng chữ chỉ bỏ mark chữ ở vùng chọn, không xóa văn bản hoặc tự đặt lại căn đoạn.
- Cỡ chữ/font giữ qua lưu server và xuất Word/PDF. Phông phải có trên máy/backend để LibreOffice tránh thay thế bằng font khác.
- Dùng Bản PDF thực tế để kiểm tra bố cục bản xuất; không lấy màn hình editor làm cam kết bố cục Word tuyệt đối.

## Chưa phải bộ Word đầy đủ

Chưa thêm track changes, comment kiểu Word, mục lục tự động, section/header/footer, cấu hình lề trang tùy ý, ngắt trang thủ công, đánh số danh sách tự động hoặc hình ảnh nổi/wrap text. Căn đoạn không đồng nghĩa điều chỉnh lề trang. Những chức năng này cần mở rộng schema, renderer và bộ test riêng; không có nút giả để tránh mất định dạng khi xuất.

## Kiểm tra

- 7 test frontend đạt (cụm/định dạng và các helper chỉnh Word cũ).
- Hồi quy backend: **1.240 đạt, 9 bỏ qua, 0 lỗi**, có test font/gạch ngang/căn đều qua xuất/nhập Word.
- Đã thử trên trình duyệt bằng tài liệu giả lập: điền/chèn, kéo thả, hoàn tác/làm lại, Arial và căn đều. Trang kiểm thử tạm đã gỡ.
- Cần UAT thêm trên tài liệu nghiệp vụ thật đã ẩn danh; đợt này không áp migration hoặc sửa database thật.
