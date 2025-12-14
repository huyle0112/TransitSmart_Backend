const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const prisma = require('../config/prisma');
const {
  saveRefreshToken,
  getUserIdFromToken,
  deleteRefreshToken,
  revokeAllUserTokens,
} = require('../config/redis');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// Safe email validation - prevents ReDoS attacks completely
// Uses simple string operations instead of complex regex
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain) return false;
  if (!domain.includes('.')) return false;
  return /^[a-zA-Z0-9._-]+$/.test(local) && /^[a-zA-Z0-9.-]+$/.test(domain);
}

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set. Please configure the environment variable.');
}

if (!JWT_REFRESH_SECRET) {
  console.warn('⚠️  JWT_REFRESH_SECRET is not set. Using JWT_SECRET for refresh tokens (not recommended).');
}

async function generateTokens(user) {
  // Access token - short lived
  const isAdmin = user.role === 'admin';
  const accessToken = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role || 'user',
      isAdmin: user.role === 'admin',
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  // Refresh token - long lived
  const refreshToken = jwt.sign(
    {
      sub: user.id,
      type: 'refresh',
      jti: randomUUID(), // Unique token ID
    },
    JWT_REFRESH_SECRET || JWT_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN }
  );

  // Save refresh token to Redis (7 days = 604800 seconds)
  await saveRefreshToken(user.id, refreshToken, 7 * 24 * 60 * 60);

  return { accessToken, refreshToken };
}

function toSafeUser(user) {
  const isAdmin = user.role === 'admin';
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.created_at,
    role: user.role || 'user',
    isAdmin: user.role === 'admin',
    path_url: user.path_url || null,
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

    // Validate email format
    if (!isValidEmail(email)) {
      return res
        .status(400)
        .json({ message: 'Email không đúng định dạng. Vui lòng nhập email hợp lệ.' });
    }

    // Check if email already exists
    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        message: 'Mật khẩu phải có ít nhất 6 ký tự'
      });
    }

    // Check if email already exists
    const existing = await prisma.users.findUnique({ where: { email } });
    if (existing) {
      return res
        .status(409)
        .json({ message: 'Email này đã được đăng ký. Vui lòng sử dụng email khác hoặc đăng nhập.' });
    }

    // Create new user
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.users.create({
      data: {
        id: randomUUID(),
        name,
        email,
        password: hashedPassword,
      },
    });

    const { accessToken, refreshToken } = await generateTokens(user);

    res.status(201).json({
      token: accessToken,
      refreshToken,
      user: toSafeUser(user),
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Không thể đăng ký lúc này.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    // Validate fields
    if (!email || !password) {
      return res.status(400).json({
        message: 'Vui lòng nhập đầy đủ email và mật khẩu.',
        details: {
          email: !email ? 'Email không được để trống' : null,
          password: !password ? 'Mật khẩu không được để trống' : null,
        }
      });
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return res
        .status(400)
        .json({ message: 'Email không đúng định dạng.' });
    }

    // Check if user exists
    const user = await prisma.users.findUnique({ where: { email } });
    if (!user) {
      return res
        .status(401)
        .json({ message: 'Tài khoản không tồn tại. Vui lòng kiểm tra lại email hoặc đăng ký tài khoản mới.' });
    }

    // Verify password
    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      // Return same generic message for security
      return res.status(401).json({
        message: 'Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.'
      });
    }

    // Generate tokens
    const { accessToken, refreshToken } = await generateTokens(user);

    res.json({
      token: accessToken,
      refreshToken,
      user: toSafeUser(user),
    });
  } catch (error) {
    console.error('Login error:', error);
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
        role: true,
        path_url: true,
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

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token là bắt buộc.' });
    }

    // Verify JWT signature
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET || JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: 'Refresh token không hợp lệ.' });
    }

    // Check if token exists in Redis
    const userId = await getUserIdFromToken(refreshToken);
    if (!userId) {
      return res
        .status(401)
        .json({ message: 'Refresh token đã hết hạn hoặc không tồn tại.' });
    }

    // Get user from database
    const user = await prisma.users.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(401).json({ message: 'Người dùng không tồn tại.' });
    }

    // Delete old refresh token
    await deleteRefreshToken(refreshToken);

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = await generateTokens(user);

    res.json({
      token: accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ message: 'Không thể làm mới token.' });
  }
};

exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await deleteRefreshToken(refreshToken);
    }

    res.json({ message: 'Đăng xuất thành công.' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Không thể đăng xuất.' });
  }
};

exports.logoutAll = async (req, res) => {
  try {
    const userId = req.user.sub; // From auth middleware
    await revokeAllUserTokens(userId);

    res.json({ message: 'Đã đăng xuất khỏi tất cả thiết bị.' });
  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({ message: 'Không thể đăng xuất.' });
  }
};

