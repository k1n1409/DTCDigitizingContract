# Phase 2 — Đọc văn bản và nhận diện dữ liệu theo vị trí

## Phạm vi

Đọc phần thân DOCX và văn bản trong ô bảng. Mỗi đoạn có ID gắn với file nguồn bất biến; trường nhận diện lưu `blockId`, `start`, `length`, `original`, `value`, `label`, `party`, `status`. Khoảng ký tự dùng UTF-16, tương ứng JavaScript và .NET, không phải số trang hay vị trí màn hình.

Mỗi trường chỉ là gợi ý `proposed`. Không tự sửa file gốc, không cập nhật khách hàng hoặc tạo hợp đồng nghiệp vụ.

## Đã bổ sung

- Vị trí bảng có số thứ tự bảng, dòng và ô, phân biệt khi nhiều bảng có giá trị giống nhau.
- Nhận diện nhãn và giá trị cùng đoạn, gồm dấu hai chấm thường hoặc toàn chiều rộng (`:` / `：`).
- Tách các trường cùng đoạn khi có dấu `;` hoặc `|` trước nhãn kế tiếp. Ví dụ: `Điện thoại: 0901234567; Email: legal@example.test` thành hai trường riêng.
- Ô bảng hỗ trợ nhãn ở ô trước và giá trị ở ô kế tiếp, kể cả một ô dấu hai chấm nằm giữa.
- Nhãn hỗ trợ: tên khách hàng/công ty/doanh nghiệp, MST, địa chỉ, điện thoại, fax, email, số/mã hợp đồng, ngày ký/hiệu lực/hết hạn, đại diện, chức vụ/chức danh, giá trị hợp đồng, tài khoản/ngân hàng.
- Ghi nhận ngữ cảnh Bên A/B khi gặp tiêu đề tương ứng; đây vẫn là đề xuất, không tự suy ra bên nào là khách hàng/nhà cung cấp.
- Tối đa 500 gợi ý, mỗi giá trị tối đa 10.000 ký tự. Gợi ý quá dài được bỏ qua; UI cảnh báo khi danh sách chạm giới hạn 500.
- UI hiển thị số đoạn/ô có văn bản, số vùng chỉ xem và số trường đang rà soát.

Không chuẩn hóa/mất số 0 đầu của điện thoại, MST hay số tài khoản. Giữ đúng chuỗi gốc và kiểm tra anchor khi lưu/xuất.

## Giới hạn chủ động

- Nhận diện dựa trên quy tắc, không phải AI/OCR, không đảm bảo nhận ra mọi hợp đồng.
- Nhãn và giá trị ở hai đoạn văn riêng ngoài bảng chưa tự ghép để tránh lấy nhầm nội dung.
- Không suy đoán số tiền, ngày tháng hoặc các chuỗi trông giống email/điện thoại khi không có nhãn hỗ trợ.
- Vùng có trường Word tự động, ảnh, hyperlink, tab/ngắt dòng đặc biệt, content control hoặc tracked changes chỉ xem. Header/footer/ảnh chưa bóc tách tại đây.
- Nhãn phức tạp trong bảng lồng hoặc nhiều đoạn không được gộp chuỗi để đoán nhãn.
- Không tự chạy lại nhận diện trên hồ sơ đã lưu, tránh ghi đè phần rà soát. Để test quy tắc mới, nhập tài liệu thành hồ sơ mới.

## Checklist UAT

1. Restart backend và mở `/contract-import`. Upload DOCX thử mới, không cần placeholder.
2. Đặt `BÊN A` / `BÊN B`, bên dưới có `Tên công ty: ...`, `MST: 0012345678`. Kiểm tra đúng bên và giữ số 0 đầu.
3. Thử dòng `Điện thoại: 0901234567; Email： legal@example.test`. Danh sách phải có hai gợi ý, giá trị không dính nhãn kế tiếp.
4. Thử bảng `MST | : | 0012345678` và bảng khác có cùng dữ liệu. Vị trí phải chỉ rõ Bảng 1/2, dòng/ô và ID đoạn khác nhau.
5. Click tên trường bên phải: đến đúng vùng trong file gốc, không chọn tất cả các chuỗi giống nhau.
6. Thử giá trị chia thành nhiều run do in đậm/đổi font: vẫn nhận diện đúng chuỗi và vị trí.
7. Kiểm tra đoạn không có nhãn và vùng Word đặc biệt: không tự sinh gợi ý sai; vùng không hỗ trợ có trạng thái chỉ xem.
8. Tải file gốc đối chiếu hash: không thay đổi sau khi nhận diện.

## Kiểm thử tự động

Bộ `ImportedContractReviewTests`: **10 test đạt, 0 lỗi**. Bao gồm 3 test Phase 2 mới: đa nhãn/Bên A-B/anchor chính xác; phân biệt vị trí bảng/vùng đặc biệt/giá trị quá dài; giới hạn 500 trường. Các test trước tiếp tục kiểm tra chuỗi trùng, run chia nhỏ và bảo toàn bản gốc.

Phase này không thay đổi schema, **không cần migration mới**. Kiểm thử tự động không thay thế kiểm tra trực quan trên các DOCX thật đã ẩn danh.

Hồi quy toàn bộ backend: **1.231 đạt, 9 bỏ qua, 0 lỗi**. ESLint trang mới đạt. Các test tích hợp SQL Server/LibreOffice bị bỏ qua không được tính là nghiệm thu môi trường thật.
