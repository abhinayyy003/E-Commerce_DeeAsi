var mongoose = require("mongoose");

const bookedSchema = mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
  },
  products: [
    {
      name: String,
      quantity: Number,
      price: Number,
    },
  ],
  totalamount: Number,
  paymentid: String,
  date: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("bookings", bookedSchema);
