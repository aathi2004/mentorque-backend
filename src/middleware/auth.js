import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET is required");

function getDecodedToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const decoded = getDecodedToken(token);
  if (!decoded) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  req.userId = decoded.userId || decoded.id;
  req.userRole = decoded.role;
  req.userEmail = decoded.email;

  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      return res.status(403).json({
        error: "Insufficient permissions",
        message: `This action requires one of: ${roles.join(", ")}. Your role: ${req.userRole || "none"}.`,
      });
    }
    next();
  };
}

export async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : req.cookies?.token;
  if (!token) return next();
  const decoded = getDecodedToken(token);
  if (decoded) {
    req.userId = decoded.userId || decoded.id;
    req.userRole = decoded.role;
    req.userEmail = decoded.email;
  }
  next();
}
