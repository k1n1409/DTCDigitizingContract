# Giữ bố cục DOCX khi soạn thảo

## Cập nhật trước khi sử dụng

Migration tenant: `20261102090713_EditorDocxLayoutPreservation`.

Từ `Source/Backend`, chạy trên từng tenant đang dùng:

```powershell
dotnet ef database update --project .\ContractManagement.Infrastructure --startup-project .\ContractManagement.API --context DbDtctechContext --connection "<chuỗi kết nối tenant>"
```

Không chạy vào Central. Không cần xóa dữ liệu. Build/restart backend và frontend sau khi migrate.

**Tài liệu đã nhập trước nâng cấp cần nhập lại DOCX gốc.** JSON cũ không chứa ảnh/header/footer đã bị bỏ trước đây nên không tự phục hồi được. Với Word cũ, dùng lại “Lưu thành mẫu” từ phiên bản đã rà soát sau khi nâng cấp để đi qua luồng mới.

## Cơ chế mới

1. Nhập DOCX: lưu một bản gốc bất biến trong `tbl_ContractEditorSourceAsset`, theo tenant/tài khoản và SHA-256.
2. Editor chỉ lưu tham chiếu nguồn và liên kết từng khối/đoạn. Không nhét toàn bộ DOCX vào mỗi lần tự lưu.
3. Đoạn văn và bảng thông thường vẫn chỉnh trực tiếp. Sửa chữ giữ các thuộc tính Word không được biểu diễn hết trong editor: giãn dòng, kiểu đoạn, đường viền bảng và các thuộc tính sẵn có.
4. Ảnh/hình vẽ, bảng lồng, trường Word phức tạp và các vùng không hỗ trợ được biểu diễn bằng khối nét đứt chỉ xem. Có thể di chuyển, nhân đôi hoặc xóa cả khối; không sửa chữ bên trong trực tiếp.
5. Khi xuất, mở bản sao gói Word gốc và áp dụng thay đổi. Các part ảnh, header/footer, styles/theme/numbering cùng lề/khổ/hướng trang được giữ, thay vì dựng lại cả file theo A4 mặc định.
6. Bảng mới sử dụng chiều rộng trang của tài liệu nguồn. Nếu thay hẳn cấu trúc bảng, phần ô mới được dựng theo cấu trúc mới; không cam kết giữ mọi kiểu trang trí riêng của các ô bị tách/gộp.

## Cách dùng

- Nhập DOCX vào Soạn thảo, hoặc chuyển bản rà soát Word cũ thành mẫu.
- Sửa các đoạn/ô được phép. Khối nét đứt có nhãn cho biết nội dung gốc đang được giữ.
- Ảnh PNG/JPEG nhỏ có thumbnail; ảnh lớn hoặc thành phần khác hiện khối thông báo. Không có thumbnail không có nghĩa ảnh bị xóa.
- Điền thông tin liên kết như trước. Placeholder trong header/footer và khối gốc cũng được kiểm tra/điền khi xuất.
- Dùng **Bản PDF thực tế/Xem Word/Xem PDF** để kiểm tra dàn trang cuối cùng.
- Tự lưu, mở lại, hoàn tác và sắp xếp khối đều giữ tham chiếu tới nguồn. Server từ chối lưu nếu một phiên bản làm mất hoặc đổi nguồn gốc của tài liệu đã lưu.

## Mẫu và quyền riêng tư

- Tạo mẫu từ tài liệu có nguồn gốc sẽ tạo **nguồn riêng từ bản Word đã chỉnh**, không cấp quyền đọc lại toàn bộ Word gốc riêng tư.
- Ảnh không còn được dùng sẽ được loại khỏi bản xuất, không chỉ ẩn khỏi trang. Khi tạo mẫu mới, comment Word và một số thông tin tác giả/custom properties cũng được dọn.
- Bản gốc ban đầu và lịch sử vẫn giữ riêng cho chủ tài khoản. Mẫu cá nhân/dùng chung vẫn tuân theo phân quyền đã có.
- Đây không phải công cụ tự ẩn danh toàn bộ dữ liệu. Vẫn cần kiểm tra thông tin riêng trong ảnh, header/footer, ghi chú và các thành phần phức tạp trước khi chia sẻ mẫu.

## Giới hạn cần biết

- Editor không phải Word đầy đủ: không chỉnh trực tiếp ảnh, header/footer, bảng lồng, SmartArt hoặc đối tượng phức tạp. Giữ nguyên không đồng nghĩa chỉnh được mọi thành phần.
- Mặt giấy HTML vẫn là bản hỗ trợ soạn thảo; số trang/bố cục cuối cần xem PDF. Máy chuyển PDF cần có các font tương ứng; LibreOffice và Microsoft Word có thể dàn trang khác nhau.
- DOCX tối đa 10 MB; giới hạn giải nén 40 MB, 3.000 đoạn và 500 khối editor. Nội dung editor sau chuyển tối đa 4 MB. File macro, đối tượng nhúng/tài nguyên ngoài không an toàn hoặc file hỏng vẫn bị từ chối.
- Chỉnh sửa tài liệu không duy trì hiệu lực chữ ký số của bản gốc; ảnh chữ ký chỉ được giữ như ảnh, không thay thế quy trình ký/phê duyệt.

## Checklist nghiệm thu

1. File có logo/ảnh, header/footer, bảng lồng và khổ ngang với lề tùy chỉnh.
2. Sửa chữ thường và chữ trong ô bảng; thêm đoạn trong ô; lưu rồi mở lại.
3. Xuất DOCX/PDF: so sánh header/footer, ảnh, lề trang, giãn dòng, đường viền và nội dung sửa.
4. Di chuyển/nhân đôi/xóa khối gốc; kiểm tra đúng khối xuất ra; hoàn tác phải khôi phục.
5. Lưu thành mẫu sau khi xóa ảnh: nguồn của mẫu khác nguồn riêng tư ban đầu; ảnh đã xóa không còn trong media của DOCX mẫu.
6. Tài khoản/tenant khác không đọc hoặc gắn nguồn riêng tư; tài khoản được dùng mẫu chung có thể tạo bản riêng từ nguồn đã làm sạch của mẫu.
7. Kiểm tra nguồn sai SHA-256 và yêu cầu làm mất nguồn phải bị từ chối, không xuất nhầm file.
