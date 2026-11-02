# Phase 1 — Tiếp nhận và bảo toàn hợp đồng Word cũ

## Phạm vi nghiệm thu

Upload một DOCX, lưu file nguồn bất biến trong database tenant, mở lại danh sách của tài khoản và tải đúng file gốc. Chưa nghiệm thu nhận diện trường, sửa nội dung, khôi phục phiên bản hoặc xuất PDF trong phase này.

Không tạo hợp đồng nghiệp vụ, không sửa danh mục khách hàng và không yêu cầu tài liệu có placeholder.

## Đã triển khai

- Chọn file hoặc kéo thả DOCX, một file mỗi lần, tối đa 10 MB.
- Backend kiểm tra file rỗng, đuôi file, cấu trúc DOCX và các giới hạn an toàn; không chỉ tin phần mở rộng.
- Lưu byte gốc, tên file, SHA-256, người nhập, tenant và thời điểm UTC. Các thao tác chỉnh sửa sau này không ghi đè byte gốc.
- Danh sách có tìm tên, phân trang 10 hồ sơ; chỉ lấy metadata, không trả nội dung file trong danh sách.
- Hiển thị dung lượng và thời gian nhập theo múi giờ trình duyệt; hiển thị hash khi mở hồ sơ.
- Kiểm tra hash trước khi tải file gốc. Tenant hoặc tài khoản khác không được mở/tải hồ sơ.
- Quyền truy cập hiện dùng quyền tạo hợp đồng. Manager không tự động xem file riêng do nhân viên khác nhập.

## Chuẩn bị database

Migration cần có: `20261028034427_ImportedContractReview`, context `DbDtctechContext`, áp vào **database tenant**, không phải central/master.

Chưa chạy migration lên database thật trong đợt này. Kiểm tra danh sách migration đang chờ và sao lưu trước khi dùng lệnh `database update`, vì các migration cũ từ main có thể thay đổi/xóa bảng nghiệp vụ khác. Không cần xóa dữ liệu test để triển khai Phase 1.

## Checklist kiểm tra trên app

1. Đăng nhập tài khoản có quyền tạo hợp đồng; mở **Hợp đồng → Nhập hợp đồng Word cũ** (`/contract-import`).
2. Upload một DOCX thật đã ẩn danh, dưới 10 MB: phải mở được hồ sơ và hiện tên, dung lượng, ngày nhập, SHA-256.
3. Chọn **Tải file gốc**: mở được trong Word và đối chiếu hash với file trước upload. Trong PowerShell dùng `Get-FileHash -Algorithm SHA256 -LiteralPath 'đường dẫn file'`.
4. Refresh/truy cập lại, chọn **Hồ sơ đã nhập**: file vẫn có trong danh sách. Thử tìm theo tên.
5. Nhập trên 10 hồ sơ để kiểm tra trang trước/sau.
6. Thử PDF, DOCX rỗng/hỏng hoặc quá 10 MB: phải có thông báo từ chối, không tạo hồ sơ rác.
7. Đăng nhập tài khoản khác cùng tenant và tài khoản tenant khác: danh sách không chứa hồ sơ trên; gọi trực tiếp ID cũ không được tải file.

Đợt này dùng test tự động EF InMemory; checklist SQL Server và trình duyệt ở trên vẫn cần kiểm thử tại môi trường local sau migration. File có cùng tên được phép nhập nhiều lần thành các hồ sơ riêng.

## Kết quả kiểm tra code

- Bộ test `ImportedContractReviewTests`: **7 đạt, 0 lỗi**, bao gồm 2 test tập trung Phase 1.
- ESLint trang `/contract-import`: đạt.
- Chưa chạy migration, seed hay thay đổi dữ liệu database thật.

## Tiêu chí chuyển Phase 2

Các bước 1–7 đạt trên môi trường local. Sau đó nghiệm thu riêng phần đọc đoạn/ô bảng và liên kết vị trí dữ liệu; không coi nhận diện gợi ý là dữ liệu chính xác khi chưa được người dùng xác nhận.
