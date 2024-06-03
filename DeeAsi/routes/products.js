var mongoose = require("mongoose");
const productsSchema = mongoose.Schema({
  productname: String,
  amount: Number,
  image: String,
});
module.exports = mongoose.model("products", productsSchema);
