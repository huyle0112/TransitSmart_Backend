const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const prisma = require('../config/prisma');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set. Please configure the environment variable.');
}

function isAdminEmail(email = '') {
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role || 'user',
      isAdmin: user.role === 'admin' || isAdminEmail(user.email),
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function toSafeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.created_at,
    role: user.role || 'user', // Include role from database
    isAdmin: user.role === 'admin' || isAdminEmail(user.email),
  };
}

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        message: 'Vui lòng nhập đầy đủ thông tin.',
        details: {
          name: !name ? 'Họ tên không được để trống' : null,
          email: !email ? 'Email không được để trống' : null,
          password: !password ? 'Mật khẩu không được để trống' : null,
        }
      });
    }

    // Validate email format
    if (!email.includes('@')) {
      return res.status(400).json({
        message: 'Email không hợp lệ. Email phải chứa ký tự @'
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        message: 'Mật khẩu phải có ít nhất 6 ký tự'
      });
    }

    // Check if email already exists
    const existing = await prisma.users.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({
        message: 'Email đã được sử dụng. Vui lòng đăng nhập hoặc sử dụng email khác.'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.users.create({
      data: {
        id: randomUUID(),
        name,
        email,
        password: hashedPassword,
      },
    });

    const token = signToken(user);
    res.status(201).json({
      token,
      user: toSafeUser(user),
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      message: 'Không thể đăng ký lúc này. Vui lòng thử lại sau.'
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        message: 'Vui lòng nhập đầy đủ email và mật khẩu.',
        details: {
          email: !email ? 'Email không được để trống' : null,
          password: !password ? 'Mật khẩu không được để trống' : null,
        }
      });
    }

    // Find user by email
    const user = await prisma.users.findUnique({ where: { email } });
    if (!user) {
      // Return generic message for security (prevent user enumeration)
      return res.status(401).json({
        message: 'Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.'
      });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      // Return same generic message for security
      return res.status(401).json({
        message: 'Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.'
      });
    }

    const token = signToken(user);
    res.json({
      token,
      user: toSafeUser(user),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      message: 'Không thể đăng nhập lúc này. Vui lòng thử lại sau.'
    });
  }
};

exports.me = async (req, res) => {
  try {
    const user = await prisma.users.findUnique({
      where: { id: req.user.sub },
      select: {
        id: true,
        name: true,
        email: true,
        created_at: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: 'Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.'
      });
    }

    res.json(toSafeUser(user));
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      message: 'Không thể tải thông tin người dùng. Vui lòng thử lại sau.'
    });
  }
};
