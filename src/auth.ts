import jwt from 'jsonwebtoken';

import config from './config';

// security check
export async function getUserIdByToken(token: string): Promise<string> {
  const decoded: { user_id: string } = await (new Promise((resolve, reject) => jwt.verify(
    token,
    config.privateKey,
    function (err, decoded) {
      if (err) {
        reject(err);
      }
      resolve(decoded);
    })));

  return decoded?.user_id as string;
}