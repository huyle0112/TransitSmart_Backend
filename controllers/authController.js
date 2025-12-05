const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { addUser, getUserByEmail } = require('../data/store');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-mock-key';
const JWT_EXPIRES_IN = '12h';

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: 'Vui lòng nhập đầy đủ họ tên, email và mật khẩu.' });
    }

    const existing = getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ message: 'Email đã được sử dụng.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = addUser({
      id: uuidv4(),
      name,
      email,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
    });

    const token = signToken(user);
    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
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

    const user = getUserByEmail(email);
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
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Không thể đăng nhập lúc này.', error });
  }
};

