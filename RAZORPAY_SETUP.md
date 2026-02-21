# Razorpay Payment Integration Guide

## Overview
This backend implements a secure Razorpay payment integration with the following approach:
- **Zero Frontend Trust**: All totals are calculated on the backend from the database
- **Stock Validation**: Inventory is verified before payment processing
- **Atomic Operations**: Orders, order items, and stock updates are sequential with rollback on failure
- **Webhook Support**: Asynchronous payment notifications for improved reliability

## Prerequisites

### 1. Razorpay Account Setup
1. Create a Razorpay account at https://dashboard.razorpay.com/
2. Navigate to **Settings > API Keys**
3. Copy your **Key ID** and **Key Secret**
4. For webhooks, navigate to **Settings > Webhooks** and copy the **Webhook Secret**

### 2. Environment Variables
Add these to your `.env` file:

```env
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_razorpay_secret_key
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret
```

See `.env.example` for the complete environment template.

## API Endpoints

### 1. Create Razorpay Order
**Endpoint**: `POST /api/checkout/create-razorpay-order`

**Authentication**: Required (Bearer token)

**Description**: 
Generates a Razorpay order ID before accepting payment. This endpoint:
- Fetches the user's cart items
- Calculates the exact total from the database (variant price takes precedence over product price)
- Validates that sufficient stock exists for all items
- Creates a Razorpay order without inserting into the database yet

**Request Headers**:
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body**: (empty)
```json
{}
```

**Success Response** (200):
```json
{
  "success": true,
  "razorpay_order_id": "order_1A2B3C4D5E6F7G8H",
  "amount": 50000,
  "currency": "INR",
  "key_id": "rzp_test_xxxxxxxxxxxxx"
}
```

**Error Responses**:
- **400**: Cart is empty
- **400**: Insufficient stock for one or more items
- **500**: Server error (Razorpay API unreachable or database error)

---

### 2. Verify Razorpay Payment
**Endpoint**: `POST /api/checkout/verify-razorpay`

**Authentication**: Required (Bearer token)

**Description**:
Verifies the payment signature and fulfills the order in the database. This endpoint:
- Validates the shipping address (required fields: street, city, pincode, phone)
- Verifies the Razorpay payment signature using HMAC SHA256
- Recalculates the total to prevent race conditions
- Creates the order and order_items records
- Decrements stock for all variants
- Clears the user's cart
- Returns the new order ID

