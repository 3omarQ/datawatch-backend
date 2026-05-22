import type { User } from '../generated/prisma/client';

type AuthUserSource = Pick<
  User,
  | 'id'
  | 'email'
  | 'name'
  | 'emailVerified'
  | 'role'
  | 'provider'
  | 'image'
  | 'notifyByEmail'
  | 'createdAt'
>;

export type AuthUser = AuthUserSource;

export const AUTH_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  emailVerified: true,
  role: true,
  provider: true,
  image: true,
  notifyByEmail: true,
  createdAt: true,
} as const;

export function toAuthUser(user: AuthUserSource): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
    role: user.role,
    provider: user.provider,
    image: user.image,
    notifyByEmail: user.notifyByEmail,
    createdAt: user.createdAt,
  };
}
