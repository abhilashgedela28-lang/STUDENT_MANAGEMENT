const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config/config');

class AuthService {
  generateToken(user) {
    return jwt.sign(
      { id: user._id, role: user.role, email: user.email },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );
  }

  async signup(name, email, password) {
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      const err = new Error('An account with this email already exists.');
      err.statusCode = 409;
      throw err;
    }

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: 'USER',
    });

    const token = this.generateToken(user);
    return { user, token };
  }

  async login(email, password) {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      const err = new Error('Invalid email or password.');
      err.statusCode = 401;
      throw err;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      const err = new Error('Invalid email or password.');
      err.statusCode = 401;
      throw err;
    }

    const token = this.generateToken(user);
    return { user, token };
  }

  async seedAdminIfNoneExists() {
    const adminCount = await User.countDocuments({ role: 'ADMIN' });
    if (adminCount === 0) {
      if (config.adminEmail && config.adminPassword) {
        console.log(`[Admin Seeding] Creating initial admin account for ${config.adminEmail}...`);
        await User.create({
          name: 'Administrator',
          email: config.adminEmail.toLowerCase().trim(),
          password: config.adminPassword,
          role: 'ADMIN',
        });
        console.log('[Admin Seeding] Initial admin successfully created.');
      } else {
        console.warn('[Admin Seeding] No admin exists, but ADMIN_EMAIL or ADMIN_PASSWORD not specified in env.');
      }
    }
  }
}

module.exports = new AuthService();
