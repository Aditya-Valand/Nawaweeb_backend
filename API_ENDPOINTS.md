# Nawaweeb Backend API Endpoints

## Base URL: http://localhost:5000/api

---

## Authentication Routes (/auth)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | /register | No | Register new user |
| POST | /login | No | Login user |
| GET | /profile | Yes | Get current user profile |
| PATCH | /profile | Yes | Update user profile |
| PATCH | /users/role | Yes (Admin) | Update user role |

---

## Product Routes (/products)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | / | No | Get all products (with variants) |
| GET | /:id | No | Get product by ID or slug |
| POST | / | Yes (Admin) | Create new product |
| PATCH | /:id | Yes (Admin) | Update product |
| DELETE | /:id | Yes (Admin) | Delete product |
| POST | /:productId/variants | Yes (Admin) | Add variant to product |
| PATCH | /variants/:variantId/stock | Yes (Admin) | Update variant stock |

---

## Order Routes (/orders)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | / | Yes | Create new order |
| GET | / | Yes | Get user's orders |
| GET | /:id | Yes | Get order by ID |
| POST | /:id/cancel | Yes | Cancel order |
| GET | /admin/all | Yes (Admin) | Get all orders |
| PATCH | /:id/status | Yes (Admin) | Update order status |

---

## Example Requests

### Register
```bash
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "password123",
  "full_name": "John Doe"
}
```

### Login
```bash
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}
```

### Create Product (Admin)
```bash
POST /api/products
Authorization: Bearer <token>
{
  "title": "Naruto Hoodie",
  "slug": "naruto-hoodie",
  "price": 4999,
  "images": ["url1", "url2"],
  "description": "Premium hoodie",
  "is_active": true,
  "variants": [
    { "size": "M", "stock_quantity": 10 },
    { "size": "L", "stock_quantity": 5, "price_override": 5499 }
  ]
}
```

### Create Order
```bash
POST /api/orders
Authorization: Bearer <token>
{
  "items": [
    { "variant_id": "uuid", "quantity": 2 }
  ],
  "shipping_address": {
    "address": "123 Main St",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "phone": "9876543210"
  }
}
```

---

## Notes
- All prices are in cents (4999 = ₹49.99)
- Token required in Authorization header: `Bearer <token>`
- Stock automatically managed on order create/cancel
- Products include nested variants in responses
