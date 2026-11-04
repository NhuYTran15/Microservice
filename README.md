# E-commerce Microservices MVP

Backend Node.js theo kiến trúc Microservices, DDD thực dụng và Database-per-Service.

## Thành phần

- API Gateway: REST, JWT, RBAC, Redis cache, rate limiting và logging.
- Auth Service: đăng ký, đăng nhập, bcrypt và phát JWT.
- Customer Service: hồ sơ khách hàng, hạng thành viên và score.
- Product Service: CRUD sản phẩm, kiểm tra và giữ tồn kho.
- Order Service: discount, Order/OrderDetail và Transactional Outbox.
- Shipment Service: nhận `OrderCreated` từ Kafka và quản lý trạng thái giao hàng.

Client chỉ truy cập `http://localhost:3100`. Giao tiếp đồng bộ nội bộ dùng gRPC. Có thể đổi cổng host bằng biến `GATEWAY_HOST_PORT`.

## Chạy hệ thống

```bash
npm install
docker compose up --build -d
docker compose ps
curl http://localhost:3100/api/health
```

Lần chạy đầu cần tải Docker image và có thể mất vài phút.

## Thử luồng chính

Đăng ký:

```bash
curl -X POST http://localhost:3100/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"john","password":"P@ss1234","fullname":"John Doe","email":"john@example.com","phone":"0900000000"}'
```

Đăng nhập và lưu token:

```bash
curl -X POST http://localhost:3100/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"john","password":"P@ss1234"}'
```

Gọi các API bảo vệ bằng header `Authorization: Bearer <accessToken>`:

```bash
curl http://localhost:3100/api/products -H 'Authorization: Bearer <accessToken>'

curl -X POST http://localhost:3100/api/orders \
  -H 'Authorization: Bearer <accessToken>' \
  -H 'Content-Type: application/json' \
  -d '{"items":[{"pid":1,"qty":2},{"pid":2,"qty":1}]}'
```

Shipment được tạo bất đồng bộ. Dùng đường dẫn `shipment_lookup` trong response tạo order, hoặc gọi:

```bash
curl http://localhost:3100/api/orders/<oid>/shipment \
  -H 'Authorization: Bearer <accessToken>'
```

Tài khoản quản trị mặc định cho môi trường local là `admin` / `Admin@123`. Hãy thay đổi thông tin này ngoài môi trường học tập.

## Chính sách discount

| Score | Discount |
|---:|---:|
| dưới 100 | 0% |
| 100–499 | 5% |
| 500–999 | 10% |
| từ 1000 | 15% |

## Kiểm tra mã nguồn

```bash
npm run check
npm test
docker compose config --quiet
```

## Dừng hệ thống

```bash
docker compose down
```

Dữ liệu nằm trong named volumes. Chỉ dùng `docker compose down -v` khi chủ động muốn xóa toàn bộ dữ liệu local.
