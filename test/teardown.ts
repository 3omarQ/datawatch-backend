import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test', override: true });

module.exports = async () => {
    execSync(
        `psql "${process.env.DATABASE_URL}" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"`,
        { stdio: 'inherit' }
    );
};