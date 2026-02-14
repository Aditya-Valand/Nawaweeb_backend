const Order = require('../models/Order');
const { sendOrderEmails } = require('../utils/mailer');

exports.requestOrder = async (req, res) => {
  try {
    // 1. Save order to MongoDB for Admin tracking
    const newOrder = await Order.create({
      productName: req.body.productName,
      orderType: req.body.orderType, // 'Handmade' vs 'Ready-made'
      size: req.body.size,
      customerContact: req.body.customerContact,
      paymentPreference: req.body.paymentPreference || 'UPI'
    });

    // 2. Trigger dual email notification
    await sendOrderEmails(newOrder);

    res.status(201).json({
      status: 'success',
      message: 'Order request received. The Clan will contact you shortly.'
    });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.getAllOrders = async (req, res) => {
  // Only Admin reaches here
  const orders = await Order.find().sort('-createdAt');
  res.status(200).json({ status: 'success', results: orders.length, data: { orders } });
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ message: 'status is required' });

    const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.status(200).json({ status: 'success', data: { order } });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};