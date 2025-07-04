const mongoose = require('mongoose');
require('dotenv').config();
const ContentPage = require('./models/ContentPage');

const pages = [
  {
    type: 'terms-of-service',
    title: 'Terms of Service',
    slug: 'terms-of-service',
    content: '<h1>Terms of Service</h1><p>Your terms go here.</p>',
    status: 'published',
  },
  {
    type: 'size-guide',
    title: 'Size Guide',
    slug: 'size-guide',
    content: '<h1>Size Guide</h1><p>Your size guide goes here.</p>',
    status: 'published',
  },
  {
    type: 'faq',
    title: 'FAQ',
    slug: 'faq',
    content: '<h1>Frequently Asked Questions</h1><p>Your FAQ goes here.</p>',
    status: 'published',
  },
];

async function addPages() {
  await mongoose.connect(process.env.MONGO_URL);
  for (const page of pages) {
    const exists = await ContentPage.findOne({ slug: page.slug });
    if (!exists) {
      await ContentPage.create(page);
      console.log(`Added: ${page.title}`);
    } else {
      console.log(`Already exists: ${page.title}`);
    }
  }
  await mongoose.disconnect();
  console.log('Done.');
}

addPages().catch(err => {
  console.error(err);
  mongoose.disconnect();
}); 