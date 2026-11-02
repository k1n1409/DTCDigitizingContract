# Hướng dẫn sử dụng eContract dành cho người dùng và người kiểm thử

Ngày đối chiếu source: **23/10/2026**. Phạm vi chính: ứng dụng web doanh nghiệp trong `Source/Frontend`, API trong `Source/Backend`, kèm phần giới thiệu cổng System Admin.

Tài liệu mô tả chức năng đang có trong source tại thời điểm trên, bao gồm thay đổi chưa commit. Đây là hướng dẫn theo source, không phải biên bản xác nhận đã kiểm thử toàn bộ hệ thống trên môi trường triển khai. Khi giao diện hoặc backend được cập nhật, cần rà soát lại những mục liên quan.

## 1. Bắt đầu trong 5 phút

1. Xin địa chỉ môi trường test, mã công ty/tenant, tài khoản và mật khẩu từ người quản trị. Không dùng tài khoản hoặc dữ liệu thật của khách hàng để test.
2. Mở địa chỉ được cấp. Ở môi trường local đang dùng, ứng dụng doanh nghiệp là `http://localhost:5005`.
3. Nhập **Mã công ty**, **Tên tài khoản**, **Mật khẩu** rồi đăng nhập. Tên tài khoản không nhất thiết là địa chỉ email.
4. Nếu hệ thống yêu cầu đổi mật khẩu lần đầu, hoàn thành bước này trước khi sử dụng.
5. Sau đăng nhập, ứng dụng mở danh sách hợp đồng. Mở các dropdown bên trái để vào chức năng được cấp quyền.
6. Nếu chỉ muốn test luồng hợp đồng nhanh, đi theo [kịch bản ở mục 16](#16-kịch-bản-kiểm-thử-từ-đầu-đến-cuối).

**Ba điều cần nhớ:**

- Không thấy menu/nút có thể do vai trò, quyền trên hợp đồng hoặc trạng thái hiện tại, chưa chắc là lỗi.
- Sửa nội dung phải bấm **Lưu thay đổi**. Không chuyển trang, tạo vòng mới hoặc gửi duyệt khi còn thay đổi chưa lưu.
- **Chốt biên bản** và **đã ký biên bản** là hai bước khác nhau. Chỉ có bản ký hợp lệ mới được tính vào tiến độ tương ứng.

## 2. Tài khoản và vai trò

Quyền do backend xác định theo loại nhân viên. Đổi vai trò xong nên tải lại trang hoặc đăng nhập lại để giao diện nhận quyền mới.

| Vai trò | Công việc chính trong bản hiện tại |
| --- | --- |
| Manager — Quản lý | Quản lý nhân viên, phòng ban, danh mục, khách hàng, hồ sơ pháp lý; tạo/quản lý mẫu hợp đồng; đọc hợp đồng trong tenant; duyệt hoặc yêu cầu sửa lại; thực hiện ký, bàn giao, nghiệm thu, thanh toán và hoàn tất theo điều kiện |
| Admin Officer — Hành chính | Quản lý danh mục và mẫu hợp đồng; hỗ trợ hợp đồng; xem nhật ký hợp đồng theo quyền. Không mặc định có quyền duyệt hay quản lý nhân viên/phòng ban |
| Sale — Kinh doanh | Quản lý khách hàng; tạo báo giá, tạo và xử lý hợp đồng thuộc phạm vi được phép |
| Technical — Kỹ thuật | Tạo/xem hợp đồng theo phạm vi được phép; thực hiện ký, bàn giao và nghiệm thu khi có quyền truy cập hợp đồng |
| Accountant — Kế toán | Tạo/xem hợp đồng theo phạm vi được phép; thực hiện nghiệp vụ thanh toán |
| Marketing | Quản lý khách hàng; báo giá và hợp đồng thuộc phạm vi được phép |
| Khách hàng qua link | Xác thực OTP, xem và trao đổi về hợp đồng được chia sẻ. Không đăng nhập bằng tài khoản nhân viên |
| System Admin | Dùng cổng quản trị hệ thống riêng để quản lý tenant, giám sát và xem nhật ký hệ thống; không đồng nghĩa với Manager của một doanh nghiệp |

Các vai trò nhân viên hợp lệ đều có nhóm quyền cơ bản như đọc danh mục, báo giá, tạo hợp đồng, đọc/quản lý hợp đồng của mình. **Có quyền nghiệp vụ không có nghĩa được sửa mọi hợp đồng:** hệ thống còn kiểm tra phạm vi truy cập, người phụ trách và trạng thái tài liệu.

Manager không tự duyệt yêu cầu do chính mình gửi. Test phê duyệt nên có ít nhất hai tài khoản khác nhau: người gửi và Manager duyệt.

## 3. Thanh điều hướng và danh sách hợp đồng

Các nhóm hiện có trên thanh bên:

- **Hợp đồng:** danh sách hợp đồng và các mục được cấp quyền như Phê duyệt hợp đồng, Mẫu hợp đồng, Khách hàng, Nhân viên, Phòng ban, Hồ sơ pháp lý, Nhật ký hợp đồng, Nhật ký bảo mật.
- **Trạng thái hợp đồng:** có cho Manager, Admin Officer, Sale, Technical khi có quyền đọc hợp đồng.
- **Báo giá**.
- **Sản phẩm và dịch vụ**.

Nhấn biểu tượng/mũi tên của nhóm để mở hoặc thu gọn. Khi thanh bên đang thu nhỏ, bấm nhóm sẽ mở rộng để chọn mục con. Trên màn hình nhỏ, dùng nút menu để mở thanh bên.

Dashboard/Tổng quan đang ẩn khỏi menu của ứng dụng doanh nghiệp; source trang vẫn được giữ lại. Đây không phải lỗi mất menu.

### 3.1. Lọc và đọc danh sách

1. Chọn chiều **Mua/Bán**, trạng thái hoặc loại hợp đồng nếu cần.
2. Nhập mã/tên hợp đồng để tìm kiếm.
3. Chọn số dòng và chuyển trang ở cuối bảng.
4. Bấm một dòng hoặc **Chi tiết** để mở hồ sơ.

Thứ tự cột chính: **STT → Mã hợp đồng → Trạng thái → Thông tin hợp đồng → Tên khách hàng → Nhân viên phụ trách → Giá trị → Thao tác**. STT tiếp tục theo trang, không phải ID hợp đồng.

Một số thẻ tổng hợp có ghi **(trang)**: số liệu chỉ tính các dòng của trang đang xem, không phải tổng của toàn bộ doanh nghiệp.

### 3.2. Ý nghĩa trạng thái

| Trạng thái trên giao diện | Ý nghĩa và thao tác tiếp theo |
| --- | --- |
| Nháp | Đã tạo hợp đồng, chưa bắt đầu đàm phán. Hoàn thiện dữ liệu và lưu |
| Đang đàm phán | Hai bên đang trao đổi; người có quyền chỉnh sửa phiên bản hiện hành khi phiên bản chưa khóa |
| Chờ duyệt | Đã trình duyệt; nội dung phiên bản gửi duyệt bị khóa |
| Đã duyệt, đang chờ ký | Manager đã duyệt; chuyển sang tải tài liệu và lưu bản quét đã ký |
| Đã ký / Đã ký kết | Có bằng chứng ký hợp lệ; tiếp tục bàn giao, nghiệm thu và thanh toán |
| Hoàn thành / Thành công | Đã hoàn tất theo các điều kiện kiểm tra. Menu Thành công dùng trạng thái Completed |
| Đã hủy | Trạng thái dừng quy trình có trong backend; không đồng nghĩa Dừng gia hạn |
| Từ chối | Trạng thái cũ còn được đọc để giữ dữ liệu lịch sử. Luồng duyệt hiện không có nút Từ chối |
| Dừng gia hạn | Mục giao diện dành cho hợp đồng hết hạn và không tiếp tục gia hạn; chưa có nghiệp vụ và dữ liệu riêng |
| Thất bại | Mục giao diện dành cho trạng thái riêng sẽ bổ sung nghiệp vụ; chưa dùng dữ liệu Đã hủy/Từ chối thay thế |

Khi chọn **Dừng gia hạn** hoặc **Thất bại**, bản hiện tại hiển thị thông báo chờ bổ sung nghiệp vụ và danh sách trống. Không báo lỗi “không có hợp đồng” cho hai mục này và không kỳ vọng hợp đồng tự chuyển sang đây khi qua ngày hết hạn.

## 4. Chuẩn bị dữ liệu trước khi tạo hợp đồng

Nên chuẩn bị theo thứ tự sau:

1. **Manager:** tạo phòng ban và nhân viên test; kiểm tra đúng vai trò, trạng thái hoạt động.
2. **Manager:** điền Hồ sơ pháp lý doanh nghiệp, thông tin đại diện và các thông tin cần in trên tài liệu.
3. **Manager/Admin Officer:** chuẩn bị danh mục, sản phẩm/dịch vụ, đơn vị, đơn giá. Khi dùng song ngữ cần kiểm tra tên và đơn vị tiếng Anh.
4. **Sale/Marketing/Manager:** tạo khách hàng, điền thông tin công ty, đại diện, liên hệ, email/số điện thoại và thông tin pháp lý cần thiết.
5. **Manager/Admin Officer:** phát hành phiên bản mẫu hợp đồng phù hợp, cùng mẫu bàn giao/nghiệm thu nếu kịch bản cần sử dụng.

Không dùng tùy tiện số điện thoại/email ngoài bộ dữ liệu test. Với hợp đồng mua, đọc đúng nhãn đối tác/nhà cung cấp theo chiều giao dịch, không suy ra người mua/bán chỉ từ tên menu Khách hàng.

### 4.1. Phòng ban và nhân viên

- Vào **Hợp đồng → Phòng ban → Thêm phòng ban**. Nhập mã tối đa 20 ký tự và tên tối đa 200 ký tự, lưu. Mã đã tồn tại sẽ bị từ chối.
- Vào **Hợp đồng → Nhân viên**, tạo nhân viên và chọn phòng ban/vai trò phù hợp theo form. Ghi lại thông tin tài khoản được cấp theo quy trình test.
- Khóa/mở khóa qua thao tác trên danh sách. Tài khoản bị khóa không được kỳ vọng tiếp tục sử dụng bình thường.
- Tạo phòng ban không tự tạo nhân viên và không tự đổi quyền tài khoản hiện tại.

### 4.2. Khách hàng và danh mục

- Vào **Hợp đồng → Khách hàng** để tạo/xem/cập nhật khách hàng theo quyền.
- Vào **Sản phẩm và dịch vụ**, chọn loại dữ liệu cần quản lý rồi tạo/cập nhật theo form hiện hành.
- Nếu không chọn được sản phẩm trong hợp đồng, kiểm tra: có dữ liệu ở tenant đang đăng nhập, đang hoạt động, đúng loại và có đủ trường bắt buộc.
- Nếu hợp đồng song ngữ báo thiếu tên/đơn vị tiếng Anh, cập nhật tại dữ liệu danh mục rồi chọn lại; không nhập giá trị giả để bỏ qua kiểm tra.

## 5. Tạo và phát hành mẫu hợp đồng

Người thực hiện: **Manager hoặc Admin Officer đang hoạt động**.

1. Vào **Hợp đồng → Mẫu hợp đồng**, chọn tạo mẫu.
2. Nhập mã/tên mẫu, loại tài liệu, ngôn ngữ và chiều giao dịch theo form. Chọn đúng loại mẫu: hợp đồng, bàn giao hoặc nghiệm thu.
3. Mở phiên bản nháp trong trang chi tiết mẫu.
4. Khai báo điều khoản, căn cứ, phụ lục và các nội dung liên quan theo mẫu. Với hợp đồng, hoàn thiện điều khoản thanh toán và các đợt nếu sử dụng.
5. Tải DOCX đã gắn placeholder đúng quy định bằng **Tải lên và kiểm tra**. Dùng file mẫu do nhóm dự án cung cấp để test lần đầu.
6. Đọc kết quả kiểm tra và sửa lỗi được chỉ ra. Không phải file có đuôi `.docx` nào cũng là mẫu hợp lệ: file còn phải đáp ứng cấu trúc và placeholder.
7. Tạo bản xem trước và mở PDF/DOCX để kiểm tra bố cục, bảng, ngôn ngữ và nội dung.
8. Kiểm tra checklist Phát hành. Ví dụ: có DOCX hợp lệ, có preview hiện hành, có nội dung bắt buộc; nếu có các đợt thanh toán thì tổng tỷ lệ phải đúng 100%.
9. Bấm **Phát hành phiên bản** và xác nhận.

**Kết quả mong đợi:** phiên bản đã phát hành có thể được chọn khi tạo hợp đồng phù hợp. Mẫu nháp, ngừng sử dụng hoặc không khớp điều kiện không được kỳ vọng xuất hiện như mẫu khả dụng.

Phiên bản Published không được sửa trực tiếp. Muốn thay đổi, tạo phiên bản nháp mới, sửa, kiểm tra, xem trước và phát hành lại. Tạo phiên bản mới không có nghĩa phiên bản Published cũ được mở khóa.

Nếu preview/phát hành báo thiếu LibreOffice hoặc không chuyển được PDF, gửi lỗi cho người vận hành môi trường. Đây không phải lỗi cần tester sửa nội dung bằng cách bỏ kiểm tra an toàn.

## 6. Tạo hợp đồng nháp

Vào **Hợp đồng → Danh sách hợp đồng → Tạo hợp đồng nháp**. Form có bốn bước:

### Bước 1 — Đối tác & Mẫu

- Chọn Mua/Bán, khách hàng/đối tác, loại hợp đồng, ngôn ngữ, mẫu và các thông tin theo form.
- Kiểm tra nhân viên phụ trách và dữ liệu đối tác trước khi tiếp tục.
- Nếu là hợp đồng phụ thuộc/hợp đồng liên quan, chọn hợp đồng gốc khi form yêu cầu; không mặc định mọi hợp đồng đều bắt buộc có hợp đồng gốc.

### Bước 2 — Sản phẩm

- Tìm và chọn sản phẩm/dịch vụ, nhập số lượng, đơn giá, chiết khấu, VAT theo form.
- Số lượng dùng số nguyên; các trường tiền/tỷ lệ dùng kiểu số có phần thập phân và giới hạn riêng. Trường tỷ lệ còn phải đúng phạm vi nghiệp vụ.
- Kiểm tra tổng tiền sau chiết khấu và VAT, đồng tiền, đơn vị và thông tin tiếng Anh nếu có.

### Bước 3 — Điều khoản

- Rà soát điều khoản lấy từ mẫu; điền phần nội dung được phép sửa và các dữ liệu bắt buộc.
- Kiểm tra căn cứ/phụ lục và kế hoạch thanh toán khi được hiển thị.
- Điền ngày các đợt thanh toán nếu form yêu cầu. Tổng tỷ lệ và nội dung phải phù hợp kiểm tra của hệ thống.

### Bước 4 — Xem trước

- Đọc lại đối tác, nhân viên, phạm vi sản phẩm, điều khoản, thời hạn, ngôn ngữ và tổng thanh toán.
- Bấm tạo đúng một lần và đợi kết quả; tránh bấm liên tục tạo bản trùng.
- Khi tạo thành công, hệ thống chuyển sang chi tiết hợp đồng. Nếu có hộp hỏi xem PDF, chọn Có để mở thêm tab; chọn Không vẫn chuyển đến chi tiết.

**Kết quả:** có mã hợp đồng và trạng thái Nháp. Tạo thành công không có nghĩa đã gửi khách hàng, đã trình duyệt hoặc đã ký.

## 7. Chỉnh sửa hồ sơ và xem tài liệu

Trang chi tiết hiện có các nhóm/tab như **Tổng quan, Chứng từ, Vòng đàm phán, Điều khoản - Trao đổi, Căn cứ, Phụ lục, truy cập khách hàng, Phê duyệt, Ký hợp đồng, Đóng hợp đồng, Lịch sử hoạt động**. Một số mục/nút chỉ hiện khi có quyền và đúng trạng thái.

1. Sửa ở phiên bản hiện hành khi có quyền và phiên bản cho phép chỉnh sửa.
2. Bấm **Lưu thay đổi** rồi kiểm tra thông báo thành công.
3. Xem lại dữ liệu sau tải lại trang để xác nhận đã lưu.
4. Dùng thao tác xem/tải PDF hoặc DOCX đang được cung cấp. PDF thường mở ở tab mới; trình duyệt có thể cần cho phép popup.

Đọc đúng loại tài liệu: **preview** là tài liệu xem trước; **tài liệu phiên bản đã duyệt** gắn với nội dung gửi duyệt; **bản quét đã ký** là bằng chứng ký tải lên. Không dùng việc mở được preview để kết luận hợp đồng đã ký.

Chuyển giao người phụ trách phải qua thao tác Chuyển giao khi được phép. Người phụ trách khác với người đang đăng nhập; người xem có thể chỉ có quyền đọc.

## 8. Đàm phán, phiên bản và trao đổi điều khoản

### 8.1. Bắt đầu và sửa nội dung

1. Từ hợp đồng Nháp đã hoàn thiện, dùng thao tác bắt đầu đàm phán khi được hiển thị.
2. Kiểm tra trạng thái đổi thành Đang đàm phán.
3. Rà soát tổng quan và điều khoản. Lưu mọi thay đổi trước thao tác tiếp theo.

### 8.2. Tạo vòng đàm phán mới

Trong tab **Vòng đàm phán**, dùng **Tạo vòng mới** khi có quyền và hệ thống cho phép:

1. Lưu các thay đổi đang có.
2. Nhập lý do tạo vòng mới.
3. Xác nhận và đợi hệ thống khóa/lưu snapshot phiên bản trước, tạo phiên bản mới.
4. Kiểm tra số phiên bản hiện hành rồi chỉnh sửa trên phiên bản mới.

Không kỳ vọng mỗi lần gõ, thêm hoặc xóa một điều khoản sẽ tự tạo một vòng mới. Tạo vòng mới là thao tác riêng; trong một số luồng đã chia sẻ/khóa nội dung, hệ thống có thể yêu cầu xử lý phiên bản/liên kết trước khi lưu.

### 8.3. Xem lịch sử

- Chọn phiên bản trong **Lịch sử phiên bản** để xem tóm tắt snapshot.
- Danh sách có phân trang khi đủ số phiên bản; ít phiên bản có thể không hiện nút phân trang.
- **Xem chi tiết** dành cho snapshot đã khóa và không phải phiên bản hiện hành; trang riêng có sản phẩm, điều khoản và bình luận theo dữ liệu lưu.
- Phiên bản hiện hành không có nút chi tiết snapshot theo thiết kế hiện tại.

### 8.4. Trao đổi điều khoản

1. Trong **Điều khoản - Trao đổi**, mở phần trao đổi của điều khoản cần xem.
2. Chọn bình luận cha để vào chuỗi trao đổi, đọc các phản hồi con.
3. Bấm **Trả lời** vào đúng bình luận rồi nhập nội dung. Phần nhắc tên chỉ hiện khi chủ động chọn trả lời.
4. Gửi rồi kiểm tra bình luận nằm đúng điều khoản/phiên bản/chuỗi.
5. Nếu có quyền, dùng thao tác giải quyết hoặc mở lại theo giao diện. Nhân viên không được mặc định chỉnh sửa nội dung feedback do khách hàng gửi.

## 9. Chia sẻ cho khách hàng và OTP

Người thực hiện phải có quyền và quyền thao tác trên hợp đồng. Tab truy cập khách hàng hiện dùng để thiết lập số xác minh và quản lý link.

1. Kiểm tra email liên hệ và số điện thoại của đối tác; chọn nguồn số hoặc nhập số theo form. Nếu thay số và form yêu cầu lý do, nhập lý do rõ ràng.
2. Lưu dữ liệu trước khi tạo liên kết.
3. Tạo link, sao chép ngay khi hệ thống hiển thị và gửi cho người test đóng vai khách hàng qua kênh được thống nhất.
4. Mở link trong cửa sổ ẩn danh hoặc trình duyệt khác để tách khỏi phiên nhân viên.
5. Khách hàng nhập đúng số đã thiết lập, yêu cầu OTP, nhập đủ sáu chữ số rồi xác thực.
6. OTP được gửi theo cấu hình môi trường: email hoặc SMS; môi trường Fake dùng để test và có thể ghi mã vào console backend. Không mặc định cứ nhập số điện thoại là nhận SMS thật.
7. Sau xác thực, kiểm tra nội dung phiên bản được chia sẻ và chức năng phản hồi đang được cho phép.

Lưu ý khi test:

- Có thể chuẩn bị số/link khi còn Nháp theo điều kiện form; việc khách hàng xem/trao đổi phụ thuộc trạng thái hợp đồng. Luồng xem đàm phán phải thử khi hợp đồng đang Đang đàm phán.
- Thay/thu hồi link có thể làm link cũ, OTP đang chờ và phiên khách hàng mất hiệu lực. Không dùng mã/link cũ để kết luận OTP mới bị lỗi.
- Khi nhận OTP bằng email, kiểm tra cả Spam. Không gửi OTP, mật khẩu hay toàn bộ link truy cập lên nhóm báo lỗi công khai.
- Nội dung đã sửa/phiên bản mới không mặc định đồng nghĩa khách hàng tiếp tục xem bằng link cũ. Kiểm tra cảnh báo và phiên bản gắn với link.

## 10. Gửi duyệt và duyệt hợp đồng

### 10.1. Nhân viên gửi duyệt

1. Hoàn thiện phiên bản đàm phán, lưu nội dung và xử lý các cảnh báo.
2. Bấm **Gửi duyệt**, đọc xác nhận và gửi.
3. Kiểm tra hợp đồng chuyển sang Chờ duyệt và xuất hiện yêu cầu trong tab Phê duyệt/lịch sử.
4. Nội dung gửi duyệt bị khóa; không tiếp tục sửa trực tiếp trong lúc chờ.

### 10.2. Manager xử lý

1. Đăng nhập bằng Manager khác người gửi.
2. Vào **Hợp đồng → Phê duyệt hợp đồng**.
3. Mở yêu cầu, kiểm tra mã hợp đồng, phiên bản, người gửi và DOCX/PDF của phiên bản trình duyệt.
4. Chọn một trong hai quyết định hiện có:
   - **Duyệt hợp đồng:** chuyển sang Đã duyệt, đang chờ ký.
   - **Yêu cầu sửa lại:** nhập lý do; hồ sơ quay về Đang đàm phán. Người phụ trách tạo phiên bản mới theo yêu cầu trước khi sửa.
5. Xác nhận và kiểm tra trạng thái/lịch sử.

Luồng hiện tại đã bỏ **Từ chối**; không tạo test case yêu cầu nút này phải tồn tại. Nếu có thao tác Rút yêu cầu ở phía người gửi, sử dụng đúng điều kiện hiển thị; không dùng xóa dữ liệu để thay thế rút yêu cầu.

Nếu báo thiếu/sai hash DOCX/PDF, báo cho nhóm phát triển kèm mã hợp đồng và phiên bản. Hash dùng để đối chiếu tài liệu bất biến, không phải trường người dùng cần tự nhập hoặc sửa.

## 11. Ký hợp đồng bằng bản quét

Người thực hiện: Technical hoặc Manager có quyền trên tài nguyên. Hợp đồng phải đủ điều kiện của luồng ký.

1. Vào tab **Ký hợp đồng** sau khi hợp đồng đã được duyệt.
2. Kiểm tra tài liệu của **đúng phiên bản đã duyệt** và tải/xem bản cần ký.
3. Chuẩn bị một bản quét có đủ chữ ký hợp lệ của hai bên.
4. Nhập **Ngày ký hợp đồng** theo ngày ký thực tế; ngày tải file không thay thế ngày ký nghiệp vụ. Không chọn ngày tương lai.
5. Chọn PDF/JPG/JPEG/PNG, tối đa 20 MB, rồi lưu theo form.
6. Kiểm tra bản quét đang hiệu lực, trạng thái hợp đồng và lịch sử.

Khi cần thay bản quét, dùng **Thay bản quét đang hiệu lực**, nhập lý do, ngày ký và tệp theo form hiện tại. Kiểm tra bản mới có hiệu lực, bản cũ còn trong lịch sử. Không xóa lịch sử để thay file.

Chỉ tải file vào tab **Chứng từ** không tự chuyển hợp đồng sang Đã ký. Phải dùng đúng luồng Ký hợp đồng.

## 12. Bàn giao, nghiệm thu, thanh toán và hoàn tất

Mở **Đóng hợp đồng** để xem checklist và các phần nghiệp vụ đang được phép thực hiện.

### 12.1. Bàn giao — Technical/Manager

1. Kiểm tra baseline/phạm vi hạng mục từ hợp đồng đã ký và cách theo dõi từng dòng theo form.
2. Tạo biên bản bàn giao nháp, chọn phạm vi/số lượng, mẫu và thông tin yêu cầu.
3. Lưu và kiểm tra nội dung, sau đó **Chốt bàn giao** để tạo tài liệu chính thức chờ ký.
4. Tải bản ký hợp lệ của hai bên và nhập ngày ký thực tế; xác nhận theo form.
5. Kiểm tra tiến độ đã bàn giao cập nhật đúng phần được ký.

Số lượng ở bản nháp/chờ ký chưa phải số lượng đã bàn giao. Phạm vi đã giữ chỗ có thể khiến không chọn được số lượng vượt phần còn lại. Xử lý bản đang chờ bằng thao tác hợp lệ trước khi tạo chồng phạm vi.

### 12.2. Nghiệm thu — Technical/Manager

1. Kiểm tra phạm vi đã bàn giao và các đợt/mốc liên quan còn phải nghiệm thu.
2. Tạo biên bản nghiệm thu nháp, chọn phạm vi và nhập nội dung theo form.
3. Lưu, chốt tài liệu rồi tải bản ký hợp lệ, ngày ký thực tế theo luồng hiện có.
4. Kiểm tra tiến độ nghiệm thu cập nhật đúng hạng mục/số lượng/đợt.

Hủy biên bản hoặc thay đổi hồ sơ phải dùng thao tác có trong giao diện; đọc xác nhận vì việc này có thể ảnh hưởng số lượng và điều kiện hoàn tất.

### 12.3. Thanh toán — Accountant/Manager

1. Mở phần thanh toán trong hồ sơ đóng hợp đồng.
2. Chọn đúng đợt, kiểm tra số tiền và điều kiện được phép xử lý.
3. Điền ngày, phương thức, số tham chiếu và bằng chứng theo yêu cầu form.
4. Xác nhận rồi kiểm tra trạng thái đợt và tổng đã thanh toán.
5. Nếu cần hoàn tác, dùng thao tác được cấp quyền và nhập lý do. Không nhập thêm một khoản thu trùng để sửa nhầm dữ liệu.

Thanh toán có thể phụ thuộc nghiệm thu hoặc dữ liệu đợt. Không báo lỗi nút bị khóa nếu màn hình đang chỉ ra điều kiện chưa đạt.

### 12.4. Hoàn tất — Manager

Checklist hiện tại gồm:

- Hợp đồng có bản quét đã ký hợp lệ.
- Đã bàn giao đủ phạm vi bằng chứng từ ký hợp lệ.
- Đã nghiệm thu đủ phạm vi và các đợt yêu cầu.
- Đã thanh toán đủ giá trị hợp đồng.

Ngoài ra, còn hồ sơ thực hiện ở trạng thái nháp/chờ ký có thể chặn hoàn tất. Đọc danh sách điều kiện chưa đạt trên màn hình, xử lý rồi tải lại kiểm tra. Khi đã đủ và có quyền, dùng thao tác hoàn tất; kiểm tra trạng thái Hoàn thành/Thành công và nhật ký.

Không dùng riêng việc “đã upload chứng từ” hoặc “đã thanh toán một đợt” để kết luận đủ điều kiện đóng hợp đồng.

## 13. Chứng từ và lịch sử

### Chứng từ đính kèm

- Trong tab **Chứng từ**, chọn/kéo file, chọn loại chứng từ và bấm đính kèm.
- Form hiện chấp nhận PDF, Word, Excel, ảnh hoặc ZIP; giới hạn 10 MB mỗi file theo giao diện.
- Chờ thông báo và kiểm tra file xuất hiện trong danh sách; chọn file thôi chưa phải tải lên thành công.
- Xem/tải/xóa theo quyền. Bằng chứng ký, bàn giao, nghiệm thu và thanh toán phải đi qua đúng luồng nghiệp vụ của chúng.

### Nhật ký

- **Lịch sử hoạt động** trong hồ sơ giúp xem sự kiện của một hợp đồng.
- **Nhật ký hợp đồng** trên menu giúp tra cứu theo quyền trong tenant.
- **Nhật ký bảo mật** dành cho vai trò được cấp quyền, không thay thế lịch sử sửa nội dung hợp đồng.
- Khi đối chiếu thời gian, ghi rõ múi giờ và thời điểm thao tác thực tế. Không tự cộng thêm bảy giờ vào thời gian chờ.

## 14. Báo giá

API hiện được nối cho **danh sách, tạo, chi tiết, xóa bản nháp**. Chưa có luồng sửa/duyệt báo giá được nối trong bản này.

1. Vào **Báo giá → Tạo báo giá mới**.
2. Tìm/chọn khách hàng đang hoạt động; có phân trang kết quả chọn.
3. Tìm/chọn **sản phẩm**, thêm vào báo giá. API tạo hiện nhận ProductId; không mặc định hỗ trợ dịch vụ như form hợp đồng.
4. Nhập số lượng nguyên dương, đơn giá không âm. Form làm tròn đơn giá đến hai chữ số thập phân theo dữ liệu lưu báo giá.
5. Kiểm tra tổng cộng và bấm tạo.
6. Hệ thống tự tạo mã, ngày và trạng thái Draft, rồi mở trang chi tiết.
7. Trở lại danh sách để kiểm tra tìm kiếm/lọc; mở lại báo giá để đối chiếu sản phẩm và số tiền.
8. Chỉ bản nháp có thao tác xóa. Xóa cần xác nhận; không có nút xóa hàng loạt giả lập.

Tài khoản có quyền báo giá vẫn có thể thiếu quyền quản lý khách hàng để tải danh sách chọn ở form hiện tại. Nếu báo lỗi quyền khi chọn khách hàng, ghi lại vai trò để nhóm phát triển kiểm tra; không kết luận là không có khách hàng.

## 15. Cổng System Admin

Cổng System Admin là ứng dụng riêng trong `Source/SystemAdmin`; dùng địa chỉ và tài khoản do người vận hành cung cấp, không dùng tài khoản tenant để suy ra quyền quản trị hệ thống.

Các nhóm hiện có gồm Dashboard, Quản lý tenant, Giám sát hệ thống, Nhật ký bảo mật và hồ sơ/đổi mật khẩu. Khi test tenant:

1. Tạo hoặc chọn đúng tenant test; kiểm tra mã, tên, trạng thái và thông tin theo form.
2. Chỉ khóa/kích hoạt trên tenant đã thống nhất dành cho kịch bản, vì ảnh hưởng người dùng của cả doanh nghiệp.
3. Dùng cổng doanh nghiệp đăng nhập lại để kiểm tra kết quả; không chỉ kiểm tra toast ở cổng quản trị.
4. Các chỉ số giám sát có thể hiện chưa thu thập; không suy ra dữ liệu bằng 0 nếu màn hình không xác nhận.

Tài liệu này không mô tả cách cài server, tạo database hay migration. Các lỗi hạ tầng trong mục 17 cần chuyển người vận hành xử lý.

## 16. Kịch bản kiểm thử từ đầu đến cuối

Chuẩn bị tài khoản Sale A, Manager B, Technical C, Accountant D; có thể dùng Manager cho các bước thực hiện được cấp quyền, nhưng **người duyệt phải khác người gửi**. Cần một người/trình duyệt đóng vai khách hàng.

| Bước | Người thực hiện | Thao tác | Kết quả cần xác nhận |
| --- | --- | --- | --- |
| 1 | Manager/Admin Officer | Chuẩn bị và phát hành mẫu hợp đồng, mẫu thực hiện nếu cần | Preview đúng; bản Published không sửa trực tiếp; mẫu khả dụng đúng chiều/ngôn ngữ |
| 2 | Sale/Manager | Chuẩn bị khách hàng và sản phẩm | Đủ dữ liệu bắt buộc, đúng tenant, đang hoạt động |
| 3 | Sale A | Tạo hợp đồng đủ bốn bước | Có mã; Nháp; tải lại vẫn còn dữ liệu; PDF đúng dữ liệu đã nhập |
| 4 | Sale A | Bắt đầu đàm phán, lưu nội dung | Đang đàm phán; tính tiền/điều khoản đúng sau tải lại |
| 5 | Người có quyền | Thiết lập số và tạo link | Link được tạo đúng phiên bản; có thể sao chép để test |
| 6 | Khách hàng | Nhập số, yêu cầu và xác thực OTP, gửi phản hồi | Xem đúng hợp đồng; phản hồi đúng điều khoản; số/mã sai không truy cập được |
| 7 | Sale A | Tạo vòng mới khi cần rồi sửa/lưu | Snapshot cũ khóa; có phiên bản mới; lịch sử tra cứu được |
| 8 | Sale A | Gửi duyệt | Chờ duyệt; không sửa trực tiếp bản gửi |
| 9 | Manager B | Yêu cầu sửa lại một lần | Có lý do; quay về đàm phán; tạo phiên bản mới và gửi lại |
| 10 | Manager B | Duyệt bản gửi lại | Đã duyệt, đang chờ ký; tài liệu đúng version |
| 11 | Technical/Manager | Nhập ngày ký, tải bản quét ký đủ hai bên | Đã ký; có bản đang hiệu lực và lịch sử |
| 12 | Technical/Manager | Tạo → lưu → chốt → tải bản ký bàn giao | Chỉ phần đã ký được cộng vào tiến độ; không vượt phạm vi |
| 13 | Technical/Manager | Tạo → chốt → ký nghiệm thu theo phạm vi/đợt | Đủ nghiệm thu; tài liệu đúng dữ liệu |
| 14 | Accountant/Manager | Hoàn tất các đợt thanh toán | Đúng tổng tiền; đúng ngày/phương thức/bằng chứng |
| 15 | Manager | Kiểm tra và hoàn tất hợp đồng | Không còn blocker; Hoàn thành/Thành công; nhật ký ghi nhận |
| 16 | Người có quyền | Lọc menu trạng thái và mở lại hồ sơ | Đúng nhóm dữ liệu, STT/phân trang hợp lý, quyền không bị mở rộng |

### Các ca âm nên thử riêng

- Sai mật khẩu, sai tenant, tài khoản bị khóa.
- Sale truy cập chức năng quản lý mẫu/duyệt bằng URL trực tiếp: không được vượt quyền.
- Manager tự duyệt yêu cầu của mình: bị chặn.
- Sửa bản Published hoặc snapshot đã khóa: bị chặn.
- Tạo vòng khi chưa lưu, gửi duyệt thiếu dữ liệu: có cảnh báo, không tạo dữ liệu nửa chừng theo kết quả trả về.
- OTP sai/hết hạn, link bị thu hồi/thay thế: không dùng lại được phiên cũ.
- File sai loại, file rỗng, file quá dung lượng: không được ghi nhận là bản ký hợp lệ.
- Chốt biên bản nhưng chưa tải bản ký: chưa cộng tiến độ hoàn tất.
- Chưa bàn giao/nghiệm thu/thanh toán đủ: không hoàn tất hợp đồng.
- Hai người cùng sửa: khi báo dữ liệu cũ, tải lại và đối chiếu, không bấm lưu lặp liên tục.

## 17. Câu hỏi thường gặp và cách xử lý

| Hiện tượng | Kiểm tra/cách xử lý |
| --- | --- |
| Không thấy menu hoặc nút | Xác nhận role, quyền trên hợp đồng, người phụ trách và trạng thái. Sau đổi quyền, tải lại/đăng nhập lại |
| Không chọn được mẫu | Kiểm tra mẫu đang hoạt động, phiên bản đã Published, đúng chiều/loại/ngôn ngữ và điều kiện của form |
| Không có sản phẩm | Kiểm tra tenant, trạng thái sản phẩm, bộ lọc; với song ngữ kiểm tra tên/đơn vị tiếng Anh |
| Lưu bị chặn vì nội dung đã khóa | Xem phiên bản hiện hành, trạng thái gửi duyệt và liên kết chia sẻ; đi đúng thao tác tạo vòng/phiên bản mới |
| Không nhận OTP | Xem kênh nhận, email/Spam/số xác minh, link còn hiệu lực; hỏi môi trường đang dùng Fake hay gửi thật |
| Link cũ vừa dùng được nay không vào được | Kiểm tra link bị thay/thu hồi, OTP và phiên cũ hết hiệu lực, phiên bản được chia sẻ |
| PDF không mở tab mới | Cho phép popup của môi trường, thử lại thao tác; ghi lại lỗi nếu tải file cũng thất bại |
| Sai/thiếu hashdocx hoặc hash PDF | Chuyển developer kiểm tra tài liệu của phiên bản gửi duyệt; không sửa hash thủ công |
| HTTP 400 | Đọc thông báo cụ thể: dữ liệu/điều kiện nghiệp vụ hoặc tenant. Lưu lại request và response đã che thông tin nhạy cảm |
| HTTP 401 | Phiên không hợp lệ/hết hạn hoặc tài khoản bị khóa: đăng nhập lại, kiểm tra với Manager |
| HTTP 403 | Thiếu quyền hoặc cần đổi mật khẩu; đổi tài khoản đúng vai trò, không tìm cách bỏ kiểm tra quyền |
| Dữ liệu đã thay đổi/row version cũ | Tải lại hồ sơ, so sánh thay đổi trước khi sửa và lưu lại |
| Invalid column/table khi đăng nhập hoặc mở trang | Database có thể thiếu migration/khác schema; chuyển người vận hành, không xóa dữ liệu test tùy tiện |
| CustomerOtp:Provider không hợp lệ khi khởi động | Lỗi cấu hình OTP môi trường. Cấu hình SMTP hiện dùng nhóm Email:Smtp; chuyển người vận hành xử lý |
| LibreOffice/PdfConverterUnavailable | Môi trường thiếu cấu hình/công cụ tạo PDF; chuyển người vận hành |
| Bấm hoàn tất không được | Đọc checklist: bản ký, phạm vi bàn giao/nghiệm thu, thanh toán và hồ sơ nháp/chờ ký còn tồn |
| Dừng gia hạn/Thất bại trống | Hiện là mục chờ nghiệp vụ; chưa phải danh sách dữ liệu thực tế |

## 18. Mẫu báo lỗi gửi cho nhóm phát triển

Sao chép mẫu sau và điền đủ để hạn chế hỏi lại:

```text
Tiêu đề lỗi:
Môi trường/địa chỉ trang:
Thời điểm xảy ra (giờ Việt Nam):
Mã tenant:
Vai trò tài khoản (không gửi mật khẩu):
Mã hợp đồng / mã báo giá / mã mẫu:
Phiên bản đang thao tác và trạng thái trước khi thao tác:

Điều kiện chuẩn bị:
Các bước tái hiện:
1.
2.
3.

Kết quả mong đợi:
Kết quả thực tế/thông báo chính xác:
Có tái hiện sau tải lại trang không:
Ảnh hoặc video:
Nếu có: URL API, HTTP status, response lỗi đã che thông tin nhạy cảm:
Mức ảnh hưởng: chặn test / sai dữ liệu / giao diện:
```

Không gửi mật khẩu, OTP, token, cookie, app password email, connection string hoặc toàn bộ link khách hàng. Khi lỗi dữ liệu, giữ nguyên hồ sơ để tái hiện; không xóa rồi tạo lại ngay làm mất dấu lỗi.

## 19. Nguồn đối chiếu và cách cập nhật tài liệu

Các nguồn chính trong repository:

- `Source/Frontend/components/sidebar.tsx`: menu và dropdown trạng thái.
- `Source/Backend/ContractManagement.API/Common/Security/RbacPermissions.cs`: quyền theo vai trò.
- `Source/Frontend/app/page.tsx`: đăng nhập/trang vào mặc định.
- `Source/Frontend/app/(protected)/contracts/create/page.tsx`: bốn bước tạo hợp đồng.
- `Source/Frontend/app/(protected)/contracts/[id]/page.tsx` và `Source/Frontend/components/contracts/`: chi tiết, phiên bản, ký, bàn giao, nghiệm thu, thanh toán, chứng từ.
- `Source/Backend/ContractManagement.API/Domains/Policies/Contract/ContractCompletionPolicy.cs`: điều kiện hoàn tất hiện hành.
- `Source/Frontend/app/(public)/public/contracts/[tenantCode]/[linkToken]/page.tsx`: truy cập khách hàng và OTP.
- `Source/Frontend/app/(protected)/quotations/` và controller Quotation: các luồng báo giá đã nối.
- `Source/Frontend/app/(protected)/admin/contract-templates/`: quản lý và phát hành mẫu.
- `Source/SystemAdmin/components/sidebar.tsx`: menu cổng quản trị hệ thống.

Sau mỗi lần merge thay đổi luồng/quyền, cập nhật ngày đối chiếu, mục nghiệp vụ liên quan và kịch bản test tương ứng. Ưu tiên hành vi của controller/service và giao diện hiện hành; không lấy riêng comment cũ trong source làm quy tắc sử dụng.
