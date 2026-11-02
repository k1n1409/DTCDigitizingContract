# eContract — Bắt đầu nhanh cho tester

Đối chiếu source ngày **23/10/2026**. [Mở hướng dẫn đầy đủ](HUONG_DAN_SU_DUNG_VA_KIEM_THU.md).

## Trước khi bắt đầu

- Xin **địa chỉ test, mã công ty, tài khoản, vai trò và bộ dữ liệu test**.
- Đăng nhập bằng tên tài khoản; không mặc định tên đăng nhập là email.
- Có yêu cầu đổi mật khẩu thì đổi trước. Sau đăng nhập, trang đầu là Hợp đồng.
- Chỉ thao tác trong tenant test đã thống nhất. Không xóa database để xử lý lỗi giao diện hoặc migration.

## Ai làm việc gì?

| Việc cần làm | Vai trò phù hợp |
| --- | --- |
| Tạo/quản lý mẫu hợp đồng và danh mục | Manager hoặc Admin Officer |
| Quản lý nhân viên, phòng ban, hồ sơ pháp lý | Manager |
| Chuẩn bị khách hàng, tạo báo giá/hợp đồng test | Sale hoặc Manager |
| Duyệt hoặc yêu cầu sửa hợp đồng | Manager khác người gửi duyệt |
| Ký, bàn giao, nghiệm thu | Technical hoặc Manager có quyền trên hợp đồng |
| Thanh toán | Accountant hoặc Manager có quyền trên hợp đồng |
| Hoàn tất hợp đồng | Manager sau khi đủ checklist |
| Xem/feedback bằng OTP | Khách hàng qua link, nên dùng cửa sổ ẩn danh |

## Luồng test chính

1. Chuẩn bị khách hàng, sản phẩm, hồ sơ pháp lý; phát hành mẫu phù hợp.
2. Tạo hợp đồng qua bốn bước: **Đối tác & Mẫu → Sản phẩm → Điều khoản → Xem trước**.
3. Kiểm tra Nháp, mã hợp đồng và PDF. Bắt đầu đàm phán.
4. Lưu thay đổi; tạo link/OTP để test khách hàng xem và phản hồi nếu kịch bản yêu cầu.
5. Khi cần vòng mới: lưu trước, nhập lý do và **Tạo vòng mới** trong tab Vòng đàm phán.
6. Gửi duyệt. Manager khác người gửi mở yêu cầu, kiểm tra phiên bản/tài liệu rồi duyệt hoặc yêu cầu sửa lại.
7. Khi **Đã duyệt, đang chờ ký**, tải tài liệu, ký hai bên, nhập ngày ký thực tế và tải bản quét hợp lệ vào tab Ký hợp đồng.
8. Trong Đóng hợp đồng: bàn giao đủ → nghiệm thu đủ → thanh toán đủ theo các điều kiện trên form.
9. Mỗi biên bản cần đi qua **nháp → chốt → tải bản ký hợp lệ**; chỉ chốt chưa được tính là đã ký.
10. Manager kiểm tra checklist, xử lý hết blocker và hoàn tất hợp đồng.

## Các câu hỏi thường gặp

| Câu hỏi | Trả lời nhanh |
| --- | --- |
| Sao không thấy menu/nút? | Kiểm tra role, người phụ trách, quyền tài nguyên và trạng thái. Tải lại sau đổi quyền |
| Tạo xong là đã gửi duyệt chưa? | Chưa. Hợp đồng mới là Nháp; phải bắt đầu đàm phán và gửi duyệt |
| Mẫu đâu, sao không chọn được? | Mẫu cần phiên bản Published khả dụng và đúng điều kiện chiều/loại/ngôn ngữ |
| Sửa mẫu Published ở đâu? | Tạo phiên bản nháp mới; không sửa trực tiếp bản đã phát hành |
| Sao không lưu được nội dung? | Xem cảnh báo chưa đủ dữ liệu, phiên bản khóa hoặc dữ liệu đã bị người khác cập nhật |
| Sao không nhận SMS? | OTP có thể gửi email hoặc dùng Fake trên môi trường test; xác nhận kênh và cấu hình với người vận hành |
| Sao link cũ/OTP cũ không dùng được? | Link/phiên có thể hết hạn, đã bị thay hoặc thu hồi |
| Sao không có nút Từ chối khi duyệt? | Luồng hiện chỉ có Duyệt hợp đồng và Yêu cầu sửa lại |
| Sao Manager không tự duyệt được? | Không cho người gửi duyệt chính yêu cầu của mình |
| Có file scan trong Chứng từ rồi, sao chưa Đã ký? | Phải tải qua luồng Ký hợp đồng, đúng phiên bản đã duyệt |
| Chốt biên bản rồi sao chưa tăng tiến độ? | Còn bước tải/xác nhận bản ký hợp lệ và ngày ký |
| Sao chưa đóng được hợp đồng? | Đọc checklist bản ký, bàn giao, nghiệm thu, thanh toán và hồ sơ nháp/chờ ký còn tồn |
| Dừng gia hạn/Thất bại sao không có dữ liệu? | Hai mục giao diện chờ bổ sung nghiệp vụ, chưa có dữ liệu riêng |
| Báo giá sửa/duyệt ở đâu? | Bản hiện tại mới nối danh sách, tạo, chi tiết và xóa Draft |
| Lỗi hashdocx/thiếu cột database/LibreOffice làm gì? | Gửi developer/người vận hành; không sửa hash hay xóa dữ liệu để bỏ qua |

## Khi báo lỗi, gửi đủ một lần

**URL + thời điểm + tenant + role + mã hồ sơ/phiên bản + trạng thái trước thao tác + các bước tái hiện + kết quả mong đợi/thực tế + ảnh/video + response lỗi nếu có.**

Che mật khẩu, OTP, token/cookie, connection string và link khách hàng. Giữ lại hồ sơ lỗi để developer kiểm tra.

Giới hạn file cần nhớ: chứng từ đính kèm **10 MB**; bản quét ký hợp đồng/biên bản theo form **20 MB**. Luôn đọc lại loại file và dung lượng ngay tại màn hình đang test.
