const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// User schema and model (adjust fields as needed)
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String },
  password: { type: String, required: true },
  role: { type: String, default: 'cashier' },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

async function hashPassword(password) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

async function insertUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Sample users (edit plaintext passwords as desired)
    const users = [
      {
        username: 'admin',
        name: 'System Admin',
        email: 'admin@shopoms.com',
        password: 'admin123', // Will be hashed
        role: 'admin'
      },
      {
        username: 'cashier1',
        name: 'Cashier One',
        email: 'cashier1@shopoms.com',
        password: 'cashier123', // Will be hashed
        role: 'cashier'
      },
      {
        username: 'cashier2',
        name: 'Cashier Two',
        email: 'cashier2@shopoms.com',
        password: 'cashier234', // Will be hashed
        role: 'cashier'
      }
    ];

    // Hash passwords and insert users
    for (const user of users) {
      const hashedPassword = await hashPassword(user.password);
      await User.create({
        ...user,
        password: hashedPassword
      });
    }

    console.log('✅ Users inserted successfully');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

insertUsers();
