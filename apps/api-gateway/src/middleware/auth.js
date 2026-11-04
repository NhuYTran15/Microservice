import jwt from 'jsonwebtoken';

export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return res.status(401).json({ error: 'Missing Bearer token' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { uid: Number(payload.sub), role: payload.role };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Insufficient permissions' });
    next();
  };
}

export function ownCustomerOrAdmin(req, res, next) {
  if (req.user.role !== 'ADMIN' && req.user.uid !== Number(req.params.uid)) {
    return res.status(403).json({ error: 'You cannot access this customer' });
  }
  next();
}

