const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const prisma = require('../config/prisma');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-mock-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

function isAdminEmail(email = '') {
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      isAdmin: isAdminEmail(user.email),
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
    isAdmin: isAdminEmail(user.email),
  };
}

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: 'Vui lòng nhập đầy đủ họ tên, email và mật khẩu.' });
    }

    const existing = await prisma.users.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: 'Email đã được sử dụng.' });
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
    res.status(500).json({ message: 'Không thể đăng ký lúc này.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: 'Vui lòng nhập email và mật khẩu.' });
    }

    const user = await prisma.users.findUnique({ where: { email } });
    if (!user) {
      return res
        .status(401)
        .json({ message: 'Email hoặc mật khẩu không chính xác.' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res
        .status(401)
        .json({ message: 'Email hoặc mật khẩu không chính xác.' });
    }

    const token = signToken(user);
    res.json({
      token,
      user: toSafeUser(user),
    });
  } catch (error) {
    res.status(500).json({ message: 'Không thể đăng nhập lúc này.' });
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
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    }

    res.json(toSafeUser(user));
  } catch (error) {
    res.status(500).json({ message: 'Không thể tải thông tin người dùng.' });
  }
};
