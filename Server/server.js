require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const productRoutes = require('./routes/productRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const categoryRoutes = require('./routes/categorieRoute');
const announcementRoutes = require('./routes/announcements');
const categoryImageRoutes = require('./routes/categoryImages');
const customerRoutes = require('./routes/customers');
const reviewRoutes = require('./routes/reviews');
const replacementRoutes = require('./routes/replacements');
const cookieParser = require('cookie-parser');
const addressRoutes = require('./routes/address');
const orderRoutes = require("./routes/order");
const newsletterRoutes = require('./routes/newsletter');
const promotionRoutes = require('./routes/promotions');
const contactRoutes = require('./routes/contact');
const logRoutes = require('./routes/logs');
const settingsRoutes = require("./routes/settingsRoutes");
const contentPagesRoutes = require('./routes/contentPages');

const forgotPasswordRoutes = require('./routes/forgotPassword');

const app = express();

const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Debug-Request"],
}));
app.use(cookieParser());

mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log('DB connected'))
  .catch((err) => console.log(err));

app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/category-images', categoryImageRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/replacements', replacementRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/logs', logRoutes);

app.use('/api/users', addressRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/content-pages', contentPagesRoutes);

app.use('/api/forgotpassword', forgotPasswordRoutes);

app.get('/', (req, res) => res.send("API IS ON"));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
