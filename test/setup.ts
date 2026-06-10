import { execSync } from 'child_process';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

module.exports = async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL;
    execSync('npx prisma migrate deploy', {
        env: { ...process.env },
        stdio: 'inherit',
    });
};
