import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config(); 
const template = fs.readFileSync('template.json', 'utf-8');
const write_content = template.replace('${GOOGLE_OAUTH_TOKEN}', process.env.GOOGLE_OAUTH_TOKEN);

fs.writeFileSync('manifest.json', write_content);