var express = require("express");
var router = express.Router();
const User = require("./users.js");
const Booking = require("./booking.js");
const Product = require("./products.js");
var passport = require("passport");
var GoogleStrategy = require("passport-google-oidc");
require("dotenv").config(); // when this function runs it first finds .env files
const nodemailer = require("nodemailer"); //for mails
//Razorpay
const Razorpay = require("razorpay");
// const users = require("./users.js");
// const products = require("./products.js");
const { info } = require("console");
const products = require("./products.js");
var instance = new Razorpay({
  key_id: "rzp_test_cqfIYTq55TVdxg",
  key_secret: "zveAGpmZ2AS9rW91wivBLB4p",
});
////////////

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env["GOOGLE_CLIENT_ID"],
      clientSecret: process.env["GOOGLE_CLIENT_SECRET"],
      callbackURL: "/oauth2/redirect/google",
      scope: ["email", "profile"],
    },
    async function verify(issuer, profile, cb) {
      try {
        let existingUser = await User.findOne({
          email: profile.emails[0].value,
        });
        if (existingUser) {
          return cb(null, existingUser); //cb - callback
        } else {
          let newUser = await User.create({
            name: profile.displayName,
            email: profile.emails[0].value,
          });
          return cb(null, newUser);
        }
      } catch (err) {
        console.log(err);
        return err;
      }
    }
  )
);

/* GET home page. */
router.get("/", async function (req, res, next) {
  // if user is there then go to index page or else go to login page
  if (req.user) {
    res.render("index");
  } else {
    res.redirect("/login");
  }
});

async function findEmailById(id) {
  try {
    const user = await User.findById(id);
    if (user) {
      return user.email;
      // console.log(`Email: ${user.email}`);
    } else {
      console.log("User not found");
    }
  } catch (err) {
    console.error("Error finding user:", err);
  }
}

// Call the function with the desired ID

// login route
router.get("/login", function (req, res, next) {
  // if there is no user then only render login page
  if (!req.user) {
    user = req.user;
    res.render("login", { user });
  }
});

router.get("/login/federated/google", passport.authenticate("google"));

router.get(
  "/oauth2/redirect/google",
  passport.authenticate("google", {
    successRedirect: "/",
    failureRedirect: "/login",
  })
);

router.post("/logout", function (req, res, next) {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

//Razorpay
router.post("/create/orderID", (req, res) => {
  var options = {
    amount: req.body.amount * 100, // amount in the smallest currency unit in paisa i.e 500 rs so imp to put it produtc * 100
    currency: "INR",
    receipt: "order_rcptid_11",
  };
  instance.orders.create(options, function (err, order) {
    console.log(order);
    res.send(order);
  });
});

// router.post("/api/payment/verify", (req, res) => {
//   var razorpayOrderId = req.body.razorpayOrderId;
//   var razorpayPaymentId = req.body.razorpayPaymentId;
//   var signature = req.body.razorpaySignature;
//   var secret = "zveAGpmZ2AS9rW91wivBLB4p";
//   var {
//     validatePaymentVerification,
//     validateWebhookSignature,
//   } = require("../node_modules/razorpay/dist/utils/razorpay-utils");

//   var checkStatus = validatePaymentVerification(
//     { order_id: razorpayOrderId, payment_id: razorpayPaymentId },
//     signature,
//     secret
//   );

//   if (checkStatus && req.user) {
//     Booking.create({
//       owner: req.user.id,
//       products: req.body.products,
//       totalamount: req.body.totalAmount, // here it takes as the original amount only
//       paymentid: razorpayPaymentId,
//     })
//       .then(() => {
//         res.send(true);
//       })
//       .catch((err) => {
//         console.error(err);
//         res.send(false);
//       });
//   } else {
//     res.send(false);
//   }
// });

//Razorpay ended

router.post("/api/payment/verify", async (req, res) => {
  var razorpayOrderId = req.body.razorpayOrderId;
  var razorpayPaymentId = req.body.razorpayPaymentId;
  var signature = req.body.razorpaySignature;
  var secret = "zveAGpmZ2AS9rW91wivBLB4p";
  const a = req.user.id;
  const useremail = await findEmailById(a);
  console.log(useremail);

  const htmlBody = `
  <b>Order Details</b><br>
  OrderId: ${razorpayOrderId}<br><br>
  <b>Products:</b>
  <table style="border-collapse: collapse; width: 100%;">
    <thead>
      <tr>
        <th style="border: 1px solid #ddd; padding: 8px;">Product Name</th>
        <th style="border: 1px solid #ddd; padding: 8px;">Quantity</th>
      </tr>
    </thead>
    <tbody>
      ${req.body.products
        .map(
          (p) => `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">${p.name}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${p.quantity}</td>
        </tr>
      `
        )
        .join("")}
    </tbody>
  </table>
  <br>
  <b>Total Amount Paid:</b> ₹${req.body.totalAmount} <br>
  <b>Payment Id:</b> ${razorpayPaymentId}
  `;

  var {
    validatePaymentVerification,
    validateWebhookSignature,
  } = require("../node_modules/razorpay/dist/utils/razorpay-utils");

  var checkStatus = validatePaymentVerification(
    { order_id: razorpayOrderId, payment_id: razorpayPaymentId },
    signature,
    secret
  );

  if (checkStatus) {
    Booking.create({
      owner: req.user.id,
      products: req.body.products,
      totalamount: req.body.totalAmount, // here it takes as the original amount only
      paymentid: razorpayPaymentId,
    })
      .then(() => {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          host: "smtp.gmail.com",
          port: 587,
          secure: false, // Use `true` for port 465, `false` for all other ports
          auth: {
            user: "chillamcherlaabhinay@gmail.com", // Replace with your Gmail email address
            pass: "opqlojyclohbmpha", // Replace with your Gmail app password
          },
        });

        transporter.sendMail(
          {
            from: process.env["USER"], // sender address
            to: useremail, // list of receivers
            subject: `DeeAsi Order Placed Successfully`, // Subject line
            // text: "Hello world?", // plain text body
            // html: `<b>Order Details <br> OrderId: ${razorpayOrderId} <br> Products:${req.body.products} <br> ₹${req.body.totalAmount} and payment id ${razorpayPaymentId}</br>`, // html body
            html: htmlBody,
          },
          (error, info) => {
            if (error) {
              console.log(error);
            } else {
              console.log("Message sent: %s", info.messageId);
              // Message sent: <d786aa62-4e0a-070a-47ed-0b0666549519@ethereal.email>
            }
          }
        );
      })
      .then(() => {
        res.send(true);
      })
      .catch((err) => {
        console.error(err);
        res.send(false);
      });
  } else {
    res.send(false);
  }
});

router.get("/products", (req, res) => {
  Product.find().then(function (allproducts) {
    user = req.user;
    console.log(user);
    res.render("products.ejs", { allproducts, user });
  });
});

router.get("/aboutus", (req, res) => {
  res.render("aboutus.ejs");
});

router.get("/ordereditems", (req, res) => {
  if (req.user) {
    Booking.find({ owner: req.user.id }).then(function (allbookings) {
      // console.log(allbookings);
      res.render("ordereditems", { allbookings });
    });
  } else {
    res.redirect("/login");
  }
});

router.get("/deleteorder/:paymentid", (req, res) => {
  if (req.user && req.params.paymentid) {
    Booking.deleteOne({ paymentid: req.params.paymentid }).then(function (e) {
      console.log(e);
      res.redirect("/ordereditems");
    });
  } else {
    console.log("error");
  }
});

module.exports = router;
