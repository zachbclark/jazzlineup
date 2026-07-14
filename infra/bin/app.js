#!/usr/bin/env node
// CDK app entry point. Everything deploys to us-east-1 — required because
// CloudFront only accepts ACM certificates issued in us-east-1.
const cdk = require('aws-cdk-lib');
const { JazzLineupStack } = require('../lib/stack');

const app = new cdk.App();
new JazzLineupStack(app, 'JazzLineup', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1',
  },
  description: 'jazzlineup.com — static site + scheduled crawler',
});
