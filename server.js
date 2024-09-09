const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const { Firestore } = require("@google-cloud/firestore");
const bcrypt = require("bcrypt");
const { Timestamp } = require('firebase-admin/firestore'); 

const app = express();
const port = process.env.PORT || 3000;
const saltRounds = 10;
const firestore = new Firestore({
  keyFilename: "./key.json", 
});
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, 
  })
);
app.use((req, res, next) => {
  res.locals.isLoggedIn = !!req.session.user;
  next();
});
app.get("/", (req, res) => {
  res.render("home");
});
app.get("/hirefreelancer", (req, res) => {
  res.render("hirefreelancer");
});
app.get("/profile", async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const email = req.session.user.email; 
  try {
    const userRef = firestore.collection("users").doc(email);
    const doc = await userRef.get();

    if (!doc.exists) {
      return res.status(404).send("User not found");
    }

    const userData = doc.data();
    res.render("profile", { user: userData }); 
  } catch (error) {
    res.status(500).send("Error fetching profile: " + error.message);
  }
});
app.post('/payment-submit', async (req, res) => {
  const { freelancerName, amount, serviceCharge, totalAmount, paymentMethod } = req.body;
  const paymentDetails = {
    freelancerName,
    amount,
    serviceCharge,
    totalAmount,
    paymentMethod,
  };

  try {
    const email = req.session.user.email; 
    const paymentRef = firestore.collection('users').doc(email).collection('payments').doc(); 
    await paymentRef.set(paymentDetails);

    res.status(200).json({ message: 'Payment successfully recorded.' });
  } catch (error) {
    console.error('Error adding payment to Firestore:', error);
    res.status(500).json({ message: 'Payment recording failed.' });
  }
});

app.get('/mypayments', async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  const email = req.session.user.email; 
  try {
    const paymentsRef = firestore.collection('users').doc(email).collection('payments');
    const paymentsSnapshot = await paymentsRef.get();

    let payments = [];
    paymentsSnapshot.forEach((doc) => {
      payments.push({ id: doc.id, ...doc.data() });
    });

    res.render('mypayment', { payments });
  } catch (error) {
    res.status(500).send('Error fetching payments: ' + error.message);
  }
});

app.get('/customersup', (req, res) => {
  res.render('customersup');
});
app.get('/payment', (req, res) => {
  res.render('payment');
});
app.get('/payment-faq', (req, res) => {
  res.render('payment-faq');
});
app.get('/faq', (req, res) => {
  res.render('faq');
});
app.get('/project-posting-faq', (req, res) => {
  res.render('project-posting-faq');
});
app.post("/profile/edit", async (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const email = req.session.user.email;
  const { fullname, company, phone, location } = req.body;

  try {
    const userRef = firestore.collection("users").doc(email);
    const doc = await userRef.get();
    if (!doc.exists) {
      return res.status(404).send("User not found.");
    }

    const existingUserData = doc.data();
    const updatedData = {
      fullname: fullname.trim() !== "" ? fullname : existingUserData.fullname,
      company: company.trim() !== "" ? company : existingUserData.company,
      phone: phone.trim() !== "" ? phone : existingUserData.phone,
      location: location.trim() !== "" ? location : existingUserData.location,
    };

    await userRef.update(updatedData);
    res.redirect("/profile");
  } catch (error) {
    res.status(500).send("Error updating profile: " + error.message);
  }
});

app.get("/signupHiring", (req, res) => {
  res.render("signup_hiring", { signupAction: "/signupHiringSubmit" });
});
app.post("/signupHiringSubmit", async (req, res) => {
  const { email, password, fullname, company, phone, location } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const userRef = firestore.collection("users").doc(email);
    await userRef.set({
      fullname,
      company,
      phone,
      location,
      password: hashedPassword, 
    });

    res.send("Sign up is successful. Go to <a href='/login'>login</a>.");
  } catch (error) {
    res.status(500).send("Error signing up: " + error.message);
  }
});
app.get("/login", (req, res) => {
  res.render("login", {
    loginAction: "/loginSubmit",
    forgotPasswordUrl: "/forgot-password",
    newUserUrl: "/signupHiring",
  });
});
app.post("/loginSubmit", async (req, res) => {
  const { email, password } = req.body;

  try {
    const userRef = firestore.collection("users").doc(email);
    const doc = await userRef.get();

    if (!doc.exists) {
      return res.status(401).send("Invalid email or password.");
    }

    const user = doc.data();

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (passwordMatch) {
      req.session.user = { email: email };  
      res.redirect("/"); 
    } else {
      res.status(401).send("Invalid email or password.");
    }
  } catch (error) {
    res.status(500).send("Error logging in: " + error.message);
  }
});
app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send("Error: Unable to log out. Please try again later.");
    }
    res.redirect("/login");
  });
});
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
