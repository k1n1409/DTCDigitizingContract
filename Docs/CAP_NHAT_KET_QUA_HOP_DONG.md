# Cập nhật kết quả hợp đồng từ danh sách

## Cách sử dụng

1. Đăng nhập Hành chính (AdminOfficer), Kế toán hoặc Manager có quyền `contract.complete`.
2. Vào **Danh sách hợp đồng**. Trên hợp đồng Đã ký/Đã hoàn thành, mở menu cạnh **Chi tiết** → **Cập nhật kết quả hợp đồng**.
3. Modal hiển thị trạng thái quy trình và kết quả xử lý riêng. Từng lựa chọn có lý do được phép/bị chặn từ backend.
4. Chọn kết quả, nhập ghi chú/lý do, bấm **Xác nhận kết quả**, kiểm tra hộp thoại xác nhận lần cuối.
5. Danh sách tự tải lại. Cột Trạng thái ưu tiên hiển thị kết quả đã chốt; rê chuột xem trạng thái quy trình. Bộ lọc Thành công/Thất bại/Dừng gia hạn lấy dữ liệu thật.

Với hợp đồng chưa ký, menu vẫn có dòng giải thích nhưng bị vô hiệu hóa, không cho nhảy qua bước duyệt/ký.

## Quy tắc

| Kết quả | Điều kiện |
| --- | --- |
| Thành công | Hợp đồng Đã ký, version hiện hành đã khóa, chưa chốt kết quả; vượt qua toàn bộ completion gate hiện có: bản ký hợp lệ, nghiệm thu và thanh toán đầy đủ. Dùng lại service hoàn tất, chuyển trạng thái pháp lý sang Completed. |
| Thất bại | Hợp đồng Đã ký, version hiện hành đã khóa, còn đang thực hiện; lý do bắt buộc. Không đổi trạng thái pháp lý và không xóa công nợ/chứng từ. |
| Dừng gia hạn | Hợp đồng Đã ký hoặc Completed, version đã khóa, có ngày hết hạn và đã qua hết ngày đó theo lịch Việt Nam. Lý do bắt buộc; không tự tạo gia hạn. |

- Ngày hết hạn là ngày còn hiệu lực: chỉ đánh dấu dừng gia hạn từ ngày kế tiếp (UTC+7).
- Hợp đồng Completed có thể chuyển kết quả sang Dừng gia hạn sau khi hết hạn; quy trình pháp lý vẫn là Completed.
- Không đổi từ Thất bại/Dừng gia hạn về đang thực hiện hoặc ghi đè kết quả. Không có quyền nhảy qua Nháp/Đàm phán/Duyệt/Ký bằng chức năng này.
- Sale/Marketing/Technical không có quyền cập nhật kết quả; backend cũng kiểm tra quyền, không chỉ ẩn nút.
- Lý do tối đa 1.000 ký tự, bắt buộc cho Thất bại/Dừng gia hạn. Thành công cho phép ghi chú tùy chọn.
- Lưu người cập nhật, UTC, lý do và sự kiện nhật ký. Mọi cập nhật kiểm tra rowversion hợp đồng và version, thực hiện trong transaction Serializable.
- Đây là kết quả quản lý hồ sơ; không tự hủy hiệu lực pháp lý của hợp đồng và không tự xử lý nợ còn lại. Công nợ vẫn được giữ và quản lý theo luồng thanh toán.

## API và dữ liệu

- `GET /api/contracts/{contractId}/outcome`: trạng thái pháp lý, kết quả hiện tại, lý do, actor/thời gian, hai rowversion và các lựa chọn/điều kiện.
- `POST` cùng URL: `currentVersionId`, `contractRowVersion`, `versionRowVersion`, `outcome`, `reason`.
- Outcome: 0 Đang thực hiện; 1 Thành công; 2 Thất bại; 3 Dừng gia hạn. API không cho tự đặt lại 0.
- `GET /api/contracts?outcome=1|2|3` lọc kết quả; bộ lọc status vẫn là trạng thái pháp lý.
- Thêm Outcome, OutcomeReason, OutcomeUpdatedByEmployeeId, OutcomeUpdatedAtUtc vào `tbl_Contract`. Không sửa enum trạng thái duyệt/ký.
- Hợp đồng Completed cũ có Outcome mặc định 0 vẫn được trả về/lọc như Thành công, không tạo lịch sử giả cho dữ liệu cũ.

## Migration

Migration mới: `20261104072452_ContractAdministrativeOutcome`. Chưa chạy vào database tenant của bạn; không cần xóa dữ liệu.

Từ `Source/Backend`, dùng connection đúng database tenant (không phải CentralDatabase):

```powershell
dotnet ef database update --project .\ContractManagement.Infrastructure --startup-project .\ContractManagement.API --context DbDtctechContext --connection "<chuỗi kết nối database tenant>"
```

Restart backend sau migration. Nếu tài khoản đang dùng chưa có permission trong session cũ, đăng xuất/đăng nhập lại.

## Kiểm tra nhanh

- Hợp đồng còn thiếu thanh toán hoặc nghiệm thu: Thành công bị chặn, hiển thị nguyên nhân.
- Hợp đồng đủ điều kiện: xác nhận Thành công; trạng thái Completed và nhật ký được cập nhật.
- Hợp đồng đã ký: nhập lý do, chốt Thất bại; bản ký và các khoản thanh toán không thay đổi.
- Ngày hết hạn hôm nay/tương lai: không dừng gia hạn; ngày hết hạn hôm qua trở về trước: cho phép.
- Mở hai modal, cập nhật ở một modal rồi lưu modal còn lại: token cũ bị từ chối, phải tải lại điều kiện.
- Kiểm tra bộ lọc/sidebar Thành công, Thất bại và Dừng gia hạn sau cập nhật.

## Kiểm chứng mã nguồn

Backend build đạt; 1.289 test đạt, 0 fail, 11 test tích hợp yêu cầu môi trường riêng được skip. Frontend TypeScript đạt; thành phần modal mới không có lỗi ESLint. Model EF khớp migration. Chưa chạy migration hoặc kiểm thử end-to-end trên database tenant local của bạn.
