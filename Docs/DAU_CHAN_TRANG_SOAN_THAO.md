# Đầu trang/chân trang cho tài liệu soạn mới

Phần logo và thông tin lặp lại là **header/footer** (đầu trang/chân trang).

## Hành vi hiện tại

- Tài liệu Soạn thảo không có nguồn Word gốc: mặc định có logo DTC, tên công ty, website, email ở đầu trang và số trang tự động ở chân trang. Có trên cả trang đầu, không chỉ từ trang thứ hai.
- Xem thử, thumbnail thư viện, xuất Word và xuất PDF đều dùng cùng bộ dựng DOCX. Nút **Xem thử PDF** lưu bản mới nhất rồi xem PDF thực tế; không dùng bản HTML đơn giản để mô phỏng bản xuất nữa.
- DOCX nhập vào có `preservation`: giữ nguyên header/footer và quy tắc trang đầu/trang chẵn/lẻ của nguồn, không chèn logo DTC đè lên tài liệu của bên khác. Mặt giấy đang gõ chỉ hỗ trợ chỉnh sửa phần thân; xem thử PDF mới là bản dàn trang cuối cùng.
- Bản Word cũ và hợp đồng nghiệp vụ dựng từ template Published vẫn theo header/footer trong Word nguồn, không bị thay đổi bởi mặc định này.

Không cần migration mới. Dừng backend, build/run lại và tải lại frontend để bỏ cache preview cũ.

## Khoảng trống an toàn

Tài liệu soạn mới có đầu/chân trang cần lề trên ít nhất **20 mm**, lề dưới ít nhất **12 mm**. Form Bố cục trang và API xuất đều kiểm tra điều kiện này để không chồng logo/thông tin lên phần thân. DOCX nguồn vẫn giữ thiết lập riêng của nó.

## Cấu hình backend

Có thể cấu hình section `ContractEditorStationery` trong appsettings của môi trường triển khai:

```json
{
  "ContractEditorStationery": {
    "Enabled": true,
    "CompanyName": "CÔNG TY TNHH CÔNG NGHỆ ỨNG DỤNG VÀ TRUYỀN THÔNG DTC",
    "Website": "www.dtctech.vn",
    "Email": "info@dtctech.vn",
    "LogoPath": "Assets/Email/logo_light.png"
  }
}
```

Logo dùng PNG, được nhúng vào DOCX, không phụ thuộc tài nguyên web bên ngoài. Tệp logo mặc định đã được khai báo copy khi build/publish. Nếu thiếu logo trong lúc bật đầu trang, API báo lỗi thay vì xuất thiếu logo âm thầm.

Đây là nhận diện mặc định cấu hình ở cấp triển khai, không phải dữ liệu khách hàng hoặc dữ liệu đọc tự động từ hồ sơ pháp lý tenant. Triển khai cho thương hiệu khác cần cấu hình lại; không thay đổi thông tin tenant trên database trong lần nâng cấp này.

## Kiểm tra

- Test xác nhận đồng thời có HeaderReference và FooterReference trong section; không để API OpenXML ghi đè một tham chiếu khi thêm tham chiếu còn lại.
- Kiểm tra Word có ảnh trong header, tên công ty, website/email và field PAGE trong footer.
- Fixture LibreOffice hai trang đã được render và kiểm tra: mỗi trang có logo, thông tin liên hệ, số trang; không chồng với nội dung.
