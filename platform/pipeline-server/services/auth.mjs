import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = process.env.JWT_SECRET || 'cognitive-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

export class AuthService {
  constructor(driver) {
    this.driver = driver;
  }

  async register(email, password) {
    const session = this.driver.session();
    try {
      // Check if user exists
      const existing = await session.run(
        'MATCH (u:User {email: $email}) RETURN u',
        { email }
      );

      if (existing.records.length > 0) {
        throw new Error('User already exists');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      const id = uuidv4();
      await session.run(
        'CREATE (u:User {id: $id, email: $email, passwordHash: $passwordHash, createdAt: $createdAt})',
        { id, email, passwordHash, createdAt: new Date().toISOString() }
      );

      // Generate token
      const token = jwt.sign({ id, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

      return { token, user: { id, email } };
    } finally {
      await session.close();
    }
  }

  async login(email, password) {
    const session = this.driver.session();
    try {
      // Find user
      const result = await session.run(
        'MATCH (u:User {email: $email}) RETURN u',
        { email }
      );

      if (result.records.length === 0) {
        throw new Error('Invalid credentials');
      }

      const user = result.records[0].get('u').properties;

      // Verify password
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        throw new Error('Invalid credentials');
      }

      // Generate token
      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

      return { token, user: { id: user.id, email: user.email } };
    } finally {
      await session.close();
    }
  }

  async getUser(userId) {
    const session = this.driver.session();
    try {
      const result = await session.run(
        'MATCH (u:User {id: $id}) RETURN u',
        { id: userId }
      );

      if (result.records.length === 0) {
        throw new Error('User not found');
      }

      const user = result.records[0].get('u').properties;
      return { id: user.id, email: user.email };
    } finally {
      await session.close();
    }
  }

  verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
  }
}