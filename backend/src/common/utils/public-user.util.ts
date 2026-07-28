import { User } from '@prisma/client';

export type PublicUser = Omit<User, 'passwordHash'>;

export function toPublicUser(user: User): PublicUser {
  const publicUser: Partial<User> = { ...user };
  delete publicUser.passwordHash;
  return publicUser as PublicUser;
}
