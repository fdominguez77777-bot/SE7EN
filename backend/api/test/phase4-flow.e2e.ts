import 'reflect-metadata';
import request from 'supertest';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

async function main() {
  const app: INestApplication = await NestFactory.create(AppModule, {
    logger: ['error'],
  });
  configureApp(app);
  await app.init();
  const server = app.getHttpServer();
  const stamp = Date.now();

  try {
    await request(server)
      .post('/auth/register')
      .send({
        name: 'Phase4 Admin',
        email: `p4.admin.${stamp}@localhost.local`,
        password: 'password12',
      })
      .expect(201);

    const { DataSource } = await import('typeorm');
    const ds = app.get(DataSource);
    await ds.query(
      `UPDATE "user" SET role = 'ADMIN' WHERE email = $1`,
      [`p4.admin.${stamp}@localhost.local`],
    );

    const staffLogin = await request(server)
      .post('/auth/login')
      .send({
        email: `p4.admin.${stamp}@localhost.local`,
        password: 'password12',
      })
      .expect(200);
    const staffToken = staffLogin.body.accessToken as string;
    const auth = { Authorization: `Bearer ${staffToken}` };

    const profile = await request(server)
      .post('/bidder-profiles')
      .set(auth)
      .send({ name: 'Phase4 Co', legalName: 'Phase4 Construction LLC' })
      .expect(201);

    const project = await request(server)
      .post('/projects')
      .set(auth)
      .send({
        title: 'Phase4 Roof',
        description: 'Replace roof',
        closesAt: new Date(Date.now() + 86400000).toISOString(),
      })
      .expect(201);
    if (project.body.status !== 'DRAFT') {
      throw new Error(`Expected DRAFT, got ${project.body.status}`);
    }

    await request(server)
      .post(`/projects/${project.body.id}/open`)
      .set(auth)
      .expect(201);

    await request(server)
      .post('/bid-invitations')
      .set(auth)
      .send({
        projectId: project.body.id,
        bidderProfileId: profile.body.id,
      })
      .expect(201);

    const bidderEmail = `p4.bidder.${stamp}@localhost.local`;
    const bidderReg = await request(server)
      .post('/auth/register')
      .send({
        name: 'Phase4 Bidder',
        email: bidderEmail,
        password: 'password12',
      })
      .expect(201);

    await request(server)
      .patch(`/users/${bidderReg.body.user.id}/bidder-profile`)
      .set(auth)
      .send({ bidderProfileId: profile.body.id })
      .expect(200);

    const bidderLogin = await request(server)
      .post('/auth/login')
      .send({ email: bidderEmail, password: 'password12' })
      .expect(200);
    const bidderAuth = {
      Authorization: `Bearer ${bidderLogin.body.accessToken as string}`,
    };

    const invites = await request(server)
      .get('/bid-invitations')
      .set(bidderAuth)
      .expect(200);
    const invite = invites.body[0];
    if (!invite?.projectTitle) {
      throw new Error('Invitation list DTO missing projectTitle');
    }

    await request(server)
      .post('/bid-submissions')
      .set(bidderAuth)
      .send({
        projectId: project.body.id,
        amount: 1,
        currency: 'USD',
      })
      .expect(403);

    await request(server)
      .patch(`/bid-invitations/${invite.id}`)
      .set(bidderAuth)
      .send({ status: 'ACCEPTED' })
      .expect(200);

    const bid = await request(server)
      .post('/bid-submissions')
      .set(bidderAuth)
      .send({
        projectId: project.body.id,
        amount: 12500.5,
        currency: 'USD',
        notes: 'Turnkey',
      })
      .expect(201);
    if (Number(bid.body.amount) !== 12500.5) {
      throw new Error(`Expected amount 12500.5, got ${bid.body.amount}`);
    }

    await request(server)
      .post(`/bid-submissions/${bid.body.id}/accept`)
      .set(auth)
      .expect(201);

    const awarded = await request(server)
      .post(`/projects/${project.body.id}/award`)
      .set(auth)
      .send({ submissionId: bid.body.id })
      .expect(201);
    if (awarded.body.status !== 'AWARDED') {
      throw new Error(`Expected AWARDED project, got ${awarded.body.status}`);
    }

    const dash = await request(server).get('/dashboard').set(auth).expect(200);
    if (dash.body.role !== 'ADMIN') {
      throw new Error('Dashboard role mismatch');
    }

    console.log('Phase 4 procurement e2e passed');
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
