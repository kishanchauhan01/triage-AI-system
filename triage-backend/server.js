import dotenv from 'dotenv';
dotenv.config();
import app from './app.js';

const port = process.env.PORT || 3000;
const host = '127.0.0.1'; // MUST listen on localhost for secure testing and sandbox policies

const server = app.listen(port, host, () => {
  console.log(`AI-Powered Customer Triage Backend listening securely on http://${host}:${port}`);
});

export default server;