**Request Headers**:
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "razorpay_order_id": "order_1A2B3C4D5E6F7G8H",
  "razorpay_payment_id": "pay_1A2B3C4D5E6F7G8H",
  "razorpay_signature": "9ef4dffbfd84f1318f6739a3ce19f9d85851857ae648f114332d8401e0949a3d",
  "shipping_address": {
    "street": "123 Main Street, Apt 4B",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "phone": "9876543210",
    "country": "India"
  }
}
```

**Success Response** (201):
```json
{
  "success": true,
  "message": "Payment verified and order created successfully",
  "order_id": "550e8400-e29b-41d4-a716-446655440000",
  "razorpay_order_id": "order_1A2B3C4D5E6F7G8H",
  "razorpay_payment_id": "pay_1A2B3C4D5E6F7G8H"
}
```

**Error Responses**:
- **400**: Missing required payment parameters
- **400**: Missing shipping address
- **400**: Shipping address missing required fields (street, city, pincode, phone)
- **400**: Invalid payment signature
- **400**: Stock unavailable (rechecked during verification)
- **400**: Cart is empty during verification
- **500**: Database error (order creation, stock update, or cart clearing failed)

---

### 3. Razorpay Webhook Handler
**Endpoint**: `POST /api/checkout/webhook`

**Authentication**: Signature verification (no Bearer token required)

**Description**:
Handles asynchronous payment notifications from Razorpay. This endpoint:
- Verifies the webhook signature using the X-Razorpay-Signature header
- Processes payment success events (payment.authorized, payment.captured)
- Prevents duplicate orders using an idempotency check
- Extracts user ID from the order receipt
- Performs the same order fulfillment logic as `/verify-razorpay`
- Always returns 200 OK to acknowledge receipt

**Request Headers**:
```
Content-Type: application/json
X-Razorpay-Signature: <hmac_sha256_signature>
```

**Request Body** (Razorpay sends this):
```json
{
  "event": "payment.captured",
  "payload": {
    "payment": {
      "entity": {
        "id": "pay_1A2B3C4D5E6F7G8H",
        "order_id": "order_1A2B3C4D5E6F7G8H",
        "receipt": "receipt_550e8400-e29b-41d4-a716-446655440000_1645398400000",
        "amount": 50000
      }
    }
  }
}
```

**Response** (always 200):
```json
{
  "success": true,
  "message": "Webhook processed successfully",
  "order_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Note**: Webhooks are intended as a fallback mechanism. If a user closes their browser after successful payment but before calling `/verify-razorpay`, the webhook ensures the order is still created.

---

## Frontend Integration Example

### Step 1: Get Razorpay Order ID
```javascript
const response = await fetch('/api/checkout/create-razorpay-order', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const { razorpay_order_id, amount, key_id } = await response.json();
```

### Step 2: Open Razorpay Payment Modal
```javascript
const options = {
  key: key_id,
  amount: amount,
  currency: 'INR',
  order_id: razorpay_order_id,
  handler: async function(response) {
    // Step 3: Verify payment on backend
    const verifyResponse = await fetch('/api/checkout/verify-razorpay', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
        shipping_address: {
          street: shippingData.street,
          city: shippingData.city,
          pincode: shippingData.pincode,
          phone: shippingData.phone
        }
      })
    });
    
    const result = await verifyResponse.json();
    if (result.success) {
      // Order created successfully
      console.log('Order ID:', result.order_id);
    }
  },
  theme: { color: '#3399cc' }
};

const rzp = new Razorpay(options);
rzp.open();
```

---

## Security Considerations

### 1. Signature Verification
- All payments are verified using HMAC SHA256 with the Razorpay secret key
- The signature is constant-time compared to prevent timing attacks
- Webhook signatures are verified using the X-Razorpay-Signature header

### 2. Total Amount Calculation
- **Never trust frontend totals**
- The backend always recalculates the total from the database
- This prevents frontend manipulation of prices
- The calculation is verified again at order creation time

### 3. Stock Validation
- Stock is checked before creating a Razorpay order
- Stock is rechecked during payment verification to catch race conditions
- Stock is only decremented after order creation

### 4. Sequential Operations
- Database operations follow a strict sequence:
  1. Verify signature
  2. Fetch cart items and recalculate total
  3. Create order record
  4. Insert order items
  5. Decrement stock
  6. Clear cart
- If any step fails, previous steps are reverted (except cart clearing, which persists for user retry)

### 5. Payment Method
- All orders use `payment_method: 'razorpay'`
- All orders are created with `payment_status: 'paid'` after signature verification
- No Cash on Delivery (COD) logic is implemented

---

## Testing

### Test Mode
Use Razorpay's test credentials for development:
- **Test Key ID**: `rzp_test_xxxxxxxxxxxxx` (from dashboard)
- **Test Secret**: Available in settings

### Test Payment Methods
Razorpay provides test cards for different scenarios:
- **Success**: 4111111111111111
- **Failure**: 4222222222222220

### Webhook Testing
1. Navigate to **Settings > Webhooks** in Razorpay Dashboard
2. Click **View Deliveries** to see webhook history
3. Use **Resend** to test webhook processing

### Manual Testing Checklist
- [ ] Empty cart → returns 400
- [ ] Out of stock item → returns 400
- [ ] Valid cart → returns razorpay_order_id
- [ ] Valid signature → order created with payment_status='paid'
- [ ] Invalid signature → returns 400
- [ ] Stock decrements after order creation
- [ ] Cart clears after order creation
- [ ] Webhook idempotency: duplicate webhook → no duplicate order

---

## Troubleshooting

### "RAZORPAY_KEY_ID not configured"
- Check `.env` file contains `RAZORPAY_KEY_ID`
- Restart server after adding env variables
- Ensure key is properly copied from Razorpay Dashboard

### "Invalid payment signature"
- Verify `RAZORPAY_KEY_SECRET` is correct
- Check that `razorpay_order_id` and `razorpay_payment_id` match Razorpay's records
- Ensure signature is not tampered with during transmission

### "Cart is empty" during verify
- User's cart was cleared by another request (race condition)
- Storage logic may be deleting cart after order creation
- Check database for orphaned cart items

### "Stock unavailable" after initial validation
- Another purchase completed and decremented stock
- User waited too long before paying (stock sold out)
- This is expected behavior; user should retry with available items

### Webhook not processing
- Verify `RAZORPAY_WEBHOOK_SECRET` is configured
- Check server logs for webhook requests
- Ensure webhook endpoint is publicly accessible
- Verify webhook is registered in Razorpay Dashboard with correct URL

---

## Database Schema Requirements

### orders table (additions)
```sql
razorpay_order_id VARCHAR(255) -- Razorpay order ID
razorpay_payment_id VARCHAR(255) -- Razorpay payment ID
```

### order_items table (requirement)
```sql
price_at_purchase DECIMAL(10, 2) -- Price at time of purchase (for historical records)
```

---

## API Endpoints Reference

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/checkout/create-razorpay-order` | Bearer | Create Razorpay order |
| POST | `/api/checkout/verify-razorpay` | Bearer | Verify and fulfill order |
| POST | `/api/checkout/webhook` | Signature | Handle async payment notifications |

---

## Support
For Razorpay-specific issues, visit: https://razorpay.com/support
For API documentation: https://razorpay.com/docs/
