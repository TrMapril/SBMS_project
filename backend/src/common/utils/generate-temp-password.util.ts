import { randomInt } from 'crypto';

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';

/** Sinh mật khẩu tạm ngẫu nhiên, dùng khi Admin tạo user mới. */
export function generateTempPassword(length = 12): string {
  let password = '';
  for (let i = 0; i < length; i++) {
    password += CHARSET[randomInt(CHARSET.length)];
  }
  return password;
}
