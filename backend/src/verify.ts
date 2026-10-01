import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import app from './app';
import prisma from './lib/prisma';
import http from 'http';

async function verify() {
  try {
    // Test Prisma Connection
    await prisma.$queryRaw`SELECT 1`;
    console.log('Prisma connected successfully.');

    // Test Server and /health
    const server = http.createServer(app);
    server.listen(0, async () => {
      const address = server.address();
      const port = typeof address === 'string' ? 0 : address?.port;
      
      const res = await fetch(`http://localhost:${port}/health`);
      const data = await res.json();
      
      if (data.status === 'ok') {
        console.log('/health check passed:', data);
      } else {
        console.error('/health check failed:', data);
      }
      
      server.close();
      await prisma.$disconnect();
    });
  } catch (error) {
    console.error('Verification failed:', error);
    process.exit(1);
  }
}

verify();
